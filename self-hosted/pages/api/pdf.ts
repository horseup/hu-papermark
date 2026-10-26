import type { NextApiRequest, NextApiResponse } from 'next';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { actorFor, documentAccess, HttpError, sendError } from '../../lib/access';
import { db } from '../../lib/db';
import { teamId } from '../../lib/config';
import { storage } from '../../lib/storage';

export const config = { api: { responseLimit: false } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const actor = await actorFor(req, res);
    const { documentId, versionId, roomId } = req.query;
    if (typeof documentId !== 'string' || typeof versionId !== 'string') throw new HttpError(400, 'Invalid document request.');
    if (!actor.admin) {
      if (typeof roomId !== 'string') throw new HttpError(404, 'Document not found.');
      await documentAccess(db, actor, roomId, documentId);
    }
    const version = await db.documentVersion.findFirst({ where: { id: versionId, documentId, document: { teamId }, numPages: { not: null } } });
    if (!version) throw new HttpError(404, 'Document not found.');
    const range = req.headers.range;
    if (range && !/^bytes=\d+-\d*$/.test(range)) throw new HttpError(416, 'Invalid byte range.');
    const { client, bucket } = storage();
    if (!version.huS3VersionId) throw new HttpError(404, 'Published document not found.');
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: version.file, VersionId: version.huS3VersionId, ...(range ? { Range: range } : {}) }));
    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
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
