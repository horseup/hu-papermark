// Unit tests for upload type rules and folder helpers. No database, network or S3.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const types = require('../lib/file-types.ts');
const { foldersLeadingTo, folderPath } = require('../lib/folders.ts');

const bytes = (...values) => Uint8Array.from(values);
const text = value => new TextEncoder().encode(value);

test('only listed extensions are accepted, case-insensitively', () => {
  assert.equal(types.fileTypeFor('Model.XLSX').ext, 'xlsx');
  assert.equal(types.fileTypeFor('deck.pptx').kind, 'slides');
  assert.equal(types.fileTypeFor('photo.jpeg').mime, 'image/jpeg');
  for (const name of ['logo.svg', 'page.html', 'run.exe', 'archive.zip', 'noextension', 'a.pdf.js']) assert.equal(types.fileTypeFor(name), null, name);
  assert.equal(types.fileTypeByExt('unknown').ext, 'pdf');
  assert.ok(!types.ACCEPT.includes('.svg') && types.ACCEPT.includes('.xlsx'));
});

test('file signatures must match the extension', () => {
  const pdf = types.fileTypeFor('a.pdf'); const xlsx = types.fileTypeFor('a.xlsx'); const xls = types.fileTypeFor('a.xls');
  const png = types.fileTypeFor('a.png'); const webp = types.fileTypeFor('a.webp'); const csv = types.fileTypeFor('a.csv');
  assert.ok(types.matchesSignature(pdf, text('%PDF-1.7')));
  assert.ok(!types.matchesSignature(pdf, text('<html>')));
  assert.ok(types.matchesSignature(xlsx, bytes(0x50, 0x4b, 0x03, 0x04, 0x14)));
  assert.ok(!types.matchesSignature(xlsx, text('%PDF-')));
  assert.ok(types.matchesSignature(xls, bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)));
  assert.ok(types.matchesSignature(png, bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)));
  assert.ok(types.matchesSignature(webp, Uint8Array.from([...text('RIFF'), 0, 0, 0, 0, ...text('WEBP')])));
  assert.ok(!types.matchesSignature(webp, Uint8Array.from([...text('RIFF'), 0, 0, 0, 0, ...text('WAVE')])));
  assert.ok(types.matchesSignature(csv, text('year,value\n2027,1\n')));
  assert.ok(!types.matchesSignature(csv, bytes(0x41, 0x00, 0x42)));
});

test('download names get the right extension and stay safe', () => {
  assert.equal(types.downloadFileName('Financial model', 'xlsx'), 'Financial model.xlsx');
  assert.equal(types.downloadFileName('Model.XLSX', 'xlsx'), 'Model.XLSX');
  assert.equal(types.downloadFileName('Q3 / Q4 "Plan": final?', 'pdf'), 'Q3 - Q4 -Plan-- final-.pdf');
  assert.equal(types.downloadFileName('...', 'docx'), 'document.docx');
  assert.equal(types.formatBytes(0), '–');
  assert.equal(types.formatBytes(2048), '2 KB');
  assert.equal(types.formatBytes(1.5 * 1024 * 1024), '1.5 MB');
});

test('rooms only see folders that lead to a readable document', () => {
  const folders = [
    { id: 'a', name: 'Finance', parentId: null },
    { id: 'b', name: 'Monthly', parentId: 'a' },
    { id: 'c', name: 'Legal', parentId: null },
    { id: 'd', name: 'Empty', parentId: 'a' },
  ];
  assert.deepEqual(foldersLeadingTo(folders, ['b']).map(f => f.id).sort(), ['a', 'b']);
  assert.deepEqual(foldersLeadingTo(folders, []), []);
  assert.equal(folderPath(folders, 'b'), 'Finance/Monthly');
  assert.equal(folderPath(folders, null), '');
  assert.equal(folderPath([{ id: 'x', name: 'A/B: "C"', parentId: null }], 'x'), 'A-B- -C-');
});
