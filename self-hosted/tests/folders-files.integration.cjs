// Database integration tests for the shared folder tree, non-PDF uploads and the invite batch limit.
// No email, AWS or UI: presigned URLs are computed offline with dummy credentials and never used.
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
process.env.NEXTAUTH_SECRET = 'integration-test-secret';
process.env.AWS_REGION = 'eu-central-1';
process.env.HORSEUP_S3_BUCKET = 'synthetic-bucket';
process.env.AWS_ACCESS_KEY_ID = 'AKIASYNTHETICTEST000';
process.env.AWS_SECRET_ACCESS_KEY = 'synthetic-secret-for-offline-presigning';
delete process.env.RESEND_API_KEY;
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const mail = require('../lib/mail.ts');
mail.setMailTransport(async () => {});
const { db } = require('../lib/db.ts');
const { performAction } = require('../lib/actions.ts');
const { downloadableDocuments } = require('../lib/downloads.ts');
const teamId = process.env.HORSEUP_TEAM_ID;
const admin = { id: randomUUID(), email: 'admin@example.test', admin: true };
const investor = { id: randomUUID(), email: `${randomUUID()}@example.test`, admin: false };
const act = (actor, action, values = {}) => performAction(actor, { action, ...values });
const status = code => error => error.status === code;
let stage, room;

before(async () => {
  for (const actor of [admin, investor]) await db.user.create({ data: { id: actor.id, email: actor.email, emailVerified: new Date() } });
  await db.team.create({ data: { id: teamId, name: 'Synthetic folder fixtures', ignoredDomains: [], globalBlockList: [] } });
  stage = await act(admin, 'createStage', { name: 'Introduction' });
  room = await act(admin, 'createRoom', { name: 'Investor F', stageId: stage.id, documentIds: [] });
  await db.huRoomMembership.create({ data: { roomId: room.id, email: investor.email, userId: investor.id, invitedById: admin.id, acceptedAt: new Date() } });
});
after(async () => {
  await db.huRoomDiscussion.deleteMany({ where: { teamId } });
  await db.huInvestorRoom.deleteMany({ where: { teamId } });
  await db.huDocumentFolder.deleteMany({ where: { teamId } });
  await db.huDocumentAccess.deleteMany({ where: { teamId } });
  await db.document.deleteMany({ where: { teamId } });
  for (let left = await db.huFolder.count({ where: { teamId } }); left; left = await db.huFolder.count({ where: { teamId } })) {
    await db.huFolder.deleteMany({ where: { teamId, children: { none: {} } } });
  }
  await db.huRoomStage.deleteMany({ where: { teamId } });
  await db.team.delete({ where: { id: teamId } });
  await db.user.deleteMany({ where: { id: { in: [admin.id, investor.id] } } });
  await db.$disconnect();
});

async function publishedDocument(name, type, folderId) {
  const document = await db.document.create({ data: { name, teamId, file: `${name}.${type}`, type } });
  const version = await db.documentVersion.create({ data: { documentId: document.id, versionNumber: 1, file: `${name}.${type}`, type, fileSize: 2048, isPrimary: true, huS3VersionId: `v-${randomUUID()}`, numPages: type === 'pdf' ? 2 : null } });
  await act(admin, 'setDocumentStage', { documentId: document.id, stageId: stage.id });
  if (folderId) await act(admin, 'setDocumentFolder', { documentId: document.id, folderId });
  return { document, version };
}

test('folders: create, unique sibling names, rename, move without loops', async () => {
  const finance = await act(admin, 'createFolder', { name: 'Finance' });
  const monthly = await act(admin, 'createFolder', { name: 'Monthly', parentId: finance.id });
  await assert.rejects(act(admin, 'createFolder', { name: 'finance' }), status(409));
  await act(admin, 'createFolder', { name: 'Monthly' }); // same name at another level is fine
  await assert.rejects(act(investor, 'createFolder', { name: 'Nope' }), status(403));
  await assert.rejects(act(admin, 'moveFolder', { folderId: finance.id, parentId: monthly.id }), status(400));
  await assert.rejects(act(admin, 'moveFolder', { folderId: finance.id, parentId: finance.id }), status(400));
  await assert.rejects(act(admin, 'moveFolder', { folderId: monthly.id, parentId: null }), status(409));
  const renamed = await act(admin, 'renameFolder', { folderId: monthly.id, name: 'Monthly actuals' });
  assert.equal(renamed.name, 'Monthly actuals');
  await act(admin, 'moveFolder', { folderId: monthly.id, parentId: null });
  assert.equal((await db.huFolder.findUnique({ where: { id: monthly.id } })).parentId, null);
});

test('deleting a folder moves its documents and subfolders up one level', async () => {
  const outer = await act(admin, 'createFolder', { name: 'Legal' });
  const inner = await act(admin, 'createFolder', { name: 'Contracts', parentId: outer.id });
  const deeper = await act(admin, 'createFolder', { name: 'Signed', parentId: inner.id });
  const { document } = await publishedDocument('Synthetic contract', 'pdf', inner.id);
  await act(admin, 'deleteFolder', { folderId: inner.id });
  assert.equal((await db.huDocumentFolder.findUnique({ where: { documentId: document.id } })).folderId, outer.id);
  assert.equal((await db.huFolder.findUnique({ where: { id: deeper.id } })).parentId, outer.id);
  await act(admin, 'deleteFolder', { folderId: outer.id });
  assert.equal(await db.huDocumentFolder.findUnique({ where: { documentId: document.id } }), null);
  assert.equal((await db.huFolder.findUnique({ where: { id: deeper.id } })).parentId, null);
});

test('beginUpload accepts office files, keeps the extension and places new documents', async () => {
  const folder = await act(admin, 'createFolder', { name: 'Models' });
  const sheet = await act(admin, 'beginUpload', { name: 'Synthetic model', fileName: 'model.xlsx', stageId: stage.id, folderId: folder.id, size: 1000, thumbnailSize: 500 });
  assert.equal(sheet.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(sheet.thumbnailUploadUrl, null, 'spreadsheets get no thumbnail upload');
  const version = await db.documentVersion.findUnique({ where: { id: sheet.versionId } });
  assert.equal(version.type, 'xlsx'); assert.match(version.file, /\.xlsx$/); assert.equal(version.huS3VersionId, null);
  assert.equal((await db.huDocumentFolder.findUnique({ where: { documentId: sheet.documentId } })).folderId, folder.id);
  const pdf = await act(admin, 'beginUpload', { name: 'Synthetic deck', fileName: 'deck.pdf', stageId: stage.id, size: 1000, thumbnailSize: 500 });
  assert.ok(pdf.thumbnailUploadUrl, 'PDFs get a thumbnail upload URL');
  await assert.rejects(act(admin, 'beginUpload', { name: 'Script', fileName: 'logo.svg', stageId: stage.id, size: 10 }), status(400));
  await assert.rejects(act(admin, 'beginUpload', { name: 'Big', fileName: 'big.pdf', stageId: stage.id, size: 101 * 1024 * 1024 }));
  await assert.rejects(act(investor, 'beginUpload', { name: 'X', fileName: 'x.pdf', stageId: stage.id, size: 10 }), status(403));
});

test('downloads use each file type; discussions on non-PDFs have no page', async () => {
  const folder = await act(admin, 'createFolder', { name: 'Data' });
  const { document: sheet, version } = await publishedDocument('Synthetic actuals', 'xlsx', folder.id);
  await act(admin, 'setRoomDocuments', { roomId: room.id, documentIds: [sheet.id] });
  const { documents } = await downloadableDocuments(investor, room.id);
  const entry = documents.find(d => d.id === sheet.id);
  assert.equal(entry.fileName, 'Synthetic actuals.xlsx');
  assert.equal(entry.contentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await act(investor, 'createDiscussion', { roomId: room.id, title: 'Question', body: 'Which tab?', documentId: sheet.id, versionId: version.id, pageNumber: null, requestId: randomUUID() });
  await assert.rejects(act(investor, 'createDiscussion', { roomId: room.id, title: 'Q', body: 'Page?', documentId: sheet.id, versionId: version.id, pageNumber: 1, requestId: randomUUID() }), status(400));
});

test('everyone invites at most 10 people at once', async () => {
  const eleven = Array.from({ length: 11 }, () => `${randomUUID()}@example.test`);
  await assert.rejects(act(admin, 'invite', { roomId: room.id, emails: eleven }));
  const result = await act(admin, 'invite', { roomId: room.id, emails: eleven.slice(0, 10) });
  assert.equal(result.invited, 10);
});
