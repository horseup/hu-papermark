import type { NextApiRequest, NextApiResponse } from 'next';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { actorFor, documentAccess, HttpError, sendError } from '../../lib/access';
import { db } from '../../lib/db';
import { teamId } from '../../lib/config';
import { fileTypeByExt, THUMBNAIL_MIME } from '../../lib/file-types';
import { storage } from '../../lib/storage';

// GET ?documentId=…&versionId=…&roomId=…           the published file, for the in-page viewer
// GET ?documentId=…&versionId=…&roomId=…&thumb=1   its small JPEG preview
// Viewing is not a download: nothing is recorded here. Downloads go through /api/download.
export const config = { api: { responseLimit: false } };
const INLINE = new Set(['pdf', 'image', 'text']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  // Files are data, never a page: no scripts, no MIME sniffing, no framing.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const actor = await actorFor(req, res);
    const { documentId, versionId, roomId } = req.query;
    const thumb = req.query.thumb === '1';
    if (typeof documentId !== 'string' || typeof versionId !== 'string') throw new HttpError(400, 'Invalid document request.');
    if (!actor.admin) {
      if (typeof roomId !== 'string') throw new HttpError(404, 'Document not found.');
      await documentAccess(db, actor, roomId, documentId);
    }
    const version = await db.documentVersion.findFirst({ where: { id: versionId, documentId, document: { teamId }, huS3VersionId: { not: null } } });
    if (!version?.huS3VersionId) throw new HttpError(404, 'Document not found.');
    const type = fileTypeByExt(version.type);
    const key = thumb ? version.huThumbnailFile : version.file;
    const objectVersion = thumb ? version.huThumbnailS3VersionId : version.huS3VersionId;
    if (!key || !objectVersion) throw new HttpError(404, 'Preview not available.');
    const range = thumb ? undefined : req.headers.range;
    if (range && !/^bytes=\d+-\d*$/.test(range)) throw new HttpError(416, 'Invalid byte range.');
    const { client, bucket } = storage();
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, VersionId: objectVersion, ...(range ? { Range: range } : {}) }));
    res.status(range ? 206 : 200);
    const contentType = thumb ? THUMBNAIL_MIME : type.signature === 'text' ? `${type.mime}; charset=utf-8` : type.mime;
    res.setHeader('Content-Type', contentType);
    // Opened directly in a tab, a non-PDF file must never run anything. (Browsers refuse to
    // show PDFs under a sandbox policy, and PDFs only ever render through PDF.js here.)
    if (thumb || type.kind !== 'pdf') res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Disposition', `${thumb || INLINE.has(type.kind) ? 'inline' : 'attachment'}; filename="document.${thumb ? 'jpg' : type.ext}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    if (object.ContentLength !== undefined) res.setHeader('Content-Length', object.ContentLength);
    if (object.ContentRange) res.setHeader('Content-Range', object.ContentRange);
    if (!object.Body) throw new Error('Empty document response');
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      if (res.destroyed) break;
      if (!res.write(chunk)) await new Promise<void>(resolve => {
        const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
        res.once('drain', done); res.once('close', done);
      });
    }
    res.end();
  } catch (error) { if (res.headersSent) res.destroy(); else sendError(res, error); }
}
