import { pdfjs } from 'react-pdf';
import { action } from './client';
import { fileTypeFor, MAX_THUMBNAIL_BYTES, MAX_UPLOAD_BYTES, THUMBNAIL_MIME } from './file-types';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Browser-side upload: validate, make a small preview for PDFs and images, send the
// file straight to S3 with a presigned URL, then ask the server to verify and publish.
const THUMB_WIDTH = 320;

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(blob => resolve(blob), THUMBNAIL_MIME, 0.8));
}
function sizedCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, THUMB_WIDTH / width, (THUMB_WIDTH * 1.5) / height);
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (context) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
  return { canvas, context, scale };
}

async function imageThumbnail(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const { canvas, context } = sizedCanvas(bitmap.width, bitmap.height);
    context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvasToJpeg(canvas);
  } catch { return null; }
}

/** Page count, plus a JPEG of the first page when it can be drawn. */
async function readPdf(file: File): Promise<{ pages: number; thumbnail: Blob | null }> {
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await loading.promise;
    let thumbnail: Blob | null = null;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const { canvas, context, scale } = sizedCanvas(base.width, base.height);
      if (context) {
        await page.render({ canvas, canvasContext: context, viewport: page.getViewport({ scale }) }).promise;
        thumbnail = await canvasToJpeg(canvas);
      }
    } catch { thumbnail = null; }
    return { pages: pdf.numPages, thumbnail };
  } catch { throw new Error(`${file.name} is not a readable PDF.`); }
  finally { await loading.destroy(); }
}

export type UploadOptions = { name?: string; documentId?: string; stageId: string; folderId: string | null };

export async function uploadDocument(file: File, options: UploadOptions, progress: (step: string) => void = () => {}) {
  const type = fileTypeFor(file.name);
  if (!type) throw new Error(`${file.name}: this file type is not supported.`);
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: choose a file smaller than 100 MB.`);
  progress('Checking');
  let pages: number | null = null; let thumbnail: Blob | null = null;
  if (type.kind === 'pdf') ({ pages, thumbnail } = await readPdf(file));
  else if (type.kind === 'image') thumbnail = await imageThumbnail(file);
  if (thumbnail && thumbnail.size > MAX_THUMBNAIL_BYTES) thumbnail = null;
  const name = options.name?.trim() || file.name;
  const started = await action<{ versionId: string; contentType: string; uploadUrl: string; thumbnailUploadUrl: string | null }>('beginUpload', {
    name, fileName: file.name, stageId: options.stageId, folderId: options.folderId, size: file.size, thumbnailSize: thumbnail?.size ?? null,
    ...(options.documentId ? { documentId: options.documentId } : {}),
  });
  progress('Uploading');
  const response = await fetch(started.uploadUrl, { method: 'PUT', headers: { 'Content-Type': started.contentType }, body: file });
  if (!response.ok) throw new Error(`${file.name}: upload failed. Check your connection and try again.`);
  if (thumbnail && started.thumbnailUploadUrl) {
    // A failed preview upload is not fatal; the row then shows the file-type icon.
    await fetch(started.thumbnailUploadUrl, { method: 'PUT', headers: { 'Content-Type': THUMBNAIL_MIME }, body: thumbnail }).catch(() => null);
  }
  progress('Publishing');
  await action('publishUpload', { versionId: started.versionId, pages });
}
