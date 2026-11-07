// Database integration tests for the HorseUp MCP's internal endpoints
// (/api/internal/mcp/investor-documents and /api/internal/mcp/access-requests).
// No email is sent (stubbed transport) and S3 is not touched.
// Run only against a disposable local PostgreSQL database with the schema applied.
const { test, before, beforeEach, after } = require('node:test');
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
const TOKEN = 'mcp-service-token-for-tests-0123456789';
process.env.HORSEUP_MCP_SERVICE_TOKEN = TOKEN;
delete process.env.RESEND_API_KEY;
delete process.env.HORSEUP_INVESTOR_REPLY_TO;
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const mail = require('../lib/mail.ts');
const sent = [];
let failMail = false;
mail.setMailTransport(async message => { if (failMail) throw new Error('synthetic delivery failure'); sent.push(message); });
const { db } = require('../lib/db.ts');
const { flushNotifications } = require('../lib/notifications.ts');
const { performAction } = require('../lib/actions.ts');
const { verifyDownloadToken } = require('../lib/downloads.ts');
const { resetRateLimits } = require('../lib/internal-mcp.ts');
const documentsHandler = require('../pages/api/internal/mcp/investor-documents.ts').default;
const requestsHandler = require('../pages/api/internal/mcp/access-requests.ts').default;

const teamId = process.env.HORSEUP_TEAM_ID;
const person = (email = `${randomUUID()}@example.test`) => ({ id: randomUUID(), email, admin: false });
const admin = { id: randomUUID(), email: 'dealroom-admin@example.test', admin: true };
const member = person(); const pending = person(); const removed = person(); const outsider = person();
let intro, room, openDoc, laterDoc;
const act = (actor, action, values = {}) => performAction(actor, { action, ...values });
const flush = () => flushNotifications(new Date(Date.now() + 24 * 60 * 60 * 1000));

/** Calls a pages/api handler with a minimal request and response. */
async function call(handler, { method = 'GET', email, token = TOKEN, body } = {}) {
  const req = {
    method,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    query: email === undefined ? {} : { email },
    body: body ?? (method === 'POST' ? { email } : undefined),
  };
  const res = {
    statusCode: 200, body: undefined, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end() { return this; },
  };
  await handler(req, res);
  return res;
}
const documents = options => call(documentsHandler, options);
const accessRequest = options => call(requestsHandler, { method: 'POST', ...options });

before(async () => {
  for (const actor of [admin, member, pending, removed, outsider]) await db.user.create({ data: { id: actor.id, email: actor.email, emailVerified: new Date() } });
  await db.team.create({ data: { id: teamId, name: 'Synthetic integration fixtures', ignoredDomains: [], globalBlockList: [] } });
  intro = await act(admin, 'createStage', { name: 'Introduction' });
  const diligence = await act(admin, 'createStage', { name: 'Diligence' });
  async function published(name, stageId) {
    const document = await db.document.create({ data: { name, file: `${name}.pdf`, teamId } });
    await db.documentVersion.create({ data: { documentId: document.id, versionNumber: 1, file: `${name}.pdf`, numPages: 2, fileSize: 1234, isPrimary: true, huS3VersionId: `v-${randomUUID()}` } });
    await act(admin, 'setDocumentStage', { documentId: document.id, stageId });
    return document;
  }
  openDoc = await published('SYNTHETIC Deck', intro.id);
  laterDoc = await published('SYNTHETIC Data Pack', diligence.id);
  room = await act(admin, 'createRoom', { name: 'SYNTHETIC Fund A', stageId: intro.id, documentIds: [openDoc.id, laterDoc.id] });
  await act(admin, 'invite', { roomId: room.id, emails: [member.email, pending.email, removed.email] });
  await act(member, 'acceptInvitation', { roomId: room.id });
  await act(removed, 'acceptInvitation', { roomId: room.id });
  const removedMembership = await db.huRoomMembership.findUniqueOrThrow({ where: { roomId_email: { roomId: room.id, email: removed.email } } });
  await act(admin, 'revokeMember', { roomId: room.id, membershipId: removedMembership.id });
  await flush();
});

beforeEach(() => { sent.length = 0; failMail = false; resetRateLimits(); });

after(async () => {
  await db.huMcpAccessRequest.deleteMany({ where: { teamId } });
  await db.huInvestorRoom.deleteMany({ where: { teamId } });
  await db.document.deleteMany({ where: { teamId } });
  await db.huRoomStage.deleteMany({ where: { teamId } });
  await db.team.deleteMany({ where: { id: teamId } });
  await db.huNotification.deleteMany({ where: { teamId } });
  await db.user.deleteMany({ where: { id: { in: [admin, member, pending, removed, outsider].map(u => u.id) } } });
  await db.$disconnect();
});

test('every request needs the shared service token; an unset token refuses everything', async () => {
  assert.equal((await documents({ email: member.email, token: null })).statusCode, 401);
  assert.equal((await documents({ email: member.email, token: 'wrong-token-but-long-enough-0123456789' })).statusCode, 401);
  assert.equal((await accessRequest({ email: outsider.email, token: null })).statusCode, 401);
  assert.equal((await documents({ email: member.email, method: 'POST' })).statusCode, 405);
  process.env.HORSEUP_MCP_SERVICE_TOKEN = 'short';
  try {
    assert.equal((await documents({ email: member.email })).statusCode, 503);
    assert.equal((await documents({ email: member.email, token: 'short' })).statusCode, 503, 'a too-short token is never accepted');
  } finally { process.env.HORSEUP_MCP_SERVICE_TOKEN = TOKEN; }
  assert.equal((await documents({ email: 'not an email' })).statusCode, 400);
  assert.equal(sent.length, 0);
});

test('an accepted member gets their room, stage and only the documents the stage unlocks', async () => {
  const res = await documents({ email: `  ${member.email.toUpperCase()} ` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.equal(res.body.member, true);
  assert.equal(res.body.rooms.length, 1);
  const [only] = res.body.rooms;
  assert.equal(only.id, room.id);
  assert.equal(only.stage, 'Introduction');
  assert.deepEqual(only.documents.map(d => d.id), [openDoc.id], 'the diligence document stays hidden');
  assert.ok(!only.documents.some(d => d.id === laterDoc.id));
  const [doc] = only.documents;
  assert.equal(doc.name, 'SYNTHETIC Deck.pdf');
  assert.equal(doc.type, 'pdf');
  const claims = verifyDownloadToken(new URL(doc.url).searchParams.get('token'));
  assert.deepEqual({ u: claims.u, r: claims.r, d: claims.d }, { u: member.id, r: room.id, d: openDoc.id }, 'the link is bound to the member');
  const minutes = (Date.parse(doc.expiresAt) - Date.now()) / 60000;
  assert.ok(minutes > 9 && minutes <= 10, 'links last ten minutes');
});

test('pending, removed, unknown and never-invited emails are not members', async () => {
  for (const email of [pending.email, removed.email, outsider.email, 'never-seen@example.test']) {
    const res = await documents({ email });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { member: false }, email);
  }
});

test('investors@ hears once about a verified non-member; members are never reported', async () => {
  const first = await accessRequest({ email: outsider.email });
  assert.equal(first.statusCode, 202);
  assert.deepEqual(first.body, { notified: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'investors@horseup.de');
  assert.match(sent[0].subject, new RegExp(outsider.email.replace('.', '\\.')));
  assert.match(sent[0].text, /not a member of any investor room/);
  const again = await accessRequest({ email: outsider.email.toUpperCase() });
  assert.equal(again.statusCode, 200);
  assert.deepEqual(again.body, { notified: false });
  assert.equal(sent.length, 1, 'deduplicated in the database');
  const asMember = await accessRequest({ email: member.email });
  assert.deepEqual(asMember.body, { member: true });
  assert.equal(sent.length, 1);
  assert.equal(await db.huMcpAccessRequest.count({ where: { teamId, email: member.email } }), 0);
});

test('a failed notification is retried on the next request instead of being lost', async () => {
  const email = `retry-${randomUUID()}@example.test`;
  failMail = true;
  assert.equal((await accessRequest({ email })).statusCode, 500);
  const row = await db.huMcpAccessRequest.findUniqueOrThrow({ where: { teamId_email: { teamId, email } } });
  assert.equal(row.notifiedAt, null);
  failMail = false;
  assert.deepEqual((await accessRequest({ email })).body, { notified: true });
  assert.equal(sent.length, 1);
});

test('requests are rate limited per email', async () => {
  for (let i = 0; i < 30; i++) assert.equal((await documents({ email: outsider.email })).statusCode, 200);
  assert.equal((await documents({ email: outsider.email })).statusCode, 429);
  assert.equal((await documents({ email: member.email })).statusCode, 200, 'other emails are unaffected');
});
