import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { NextApiResponse } from 'next';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ZipArchive } from 'archiver';
import type { HuDownloadChannel } from '@prisma/client';
import { canReadRoomDocument } from '../../lib/horseup/rooms/access-policy';
import { type Actor, HttpError, roomContext } from './access';
import { adminEmails, appUrl, teamId } from './config';
import { downloadFileName, fileTypeByExt } from './file-types';
import { db } from './db';
import { storage } from './storage';

// Room members download every document they can read: one PDF, or a ZIP of the
// whole room. Access is re-checked on every request, links from the MCP
// connector included, and every investor download is recorded.

export type DownloadableDocument = {
  id: string; name: string; versionId: string; versionNumber: number; numPages: number | null;
  fileSize: bigint; key: string; s3VersionId: string;
  /** File extension and MIME type of the published version. */
  ext: string; contentType: string; fileName: string;
};

/** The published documents this actor can read in the room, by name. Throws 404 when the room is not accessible. */
export async function downloadableDocuments(actor: Actor, roomId: string) {
  const state = await roomContext(db, actor, roomId);
  const documents = await db.document.findMany({ where: { teamId, huDeletedAt: null, huRoomSelections: { some: { roomId } } }, select: {
    id: true, name: true, huAccessRule: { select: { minimumStageId: true } },
    versions: { where: { isPrimary: true, huS3VersionId: { not: null } }, orderBy: { versionNumber: 'desc' }, take: 1,
      select: { id: true, versionNumber: true, numPages: true, fileSize: true, file: true, huS3VersionId: true, type: true } },
  }, orderBy: { name: 'asc' } });
  const readable: DownloadableDocument[] = [];
  for (const d of documents) {
    const version = d.versions[0];
    if (!version?.huS3VersionId) continue;
    if (!actor.admin && !canReadRoomDocument(state.context, { id: d.id, teamId, minimumStageId: d.huAccessRule?.minimumStageId ?? null }, { roomId, documentId: d.id })) continue;
    const type = fileTypeByExt(version.type);
    readable.push({ id: d.id, name: d.name, versionId: version.id, versionNumber: version.versionNumber, numPages: version.numPages,
      fileSize: version.fileSize ?? BigInt(0), key: version.file, s3VersionId: version.huS3VersionId,
      ext: type.ext, contentType: type.mime, fileName: downloadFileName(d.name, type.ext) });
  }
  return { room: state.room, documents: readable };
}

/** Administrators' own downloads are not recorded, the same as their visits. */
export async function recordDownloads(actor: Actor, roomId: string, documents: DownloadableDocument[], bulk: boolean, channel: HuDownloadChannel) {
  if (actor.admin || !documents.length) return;
  await db.huRoomDownload.createMany({ data: documents.map(d => ({ roomId, teamId, userId: actor.id, documentId: d.id, documentVersionId: d.versionId, bulk, channel })) });
}

/** A PDF file name that is safe on every OS. Keeps Unicode; the header carries an ASCII fallback. */
export function pdfFileName(name: string) { return downloadFileName(name, 'pdf'); }
export function uniqueNames(names: string[]) {
  const used = new Set<string>();
  return names.map(name => {
    let candidate = name; let n = 2;
    while (used.has(candidate.toLowerCase())) candidate = name.replace(/(\.[^.]+)?$/, ext => ` (${n++})${ext}`);
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
export function attachmentHeader(fileName: string) {
  const ascii = fileName.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim() || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function objectStream(document: DownloadableDocument) {
  const { client, bucket } = storage();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: document.key, VersionId: document.s3VersionId }));
  if (!object.Body) throw new Error('Empty document response');
  return { body: object.Body as Readable, length: object.ContentLength };
}

export async function sendFile(res: NextApiResponse, document: DownloadableDocument) {
  const { body, length } = await objectStream(document);
  res.status(200);
  res.setHeader('Content-Type', document.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', attachmentHeader(document.fileName));
  if (length !== undefined) res.setHeader('Content-Length', length);
  await new Promise<void>((resolve, reject) => {
    body.on('error', reject); res.on('close', resolve); res.on('finish', resolve);
    body.pipe(res);
  });
}

/** Streams a ZIP without compression (most office files and PDFs are already compressed), one S3 object at a time. */
export async function sendZip(res: NextApiResponse, roomName: string, documents: DownloadableDocument[], paths?: Map<string, string>) {
  const archive = new ZipArchive({ store: true });
  // Inside the ZIP each file keeps its folder path from the room, e.g. "Financials/Model.xlsx".
  const names = uniqueNames(documents.map(d => (paths?.get(d.id) ? `${paths.get(d.id)}/` : '') + d.fileName));
  res.status(200);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', attachmentHeader(downloadFileName(roomName, 'zip')));
  let failed: unknown = null;
  archive.on('error', error => { failed = error; res.destroy(); });
  archive.pipe(res);
  for (let i = 0; i < documents.length; i++) {
    if (failed || res.destroyed) break;
    const { body } = await objectStream(documents[i]);
    const done = new Promise<void>(resolve => archive.once('entry', () => resolve()));
    archive.append(body, { name: names[i] });
    await done;
  }
  if (failed) throw failed;
  if (!res.destroyed) await archive.finalize();
}

// ---- Short-lived download links for the MCP connector ---------------------

export const LINK_TTL_SECONDS = 10 * 60;
type LinkClaims = { u: string; r: string; d: string | null; x: number };

function linkKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('Signing secret is not configured');
  return createHmac('sha256', secret).update('hu-download-link-v1').digest();
}
function sign(payload: string) { return createHmac('sha256', linkKey()).update(payload).digest('base64url'); }

/** A link bound to one user and one document (or the whole room when documentId is null). */
export function downloadLink(userId: string, roomId: string, documentId: string | null, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ u: userId, r: roomId, d: documentId, x: expiresAt } satisfies LinkClaims)).toString('base64url');
  return { url: `${appUrl()}/api/download?token=${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export function verifyDownloadToken(token: string, now = Date.now()): LinkClaims | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload)); const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LinkClaims;
    if (typeof claims.u !== 'string' || typeof claims.r !== 'string' || (claims.d !== null && typeof claims.d !== 'string') || typeof claims.x !== 'number') return null;
    return claims.x * 1000 > now ? claims : null;
  } catch { return null; }
}

/** The actor a link was issued to, as the user is now. */
export async function actorForUser(userId: string): Promise<Actor> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.email || !user.emailVerified) throw new HttpError(404, 'Download not found.');
  const email = user.email.toLowerCase();
  return { id: user.id, email, admin: adminEmails().includes(email) };
}
