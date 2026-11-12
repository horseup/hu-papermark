import type { NextApiRequest, NextApiResponse } from 'next';
import type { HuDownloadChannel } from '@prisma/client';
import { type Actor, actorFor, HttpError, sendError } from '../../lib/access';
import { actorForUser, downloadableDocuments, recordDownloads, sendFile, sendZip, verifyDownloadToken } from '../../lib/downloads';
import { folderPath, loadFolders, placementsFor } from '../../lib/folders';

// GET ?roomId=…&documentId=…   one PDF, signed-in member
// GET ?roomId=…&all=1          ZIP of every readable document, signed-in member
// GET ?token=…                 short-lived link issued by the MCP connector
export const config = { api: { responseLimit: false } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    let actor: Actor; let roomId: string; let documentId: string | null; let channel: HuDownloadChannel;
    if (typeof req.query.token === 'string') {
      const claims = verifyDownloadToken(req.query.token);
      if (!claims) throw new HttpError(410, 'This download link has expired. Ask your AI assistant for a new one.');
      actor = await actorForUser(claims.u); roomId = claims.r; documentId = claims.d; channel = 'MCP';
    } else {
      if (typeof req.query.roomId !== 'string') throw new HttpError(400, 'Invalid download request.');
      actor = await actorFor(req, res); roomId = req.query.roomId; channel = 'WEB';
      documentId = req.query.all === '1' ? null : typeof req.query.documentId === 'string' ? req.query.documentId : '';
      if (documentId === '') throw new HttpError(400, 'Invalid download request.');
    }
    const { room, documents } = await downloadableDocuments(actor, roomId);
    if (documentId) {
      const document = documents.find(d => d.id === documentId);
      if (!document) throw new HttpError(404, 'Document not found.');
      await recordDownloads(actor, roomId, [document], false, channel);
      await sendFile(res, document);
    } else {
      if (!documents.length) throw new HttpError(404, 'No documents are available in this room yet.');
      await recordDownloads(actor, roomId, documents, true, channel);
      const [folders, placements] = await Promise.all([loadFolders(), placementsFor(documents.map(d => d.id))]);
      const paths = new Map(documents.map(d => [d.id, folderPath(folders, placements.get(d.id))]));
      await sendZip(res, room.name, documents, paths);
    }
  } catch (error) { if (res.headersSent) res.destroy(); else sendError(res, error); }
}
