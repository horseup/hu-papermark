// Database integration tests. These do not send email (the mail transport is stubbed), access AWS, or drive UI.
// Run only against a disposable local PostgreSQL database with the schema applied.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHmac } = require('node:crypto');
const fs = require('node:fs');
const ts = require('typescript');

const url = new URL(process.env.POSTGRES_PRISMA_URL || 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
  throw new Error('Use a disposable localhost database whose name ends in _test.');
}
process.env.HORSEUP_TEAM_ID = `integration-${randomUUID()}`;
process.env.HORSEUP_ADMIN_EMAILS = 'admin@example.test,admin2@example.test';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'integration-test-secret';
process.env.HORSEUP_EMAIL_FROM = 'Old Name <noreply@example.test>';
delete process.env.RESEND_API_KEY;
delete process.env.HORSEUP_INVESTOR_REPLY_TO;
delete process.env.HORSEUP_NOTIFY_QUIET_MS;
delete process.env.HORSEUP_NOTIFY_MAX_WAIT_MS;
// Compile the real server modules without adding a test-runner dependency.
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const mail = require('../lib/mail.ts');
// Every email lands here; nothing reaches Resend.
const sent = [];
let failNextSend = false;
mail.setMailTransport(async message => { if (failNextSend) { failNextSend = false; throw new Error('synthetic failure'); } sent.push(message); });
const { db } = require('../lib/db.ts');
const { flushNotifications, unsubscribe, optOutStatus, setOptOut, visibleDocuments, notifyDocumentChanges } = require('../lib/notifications.ts');
const { performAction } = require('../lib/actions.ts');
const { roomContext, documentAccess } = require('../lib/access.ts');
const teamId = process.env.HORSEUP_TEAM_ID;
const admin = { id: randomUUID(), email: 'admin@example.test', admin: true };
const investor = { id: randomUUID(), email: `${randomUUID()}@example.test`, admin: false };
const outsider = { id: randomUUID(), email: `${randomUUID()}@example.test`, admin: false };
const admin2 = { id: randomUUID(), email: 'admin2@example.test', admin: true };
const people = Array.from({ length: 5 }, () => ({ id: randomUUID(), email: `${randomUUID()}@example.test`, admin: false }));
const [inv1, inv2, inv3, inv4, pendingInvitee] = people;
let intro, diligence, room, otherRoom, doc, version, draft, membership;
const act = (actor, action, values = {}) => performAction(actor, { action, ...values });
const denied = (promise, status) => assert.rejects(promise, error => error.status === status);

before(async () => {
  for (const actor of [admin, admin2, investor, outsider, ...people]) await db.user.create({ data: { id: actor.id, email: actor.email, emailVerified: new Date() } });
  await db.team.create({ data: { id: teamId, name: 'Synthetic integration fixtures', ignoredDomains: [], globalBlockList: [] } });
  intro = await act(admin, 'createStage', { name: 'Introduction' });
  diligence = await act(admin, 'createStage', { name: 'Diligence' });
  doc = await db.document.create({ data: { name: 'Synthetic PDF', file: 'test.pdf', teamId } });
  version = await db.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, file: 'test.pdf', numPages: 3, isPrimary: true, huS3VersionId: 'synthetic-version' } });
  draft = await db.documentVersion.create({ data: { documentId: doc.id, versionNumber: 2, file: 'draft.pdf', isPrimary: false } });
  await act(admin, 'setDocumentStage', { documentId: doc.id, stageId: diligence.id });
  room = await act(admin, 'createRoom', { name: 'Investor A', stageId: intro.id, documentIds: [doc.id] });
  otherRoom = await act(admin, 'createRoom', { name: 'Investor B', stageId: diligence.id, documentIds: [doc.id] });
  membership = await db.huRoomMembership.create({ data: { roomId: room.id, email: investor.email, invitedById: admin.id } });
});

test('pending invitation requires acceptance; another investor cannot accept it', async () => {
  await denied(roomContext(db, investor, room.id), 404);
  await denied(act(outsider, 'acceptInvitation', { roomId: room.id }), 404);
  await act(investor, 'acceptInvitation', { roomId: room.id });
  await roomContext(db, investor, room.id);
  await denied(roomContext(db, investor, otherRoom.id), 404);
});

test('only admins can change stage; promotion reveals and demotion hides selected documents', async () => {
  await denied(documentAccess(db, investor, room.id, doc.id), 404);
  await denied(act(investor, 'setRoomStage', { roomId: room.id, stageId: diligence.id }), 403);
  await act(admin, 'setRoomStage', { roomId: room.id, stageId: diligence.id });
  await documentAccess(db, investor, room.id, doc.id);
  await act(admin, 'setRoomStage', { roomId: room.id, stageId: intro.id });
  await denied(documentAccess(db, investor, room.id, doc.id), 404);
  await act(admin, 'setRoomStage', { roomId: room.id, stageId: diligence.id });
});

test('discussions reject draft references, invalid pages and people outside the room', async () => {
  const input = { roomId: room.id, title: 'Synthetic question', body: 'Question', documentId: doc.id, versionId: version.id, pageNumber: 1, requestId: randomUUID() };
  await denied(act(investor, 'createDiscussion', { ...input, versionId: draft.id }), 400);
  await denied(act(investor, 'createDiscussion', { ...input, pageNumber: 4 }), 400);
  await denied(act(investor, 'createDiscussion', { ...input, mentionIds: [outsider.id] }), 400);
  await denied(act(outsider, 'createDiscussion', input), 404);
});

test('threads preserve version context, enforce room isolation and record resolve/reopen history', async () => {
  const requestId = randomUUID();
  const input = { roomId: room.id, title: 'Synthetic question', body: 'Question', documentId: doc.id, versionId: version.id, pageNumber: 2, requestId };
  const discussion = await act(investor, 'createDiscussion', input);
  assert.equal((await act(investor, 'createDiscussion', input)).id, discussion.id);
  assert.equal(await db.huRoomMessage.count({ where: { discussionId: discussion.id } }), 1);
  await denied(act(admin, 'reply', { roomId: otherRoom.id, discussionId: discussion.id, body: 'Wrong room', requestId: randomUUID() }), 404);
  await act(investor, 'resolveDiscussion', { roomId: room.id, discussionId: discussion.id, resolved: true });
  await denied(act(investor, 'reply', { roomId: room.id, discussionId: discussion.id, body: 'Closed', requestId: randomUUID() }), 409);
  await act(admin, 'resolveDiscussion', { roomId: room.id, discussionId: discussion.id, resolved: false });
  await act(admin, 'reply', { roomId: room.id, discussionId: discussion.id, body: 'Answer', requestId: randomUUID() });
  const saved = await db.huRoomDiscussion.findUniqueOrThrow({ where: { id: discussion.id }, include: { events: { orderBy: { sequence: 'asc' } }, messages: { orderBy: { sequence: 'asc' } } } });
  assert.equal(saved.documentVersionId, version.id);
  assert.equal(saved.pageNumber, 2);
  assert.deepEqual(saved.events.map(e => e.type), ['RESOLVED', 'REOPENED']);
  assert.deepEqual(saved.messages.map(m => m.body), ['Question', 'Answer']);
  await act(admin, 'setRoomDocuments', { roomId: room.id, documentIds: [] });
  await denied(act(investor, 'reply', { roomId: room.id, discussionId: discussion.id, body: 'Hidden', requestId: randomUUID() }), 404);
  await act(admin, 'setRoomDocuments', { roomId: room.id, documentIds: [doc.id] });
});

test('inline comments store a validated page anchor and reject malformed ones', async () => {
  const base = { roomId: room.id, title: 'Inline', body: 'Question on a passage', documentId: doc.id, versionId: version.id, pageNumber: 2 };
  const anchor = { kind: 'text', rects: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.03 }, { x: 0.1, y: 0.24, w: 0.3, h: 0.03 }], quote: 'Synthetic passage' };
  const created = await act(investor, 'createDiscussion', { ...base, anchor, requestId: randomUUID() });
  const saved = await db.huRoomDiscussion.findUniqueOrThrow({ where: { id: created.id } });
  assert.deepEqual(saved.anchor, anchor);
  assert.equal(saved.pageNumber, 2);
  const area = await act(investor, 'createDiscussion', { ...base, anchor: { kind: 'area', rects: [{ x: 0, y: 0, w: 1, h: 1 }] }, requestId: randomUUID() });
  assert.equal((await db.huRoomDiscussion.findUniqueOrThrow({ where: { id: area.id } })).anchor.kind, 'area');
  const bad = async (values, status = 400) => {
    await assert.rejects(act(investor, 'createDiscussion', { ...base, requestId: randomUUID(), ...values }), error => error.status === status || error.name === 'ZodError');
  };
  await bad({ pageNumber: null, anchor });
  await bad({ documentId: null, versionId: null, pageNumber: null, anchor });
  await bad({ anchor: { kind: 'text', rects: [{ x: 0.9, y: 0.1, w: 0.5, h: 0.1 }] } });
  await bad({ anchor: { kind: 'text', rects: [{ x: -0.1, y: 0.1, w: 0.2, h: 0.1 }] } });
  await bad({ anchor: { kind: 'text', rects: [] } });
  await bad({ anchor: { kind: 'note', rects: [{ x: 0, y: 0, w: 0.1, h: 0.1 }] } });
  await bad({ anchor: { kind: 'text', rects: [{ x: 0, y: 0, w: 0.1, h: 0.1 }], html: '<b>x</b>' } });
  const plain = await act(investor, 'createDiscussion', { roomId: room.id, title: 'General', body: 'Room-level question', documentId: null, versionId: null, pageNumber: null, requestId: randomUUID() });
  assert.equal((await db.huRoomDiscussion.findUniqueOrThrow({ where: { id: plain.id } })).anchor, null);
});

test('analytics reject spoofed sessions and draft pages; repeated reports do not inflate time', async () => {
  const visitId = randomUUID();
  await act(investor, 'startVisit', { roomId: room.id, visitId });
  const reading = { roomId: room.id, visitId, documentId: doc.id, versionId: version.id, page: 1, visibleMs: 1000 };
  await denied(act(outsider, 'recordReading', reading), 404);
  await denied(act(investor, 'recordReading', { ...reading, versionId: draft.id }), 404);
  await act(investor, 'recordReading', reading);
  await act(investor, 'recordReading', reading);
  await act(investor, 'recordReading', { ...reading, visibleMs: 500 });
  const rows = await db.huPageReading.findMany({ where: { visitId } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].visibleMs, 1000);
});

test('deleting a stage moves rooms and document rules to the replacement; investors cannot delete', async () => {
  const temporary = await act(admin, 'createStage', { name: 'Temporary' });
  const tempRoom = await act(admin, 'createRoom', { name: 'Investor C', stageId: temporary.id, documentIds: [] });
  const tempDoc = await db.document.create({ data: { name: 'Synthetic stage PDF', file: 'stage.pdf', teamId } });
  await act(admin, 'setDocumentStage', { documentId: tempDoc.id, stageId: temporary.id });
  await denied(act(investor, 'deleteStage', { stageId: temporary.id, replacementStageId: intro.id }), 403);
  await denied(act(admin, 'deleteStage', { stageId: temporary.id, replacementStageId: temporary.id }), 400);
  await denied(act(admin, 'deleteStage', { stageId: temporary.id, replacementStageId: 'missing-stage' }), 400);
  const result = await act(admin, 'deleteStage', { stageId: temporary.id, replacementStageId: intro.id });
  assert.equal(result.movedRooms, 1);
  assert.equal(result.movedDocuments, 1);
  assert.equal(await db.huRoomStage.count({ where: { id: temporary.id } }), 0);
  assert.equal((await db.huInvestorRoom.findUniqueOrThrow({ where: { id: tempRoom.id } })).stageId, intro.id);
  assert.equal((await db.huDocumentAccess.findUniqueOrThrow({ where: { documentId: tempDoc.id } })).minimumStageId, intro.id);
  await db.huInvestorRoom.delete({ where: { id: tempRoom.id } });
});

test('deleting a document removes it from every room, keeps its discussions and blocks reuse', async () => {
  const removable = await db.document.create({ data: { name: 'Synthetic removable PDF', file: 'removable.pdf', teamId } });
  const removableVersion = await db.documentVersion.create({ data: { documentId: removable.id, versionNumber: 1, file: 'removable.pdf', numPages: 2, isPrimary: true, huS3VersionId: 'synthetic-removable' } });
  await act(admin, 'setDocumentStage', { documentId: removable.id, stageId: intro.id });
  await act(admin, 'setRoomDocuments', { roomId: room.id, documentIds: [doc.id, removable.id] });
  await act(admin, 'setRoomDocuments', { roomId: otherRoom.id, documentIds: [doc.id, removable.id] });
  await documentAccess(db, investor, room.id, removable.id);
  const thread = await act(investor, 'createDiscussion', { roomId: room.id, title: 'About the removable PDF', body: 'Question', documentId: removable.id, versionId: removableVersion.id, pageNumber: 1, requestId: randomUUID() });

  await denied(act(investor, 'deleteDocument', { documentId: removable.id }), 403);
  const result = await act(admin, 'deleteDocument', { documentId: removable.id });
  assert.equal(result.removedFromRooms, 2);
  assert.equal(await db.huRoomDocument.count({ where: { documentId: removable.id } }), 0);
  const saved = await db.document.findUniqueOrThrow({ where: { id: removable.id } });
  assert.ok(saved.huDeletedAt);
  assert.equal(saved.huDeletedById, admin.id);

  await denied(documentAccess(db, investor, room.id, removable.id), 404);
  await denied(documentAccess(db, admin, room.id, removable.id), 404);
  await denied(act(admin, 'deleteDocument', { documentId: removable.id }), 400);
  await denied(act(admin, 'setRoomDocuments', { roomId: room.id, documentIds: [removable.id] }), 400);
  await denied(act(admin, 'setDocumentStage', { documentId: removable.id, stageId: intro.id }), 400);
  await denied(act(admin, 'beginUpload', { name: 'New version', fileName: 'new-version.pdf', documentId: removable.id, stageId: intro.id, size: 10 }), 400);
  await denied(act(investor, 'createDiscussion', { roomId: room.id, title: 'New', body: 'Question', documentId: removable.id, versionId: removableVersion.id, pageNumber: 1, requestId: randomUUID() }), 404);

  // The existing thread survives as a room-level conversation.
  await act(admin, 'reply', { roomId: room.id, discussionId: thread.id, body: 'Answer after removal', requestId: randomUUID() });
  await act(investor, 'resolveDiscussion', { roomId: room.id, discussionId: thread.id, resolved: true });
  const kept = await db.huRoomDiscussion.findUniqueOrThrow({ where: { id: thread.id }, include: { messages: true } });
  assert.equal(kept.documentVersionId, removableVersion.id);
  assert.equal(kept.messages.length, 2);
  await denied(act(outsider, 'reply', { roomId: room.id, discussionId: thread.id, body: 'Outsider', requestId: randomUUID() }), 404);
});

test('revocation and room archive immediately remove access', async () => {
  await act(admin, 'archiveRoom', { roomId: room.id, archived: true });
  await denied(roomContext(db, investor, room.id), 404);
  await act(admin, 'archiveRoom', { roomId: room.id, archived: false });
  await act(admin, 'revokeMember', { roomId: room.id, membershipId: membership.id });
  await denied(roomContext(db, investor, room.id), 404);
  await denied(act(investor, 'acceptInvitation', { roomId: room.id }), 404);
});

// ---- Notification emails ---------------------------------------------------
const MINUTE = 60 * 1000;
// Flush as if `minutes` had passed; the default quiet window is 10 minutes.
const flushAfter = minutes => flushNotifications(new Date(Date.now() + minutes * MINUTE));
async function drain() { await flushAfter(24 * 60); sent.length = 0; }
const to = actor => sent.filter(m => m.to === actor.email);
const recipients = () => sent.map(m => m.to).sort();
async function publishedDocument(name, stageId) {
  const document = await db.document.create({ data: { name, file: `${name}.pdf`, teamId } });
  await db.documentVersion.create({ data: { documentId: document.id, versionNumber: 1, file: `${name}.pdf`, numPages: 2, isPrimary: true, huS3VersionId: `v-${randomUUID()}` } });
  await act(admin, 'setDocumentStage', { documentId: document.id, stageId });
  return document;
}
async function member(roomId, actor, accepted = true) {
  return db.huRoomMembership.create({ data: { roomId, email: actor.email, invitedById: admin.id, ...(accepted ? { userId: actor.id, acceptedAt: new Date() } : {}) } });
}
const signature = membershipId => createHmac('sha256', 'integration-test-secret').update(`hu-unsubscribe:${membershipId}`).digest('base64url');
let nRoom, nRoomB, deckDoc, termsDoc, dataDoc;

test('notification fixtures', async () => {
  await drain();
  deckDoc = await publishedDocument('Synthetic Deck', diligence.id);
  termsDoc = await publishedDocument('Synthetic Terms', intro.id);
  dataDoc = await publishedDocument('Synthetic Data Pack', diligence.id);
  nRoom = await act(admin, 'createRoom', { name: 'SYNTHETIC Notify A', stageId: intro.id, documentIds: [deckDoc.id] });
  nRoomB = await act(admin, 'createRoom', { name: 'SYNTHETIC Notify B', stageId: intro.id, documentIds: [deckDoc.id] });
  await member(nRoom.id, inv1); await member(nRoom.id, inv2); await member(nRoom.id, pendingInvitee, false);
  await member(nRoomB.id, inv3);
  await drain();
});

test('document changes are debounced into one email per investor and skip everyone else', async () => {
  await act(admin, 'setRoomStage', { roomId: nRoom.id, stageId: diligence.id });
  assert.deepEqual(await flushAfter(0), { sent: 0, skipped: 0, failed: 0 }, 'nothing is sent inside the quiet window');
  await act(admin, 'setRoomDocuments', { roomId: nRoom.id, documentIds: [deckDoc.id, termsDoc.id] });
  await flushAfter(11);
  assert.deepEqual(recipients(), [inv1.email, inv2.email].sort());
  const message = to(inv1)[0];
  assert.equal(to(inv1).length, 1);
  assert.equal(message.from, 'HorseUp Deal Room <noreply@example.test>');
  assert.equal(message.replyTo, 'investors@horseup.de');
  assert.equal(message.subject, 'Updates in SYNTHETIC Notify A');
  assert.match(message.text, /New documents available:\n- Synthetic Deck\n- Synthetic Terms/);
  assert.ok(message.text.includes(`http://localhost:3000/rooms/${nRoom.id}`));
  const membership = await db.huRoomMembership.findFirstOrThrow({ where: { roomId: nRoom.id, userId: inv1.id } });
  assert.equal(message.headers['List-Unsubscribe'], `<http://localhost:3000/unsubscribe?m=${membership.id}&t=${signature(membership.id)}>`);
  assert.doesNotMatch(message.text, /Synthetic Data Pack/);
  // Multipart: the HTML part carries the same content, the room as the button and the opt-out link.
  assert.ok(message.html.includes(`<a href="http://localhost:3000/rooms/${nRoom.id}" style="display: inline-block; background-color: #027C81;`));
  assert.ok(message.html.includes('<li style="margin: 0 0 4px;">Synthetic Deck</li>'));
  assert.ok(message.html.includes(`href="http://localhost:3000/unsubscribe?m=${membership.id}&amp;t=${signature(membership.id)}"`));
  sent.length = 0;
});

test('a new published version notifies investors who can open the document', async () => {
  await db.$transaction(async tx => {
    const before = await visibleDocuments(tx);
    await tx.documentVersion.updateMany({ where: { documentId: termsDoc.id }, data: { isPrimary: false } });
    await tx.documentVersion.create({ data: { documentId: termsDoc.id, versionNumber: 2, file: 'terms-2.pdf', numPages: 3, isPrimary: true, huS3VersionId: `v-${randomUUID()}` } });
    await notifyDocumentChanges(tx, admin, before);
  });
  await flushAfter(11);
  assert.deepEqual(recipients(), [inv1.email, inv2.email].sort());
  assert.match(to(inv1)[0].text, /Updated documents:\n- Synthetic Terms \(version 2\)/);
  sent.length = 0;
});

test('access is re-checked at send time; revoked investors only hear that access ended', async () => {
  await act(admin, 'setRoomStage', { roomId: nRoomB.id, stageId: diligence.id });
  const membership = await db.huRoomMembership.findFirstOrThrow({ where: { roomId: nRoomB.id, userId: inv3.id } });
  await act(admin, 'revokeMember', { roomId: nRoomB.id, membershipId: membership.id });
  const pending = await db.huRoomMembership.findFirstOrThrow({ where: { roomId: nRoom.id, email: pendingInvitee.email } });
  await act(admin, 'revokeMember', { roomId: nRoom.id, membershipId: pending.id });
  const result = await flushAfter(11);
  assert.deepEqual(recipients(), [inv3.email]);
  assert.equal(to(inv3)[0].subject, 'Your access to SYNTHETIC Notify B has ended');
  assert.doesNotMatch(to(inv3)[0].text, /Synthetic Deck|unsubscribe/);
  assert.equal(result.skipped, 1, 'the document notice for the revoked investor is dropped');
  sent.length = 0;
});

test('discussions: admins hear investor posts, investors hear replies in their threads, never the author', async () => {
  const thread = await act(inv1, 'createDiscussion', { roomId: nRoom.id, title: 'Synthetic room question', body: 'Question', documentId: null, versionId: null, pageNumber: null, requestId: randomUUID() });
  await flushAfter(11);
  assert.deepEqual(recipients(), [admin.email, admin2.email].sort());
  assert.ok(to(admin)[0].text.includes(`${inv1.email} wrote in a room-wide discussion`));
  assert.doesNotMatch(to(admin)[0].text, /Synthetic room question|Question/);
  sent.length = 0;

  await act(admin, 'reply', { roomId: nRoom.id, discussionId: thread.id, body: 'Answer', requestId: randomUUID() });
  await act(admin, 'reply', { roomId: nRoom.id, discussionId: thread.id, body: 'Mention', mentionIds: [inv2.id], requestId: randomUUID() });
  await flushAfter(11);
  assert.deepEqual(recipients(), [inv1.email, inv2.email].sort(), 'admin posts do not notify the other admin');
  assert.match(to(inv1)[0].text, /2 new replies in a room-wide discussion/);
  assert.match(to(inv2)[0].text, /You were mentioned in a room-wide discussion/);
  assert.doesNotMatch(to(inv1)[0].text, /Answer|Mention/);
  sent.length = 0;

  await act(inv2, 'reply', { roomId: nRoom.id, discussionId: thread.id, body: 'Follow-up', requestId: randomUUID() });
  await flushAfter(11);
  assert.deepEqual(recipients(), [admin.email, admin2.email, inv1.email].sort());
  sent.length = 0;
});

test('a reply about a document the investor lost access to is not emailed', async () => {
  const termsVersion = await db.documentVersion.findFirstOrThrow({ where: { documentId: termsDoc.id, isPrimary: true } });
  const thread = await act(inv1, 'createDiscussion', { roomId: nRoom.id, title: 'Synthetic terms question', body: 'Question', documentId: termsDoc.id,
    versionId: termsVersion.id, pageNumber: 1, requestId: randomUUID() });
  await drain();
  await act(admin, 'reply', { roomId: nRoom.id, discussionId: thread.id, body: 'Answer', requestId: randomUUID() });
  await act(admin, 'setRoomDocuments', { roomId: nRoom.id, documentIds: [deckDoc.id] });
  await flushAfter(11);
  assert.deepEqual(recipients(), []);
  await act(admin, 'setRoomDocuments', { roomId: nRoom.id, documentIds: [deckDoc.id, termsDoc.id] });
  await drain();
});

test('admins hear about an accepted invitation and only the first visit', async () => {
  await member(nRoom.id, inv4, false);
  await act(inv4, 'acceptInvitation', { roomId: nRoom.id });
  await act(inv4, 'acceptInvitation', { roomId: nRoom.id });
  await act(inv4, 'startVisit', { roomId: nRoom.id, visitId: randomUUID() });
  await act(inv4, 'startVisit', { roomId: nRoom.id, visitId: randomUUID() });
  await act(admin, 'startVisit', { roomId: nRoom.id, visitId: randomUUID() });
  await flushAfter(11);
  assert.deepEqual(recipients(), [admin.email, admin2.email].sort());
  const text = to(admin2)[0].text;
  assert.equal(text.match(/accepted the invitation/g).length, 1);
  assert.equal(text.match(/opened the room for the first time/g).length, 1);
  sent.length = 0;
});

test('failed deliveries are retried on the next flush', async () => {
  await act(admin, 'setRoomDocuments', { roomId: nRoom.id, documentIds: [deckDoc.id, termsDoc.id, dataDoc.id] });
  failNextSend = true;
  const first = await flushAfter(11);
  assert.equal(first.failed, 1);
  const second = await flushAfter(11);
  assert.equal(second.failed, 0);
  assert.deepEqual(recipients(), [inv1.email, inv2.email, inv4.email].sort());
  sent.length = 0;
});

test('opt-out stops update emails for that room but not the access-ended notice', async () => {
  await act(inv2, 'setRoomNotifications', { roomId: nRoom.id, enabled: false });
  const membership = await db.huRoomMembership.findFirstOrThrow({ where: { roomId: nRoom.id, userId: inv1.id } });
  assert.equal(await unsubscribe(membership.id, 'forged-token'), false);
  assert.equal((await db.huRoomMembership.findUniqueOrThrow({ where: { id: membership.id } })).notificationsMutedAt, null);
  assert.equal(await unsubscribe(membership.id, signature(membership.id)), true);
  const token = signature(membership.id);
  assert.equal(await optOutStatus(membership.id, 'forged-token'), null);
  assert.equal(await setOptOut(membership.id, 'forged-token', true), null);
  assert.deepEqual(await optOutStatus(membership.id, token), { room: 'SYNTHETIC Notify A', roomId: nRoom.id, subscribed: false });
  const mutedAt = (await db.huRoomMembership.findUniqueOrThrow({ where: { id: membership.id } })).notificationsMutedAt;
  assert.ok(mutedAt);
  assert.equal(await unsubscribe(membership.id, token), true, 'unsubscribing twice is harmless');
  assert.deepEqual((await db.huRoomMembership.findUniqueOrThrow({ where: { id: membership.id } })).notificationsMutedAt, mutedAt, 'keeps the first opt-out time');
  assert.deepEqual(await setOptOut(membership.id, token, true), { room: 'SYNTHETIC Notify A', roomId: nRoom.id, subscribed: true });
  assert.equal((await db.huRoomMembership.findUniqueOrThrow({ where: { id: membership.id } })).notificationsMutedAt, null);
  assert.deepEqual(await setOptOut(membership.id, token, false), { room: 'SYNTHETIC Notify A', roomId: nRoom.id, subscribed: false });
  await act(admin, 'setRoomDocuments', { roomId: nRoom.id, documentIds: [deckDoc.id] });
  await act(admin, 'setRoomDocuments', { roomId: nRoom.id, documentIds: [deckDoc.id, termsDoc.id] });
  await flushAfter(11);
  assert.deepEqual(recipients(), [inv4.email]);
  sent.length = 0;

  await act(admin, 'archiveRoom', { roomId: nRoom.id, archived: true });
  await act(admin, 'archiveRoom', { roomId: nRoom.id, archived: false });
  await flushAfter(11);
  assert.deepEqual(recipients(), [], 'archive undone before the batch: nothing ended');

  await act(admin, 'archiveRoom', { roomId: nRoom.id, archived: true });
  await flushAfter(11);
  assert.deepEqual(recipients(), [inv1.email, inv2.email, inv4.email].sort());
  assert.ok(sent.every(m => /has ended/.test(m.subject)));
  sent.length = 0;
});

after(async () => {
  // All fixtures are owned by this run's random team and users.
  await db.huInvestorRoom.deleteMany({ where: { teamId } });
  await db.document.deleteMany({ where: { teamId } });
  await db.huRoomStage.deleteMany({ where: { teamId } });
  await db.team.deleteMany({ where: { id: teamId } });
  await db.user.deleteMany({ where: { id: { in: [admin.id, admin2.id, investor.id, outsider.id, ...people.map(p => p.id)] } } });
  await db.$disconnect();
});
