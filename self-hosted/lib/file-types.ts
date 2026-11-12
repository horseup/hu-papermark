// Upload types the deal room accepts. Shared by the browser (accept list, upload
// headers, preview choice) and the server (validation), so it imports nothing.
// SVG and HTML are deliberately absent: both can carry script.

export type FileKind = 'pdf' | 'sheet' | 'document' | 'slides' | 'image' | 'text';
type Signature = 'pdf' | 'zip' | 'ole' | 'jpeg' | 'png' | 'gif' | 'webp' | 'text';
export type FileType = { ext: string; mime: string; kind: FileKind; label: string; signature: Signature };

const ZIP_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ZIP_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ZIP_PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const FILE_TYPES: FileType[] = [
  { ext: 'pdf', mime: 'application/pdf', kind: 'pdf', label: 'PDF document', signature: 'pdf' },
  { ext: 'docx', mime: ZIP_DOCX, kind: 'document', label: 'Word document', signature: 'zip' },
  { ext: 'doc', mime: 'application/msword', kind: 'document', label: 'Word document', signature: 'ole' },
  { ext: 'xlsx', mime: ZIP_XLSX, kind: 'sheet', label: 'Excel spreadsheet', signature: 'zip' },
  { ext: 'xls', mime: 'application/vnd.ms-excel', kind: 'sheet', label: 'Excel spreadsheet', signature: 'ole' },
  { ext: 'csv', mime: 'text/csv', kind: 'sheet', label: 'CSV file', signature: 'text' },
  { ext: 'pptx', mime: ZIP_PPTX, kind: 'slides', label: 'PowerPoint presentation', signature: 'zip' },
  { ext: 'ppt', mime: 'application/vnd.ms-powerpoint', kind: 'slides', label: 'PowerPoint presentation', signature: 'ole' },
  { ext: 'txt', mime: 'text/plain', kind: 'text', label: 'Text file', signature: 'text' },
  { ext: 'md', mime: 'text/markdown', kind: 'text', label: 'Markdown file', signature: 'text' },
  { ext: 'jpg', mime: 'image/jpeg', kind: 'image', label: 'JPEG image', signature: 'jpeg' },
  { ext: 'jpeg', mime: 'image/jpeg', kind: 'image', label: 'JPEG image', signature: 'jpeg' },
  { ext: 'png', mime: 'image/png', kind: 'image', label: 'PNG image', signature: 'png' },
  { ext: 'gif', mime: 'image/gif', kind: 'image', label: 'GIF image', signature: 'gif' },
  { ext: 'webp', mime: 'image/webp', kind: 'image', label: 'WebP image', signature: 'webp' },
];

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 512 * 1024;
export const THUMBNAIL_MIME = 'image/jpeg';
/** Bytes to read from the start of an upload to check its signature. */
export const SIGNATURE_BYTES = 512;

/** The `accept` attribute for upload inputs. */
export const ACCEPT = FILE_TYPES.map(t => `.${t.ext}`).join(',');
/** Short list for help text, e.g. "PDF, DOCX, …". */
export const ACCEPT_LABEL = [...new Set(FILE_TYPES.filter(t => t.ext !== 'jpeg').map(t => t.ext.toUpperCase()))].join(', ');

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}
export function fileTypeFor(fileName: string): FileType | null {
  const ext = extensionOf(fileName);
  return FILE_TYPES.find(t => t.ext === ext) ?? null;
}
export function fileTypeByExt(ext: string | null | undefined): FileType {
  return FILE_TYPES.find(t => t.ext === (ext || '').toLowerCase()) ?? FILE_TYPES[0];
}
/** Kinds that need a preview image made at upload. */
export function wantsThumbnail(kind: FileKind) { return kind === 'pdf' || kind === 'image'; }

/** True when the first bytes of a file match what its extension promises. */
export function matchesSignature(type: FileType, head: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (type.signature) {
    case 'pdf': return starts(0x25, 0x50, 0x44, 0x46, 0x2d);
    case 'zip': return starts(0x50, 0x4b, 0x03, 0x04);
    case 'ole': return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case 'jpeg': return starts(0xff, 0xd8, 0xff);
    case 'png': return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'gif': return starts(0x47, 0x49, 0x46, 0x38);
    case 'webp': return starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    // Plain text: no NUL bytes in the sample. An empty file is fine.
    case 'text': return !head.includes(0);
  }
}

/** A download name: the document title with the right extension, safe on every OS. */
export function downloadFileName(name: string, ext: string) {
  // eslint-disable-next-line no-control-regex
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 150).trim() || 'document';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

export function formatBytes(bytes: number | string | null | undefined) {
  const n = Number(bytes ?? 0);
  if (!n) return '–';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
