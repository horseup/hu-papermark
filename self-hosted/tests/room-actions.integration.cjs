// Database integration tests. These do not send email, access AWS, or drive UI.
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
process.env.HORSEUP_ADMIN_EMAILS = 'admin@example.test';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
// Compile the real server modules without adding a test-runner dependency.
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const { db } = require('../lib/db.ts');
const { performAction } = require('../lib/actions.ts');
const { roomContext, documentAccess } = require('../lib/access.ts');
const teamId = process.env.HORSEUP_TEAM_ID;
const admin = { id: randomUUID(), email: 'admin@example.test', admin: true };
const investor = { id: randomUUID(), email: `${randomUUID()}@example.test`, admin: false };
const outsider = { id: randomUUID(), email: `${randomUUID()}@example.test`, admin: false };
let intro, diligence, room, otherRoom, doc, version, draft, membership;
const act = (actor, action, values = {}) => performAction(actor, { action, ...values });
const denied = (promise, status) => assert.rejects(promise, error => error.status === status);

before(async () => {
  for (const actor of [admin, investor, outsider]) await db.user.create({ data: { id: actor.id, email: actor.email, emailVerified: new Date() } });
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

test('revocation and room archive immediately remove access', async () => {
  await act(admin, 'archiveRoom', { roomId: room.id, archived: true });
  await denied(roomContext(db, investor, room.id), 404);
  await act(admin, 'archiveRoom', { roomId: room.id, archived: false });
  await act(admin, 'revokeMember', { roomId: room.id, membershipId: membership.id });
  await denied(roomContext(db, investor, room.id), 404);
  await denied(act(investor, 'acceptInvitation', { roomId: room.id }), 404);
});

after(async () => {
  // All fixtures are owned by this run's random team and users.
  await db.huInvestorRoom.deleteMany({ where: { teamId } });
  await db.document.deleteMany({ where: { teamId } });
  await db.huRoomStage.deleteMany({ where: { teamId } });
  await db.team.deleteMany({ where: { id: teamId } });
  await db.user.deleteMany({ where: { id: { in: [admin.id, investor.id, outsider.id] } } });
  await db.$disconnect();
});
