// Database integration tests for investor-managed membership, downloads and MCP links.
// No email is sent (stubbed transport) and S3 is not touched.
// Run only against a disposable local PostgreSQL database with the schema applied.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const ts = require('typescript');

const url = new URL(process.env.POSTGRES_PRISMA_URL || 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
  throw new Error('Use a disposable localhost database whose name ends in _test.');
}
process.env.HORSEUP_TEAM_ID = `integration-${randomUUID()}`;
process.env.HORSEUP_ADMIN_EMAILS = 'dealroom-admin@example.test';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'integration-test-secret';
process.env.HORSEUP_EMAIL_FROM = 'noreply@example.test';
delete process.env.RESEND_API_KEY;
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const mail = require('../lib/mail.ts');
const sent = [];
mail.setMailTransport(async message => { sent.push(message); });
const { db } = require('../lib/db.ts');
const { flushNotifications } = require('../lib/notifications.ts');
const { performAction, ROOM_MEMBER_LIMIT } = require('../lib/actions.ts');
const { roomContext } = require('../lib/access.ts');
const { downloadableDocuments, recordDownloads, downloadLink, verifyDownloadToken, actorForUser, pdfFileName, uniqueNames, attachmentHeader } = require('../lib/downloads.ts');

const teamId = process.env.HORSEUP_TEAM_ID;
const person = (email = `${randomUUID()}@example.test`) => ({ id: randomUUID(), email, admin: false });
const admin = { id: randomUUID(), email: 'dealroom-admin@example.test', admin: true };
const lead = person(); const colleague = person(); const pending = person(); const outsider = person();
const users = [admin, lead, colleague, pending, outsider];
let intro, diligence, room, otherRoom, openDoc, laterDoc;
const act = (actor, action, values = {}) => performAction(actor, { action, ...values });
const denied = (promise, status) => assert.rejects(promise, error => error.status === status);
const flush = () => flushNotifications(new Date(Date.now() + 24 * 60 * 60 * 1000));
const membershipOf = (roomId, email) => db.huRoomMembership.findUniqueOrThrow({ where: { roomId_email: { roomId, email } } });
/** Simulates the email-link sign-in that accepts an invitation. */
async function signIn(actor, roomId) {
  await db.user.upsert({ where: { id: actor.id }, create: { id: actor.id, email: actor.email, emailVerified: new Date() }, update: {} });
  await act(actor, 'acceptInvitation', { roomId });
}

before(async () => {
  for (const actor of [admin, lead, outsider]) await db.user.create({ data: { id: actor.id, email: actor.email, emailVerified: new Date() } });
  await db.team.create({ data: { id: teamId, name: 'Synthetic integration fixtures', ignoredDomains: [], globalBlockList: [] } });
  intro = await act(admin, 'createStage', { name: 'Introduction' });
  diligence = await act(admin, 'createStage', { name: 'Diligence' });
  async function published(name, stageId) {
    const document = await db.document.create({ data: { name, file: `${name}.pdf`, teamId } });
    await db.documentVersion.create({ data: { documentId: document.id, versionNumber: 1, file: `${name}.pdf`, numPages: 2, fileSize: 1234, isPrimary: true, huS3VersionId: `v-${randomUUID()}` } });
    await act(admin, 'setDocumentStage', { documentId: document.id, stageId });
    return document;
  }
  openDoc = await published('SYNTHETIC Deck', intro.id);
  laterDoc = await published('SYNTHETIC Data Pack', diligence.id);
  room = await act(admin, 'createRoom', { name: 'SYNTHETIC Fund A', stageId: intro.id, documentIds: [openDoc.id, laterDoc.id] });
  otherRoom = await act(admin, 'createRoom', { name: 'SYNTHETIC Fund B', stageId: intro.id, documentIds: [openDoc.id] });
  await act(admin, 'invite', { roomId: room.id, emails: [lead.email] });
  await act(lead, 'acceptInvitation', { roomId: room.id });
  await flush(); sent.length = 0;
});

test('an accepted investor invites a colleague; the email names them and admins hear about it', async () => {
  await act(lead, 'invite', { roomId: room.id, emails: [colleague.email, pending.email, admin.email] });
  const invitation = await membershipOf(room.id, colleague.email);
  assert.equal(invitation.invitedById, lead.id);
  await assert.rejects(membershipOf(room.id, admin.email), 'admins are never invited as members');
  assert.deepEqual(sent.map(m => m.to).sort(), [colleague.email, pending.email].sort());
  assert.match(sent[0].text, new RegExp(`${lead.email.replace('.', '\\.')} has invited you to SYNTHETIC Fund A`));
  sent.length = 0;
  await flush();
  const digest = sent.find(m => m.to === admin.email);
  assert.ok(digest, 'admin digest sent');
  assert.match(digest.text, new RegExp(`invited ${colleague.email.replace('.', '\\.')}`));
  sent.length = 0;
  await signIn(colleague, room.id);
  await roomContext(db, colleague, room.id);
});

test('pending invitees and outsiders cannot invite; investors cannot invite to another room', async () => {
  await denied(act(pending, 'invite', { roomId: room.id, emails: [outsider.email] }), 404);
  await denied(act(outsider, 'invite', { roomId: room.id, emails: [person().email] }), 404);
  await denied(act(lead, 'invite', { roomId: otherRoom.id, emails: [outsider.email] }), 404);
});

test('investors invite at most ten people per request', async () => {
  const many = Array.from({ length: 11 }, () => person().email);
  await assert.rejects(act(lead, 'invite', { roomId: room.id, emails: many }), error => error.name === 'ZodError');
});

test('investors remove members of their own room only; admins hear about it', async () => {
  const other = await db.huRoomMembership.create({ data: { roomId: otherRoom.id, email: outsider.email, invitedById: admin.id } });
  await denied(act(lead, 'revokeMember', { roomId: room.id, membershipId: other.id }), 404);
  await denied(act(lead, 'revokeMember', { roomId: otherRoom.id, membershipId: other.id }), 404);

  const target = await membershipOf(room.id, colleague.email);
  await act(lead, 'revokeMember', { roomId: room.id, membershipId: target.id });
  const removed = await membershipOf(room.id, colleague.email);
  assert.ok(removed.revokedAt); assert.equal(removed.revokedById, lead.id);
  await denied(roomContext(db, colleague, room.id), 404);
  await flush();
  assert.match(sent.find(m => m.to === admin.email).text, new RegExp(`removed ${colleague.email.replace('.', '\\.')}`));
  assert.ok(sent.some(m => m.to === colleague.email && /has ended/.test(m.subject)), 'the removed colleague is told access ended');
  sent.length = 0;
});

test('investors can re-invite someone an investor removed, never someone HorseUp removed', async () => {
  await act(lead, 'invite', { roomId: room.id, emails: [colleague.email] });
  assert.equal((await membershipOf(room.id, colleague.email)).revokedAt, null);
  await act(admin, 'revokeMember', { roomId: room.id, membershipId: (await membershipOf(room.id, colleague.email)).id });
  await denied(act(lead, 'invite', { roomId: room.id, emails: [colleague.email] }), 403);
  await act(admin, 'invite', { roomId: room.id, emails: [colleague.email] });
  assert.equal((await membershipOf(room.id, colleague.email)).revokedById, null);
  sent.length = 0;
});

test('a room accepts at most the member limit from investor invitations', async () => {
  const open = await db.huRoomMembership.count({ where: { roomId: room.id, revokedAt: null } });
  const fill = Array.from({ length: ROOM_MEMBER_LIMIT - open }, () => person().email);
  for (let i = 0; i < fill.length; i += 10) await act(lead, 'invite', { roomId: room.id, emails: fill.slice(i, i + 10) });
  await denied(act(lead, 'invite', { roomId: room.id, emails: [person().email] }), 400);
  // Resending to someone already invited does not count as a new member.
  await act(lead, 'invite', { roomId: room.id, emails: [fill[0]] });
  await db.huRoomMembership.updateMany({ where: { roomId: room.id, email: { in: fill } }, data: { revokedAt: new Date(), revokedById: lead.id } });
  sent.length = 0;
});

test('downloads list only documents the room stage allows, and record investor downloads only', async () => {
  const forLead = await downloadableDocuments(lead, room.id);
  assert.deepEqual(forLead.documents.map(d => d.name), ['SYNTHETIC Deck']);
  const forAdmin = await downloadableDocuments(admin, room.id);
  assert.deepEqual(forAdmin.documents.map(d => d.name).sort(), ['SYNTHETIC Data Pack', 'SYNTHETIC Deck']);
  await denied(downloadableDocuments(outsider, room.id), 404);

  await act(admin, 'setRoomStage', { roomId: room.id, stageId: diligence.id });
  assert.equal((await downloadableDocuments(lead, room.id)).documents.length, 2);

  await recordDownloads(lead, room.id, forLead.documents, false, 'WEB');
  await recordDownloads(admin, room.id, forAdmin.documents, true, 'WEB');
  const all = (await downloadableDocuments(lead, room.id)).documents;
  await recordDownloads(lead, room.id, all, true, 'MCP');
  const rows = await db.huRoomDownload.findMany({ where: { roomId: room.id }, orderBy: { createdAt: 'asc' } });
  assert.equal(rows.length, 3);
  assert.ok(rows.every(r => r.userId === lead.id));
  assert.deepEqual(rows.map(r => [r.bulk, r.channel]), [[false, 'WEB'], [true, 'MCP'], [true, 'MCP']]);
});

test('download links are bound to user, room and document, expire, and resist tampering', async () => {
  const link = downloadLink(lead.id, room.id, openDoc.id);
  const token = new URL(link.url).searchParams.get('token');
  assert.deepEqual(verifyDownloadToken(token), { u: lead.id, r: room.id, d: openDoc.id, x: Math.floor(Date.parse(link.expiresAt) / 1000) });
  assert.equal(verifyDownloadToken(token, Date.now() + 11 * 60 * 1000), null, 'expired after ten minutes');
  const [payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), u: outsider.id })).toString('base64url');
  assert.equal(verifyDownloadToken(`${forged}.${signature}`), null);
  assert.equal(verifyDownloadToken(`${payload}.${signature}x`), null);
  assert.equal(verifyDownloadToken('garbage'), null);
  // A valid link still re-checks access when used: a removed member gets nothing.
  const actor = await actorForUser(lead.id);
  await downloadableDocuments(actor, room.id);
  await act(admin, 'revokeMember', { roomId: room.id, membershipId: (await membershipOf(room.id, lead.email)).id });
  await denied(downloadableDocuments(await actorForUser(lead.id), room.id), 404);
  await act(admin, 'invite', { roomId: room.id, emails: [lead.email] });
  await act(lead, 'acceptInvitation', { roomId: room.id });
  await flush(); sent.length = 0;
});

test('an investor can leave the room; admins read it as leaving', async () => {
  await act(lead, 'revokeMember', { roomId: room.id, membershipId: (await membershipOf(room.id, lead.email)).id });
  await denied(roomContext(db, lead, room.id), 404);
  await flush();
  assert.match(sent.find(m => m.to === admin.email).text, /left the room/);
  assert.ok(!sent.some(m => m.to === lead.email), 'the person who left gets no access-ended email');
  sent.length = 0;
});

test('file names are safe and unique; headers carry an ASCII fallback', () => {
  assert.equal(pdfFileName('Q3 / Q4 "Plan": final?'), 'Q3 - Q4 -Plan-- final-.pdf');
  assert.equal(pdfFileName('...'), 'document.pdf');
  assert.equal(pdfFileName('Deck.PDF'), 'Deck.PDF');
  assert.deepEqual(uniqueNames(['a.pdf', 'A.pdf', 'a.pdf']), ['a.pdf', 'A (2).pdf', 'a (3).pdf']);
  assert.equal(attachmentHeader('Übersicht.pdf'), `attachment; filename="Ubersicht.pdf"; filename*=UTF-8''${encodeURIComponent('Übersicht.pdf')}`);
});

after(async () => {
  await db.huInvestorRoom.deleteMany({ where: { teamId } });
  await db.document.deleteMany({ where: { teamId } });
  await db.huRoomStage.deleteMany({ where: { teamId } });
  await db.team.deleteMany({ where: { id: teamId } });
  await db.huNotification.deleteMany({ where: { teamId } });
  await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  await db.$disconnect();
});
