import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { type Actor, HttpError } from './access';
import { teamId } from './config';
import { db } from './db';
import { downloadableDocuments, downloadLink, LINK_TTL_SECONDS, pdfFileName } from './downloads';

// MCP tools for the deal room connector. Read-only: list rooms and documents and
// hand out short-lived download links. Access is evaluated per call with the same
// rules as the website, so a removed member or archived room returns nothing.

export const INSTRUCTIONS = 'HorseUp deal room for invited investors. List the rooms and documents this user can access and get download links for the PDFs. Links expire after 10 minutes; ask for a new one when needed. Downloads are recorded for the HorseUp team. Discussions are not available here.';

async function roomsFor(actor: Actor) {
  return db.huInvestorRoom.findMany({
    where: { teamId, archivedAt: null, ...(actor.admin ? {} : { memberships: { some: { userId: actor.id, acceptedAt: { not: null }, revokedAt: null } } }) },
    select: { id: true, name: true }, orderBy: { createdAt: 'desc' },
  });
}

/** The requested room, or the only room when none is named. */
async function resolveRoom(actor: Actor, roomId: string | undefined) {
  const rooms = await roomsFor(actor);
  if (roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) throw new HttpError(404, 'Room not found. Call list_rooms to see the rooms you can access.');
    return room;
  }
  if (rooms.length === 1) return rooms[0];
  if (!rooms.length) throw new HttpError(404, 'This account has no active deal room access.');
  throw new HttpError(400, `This account has ${rooms.length} rooms. Pass roomId; call list_rooms to see them.`);
}

function result(value: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value };
}
function failure(error: unknown) {
  const message = error instanceof HttpError ? error.message : 'The deal room could not complete this request. Please try again.';
  if (!(error instanceof HttpError)) console.error('HorseUp MCP tool failed', error instanceof Error ? error.name : 'UnknownError');
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function dealRoomServer(actor: Actor) {
  const server = new McpServer({ name: 'horseup-dealroom', title: 'HorseUp deal room', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  server.registerTool('list_rooms', {
    title: 'List deal rooms',
    description: 'List the HorseUp deal rooms this user can access, with the number of documents in each.',
    inputSchema: {}, annotations: readOnly,
  }, async () => {
    try {
      const rooms = await roomsFor(actor);
      const withCounts = [];
      for (const room of rooms) withCounts.push({ roomId: room.id, name: room.name, documents: (await downloadableDocuments(actor, room.id)).documents.length });
      return result({ account: actor.email, rooms: withCounts });
    } catch (error) { return failure(error); }
  });

  server.registerTool('list_documents', {
    title: 'List documents',
    description: 'List the published documents in a deal room: name, version, pages and size. roomId is optional when the user has one room.',
    inputSchema: { roomId: z.string().min(1).max(150).optional().describe('Room id from list_rooms.') }, annotations: readOnly,
  }, async ({ roomId }) => {
    try {
      const room = await resolveRoom(actor, roomId);
      const { documents } = await downloadableDocuments(actor, room.id);
      return result({ roomId: room.id, room: room.name, documents: documents.map(d => ({
        documentId: d.id, name: d.name, fileName: pdfFileName(d.name), version: d.versionNumber, pages: d.numPages, sizeBytes: Number(d.fileSize),
      })) });
    } catch (error) { return failure(error); }
  });

  server.registerTool('get_document_download_link', {
    title: 'Get a document download link',
    description: `Get a download URL for one PDF in a deal room. The URL works with a plain HTTPS GET, without authentication, for ${LINK_TTL_SECONDS / 60} minutes. The download is recorded for the HorseUp team.`,
    inputSchema: { documentId: z.string().min(1).max(150).describe('Document id from list_documents.'), roomId: z.string().min(1).max(150).optional().describe('Room id from list_rooms; optional when the user has one room.') },
    annotations: { ...readOnly, idempotentHint: false },
  }, async ({ documentId, roomId }) => {
    try {
      const room = await resolveRoom(actor, roomId);
      const document = (await downloadableDocuments(actor, room.id)).documents.find(d => d.id === documentId);
      if (!document) throw new HttpError(404, 'Document not found in this room. Call list_documents to see what is available.');
      const link = downloadLink(actor.id, room.id, document.id);
      return result({ roomId: room.id, documentId: document.id, name: document.name, fileName: pdfFileName(document.name), contentType: 'application/pdf', sizeBytes: Number(document.fileSize), downloadUrl: link.url, expiresAt: link.expiresAt });
    } catch (error) { return failure(error); }
  });

  server.registerTool('get_all_documents_download_link', {
    title: 'Get a ZIP of all documents',
    description: `Get one download URL for a ZIP file with every PDF in a deal room. The URL works with a plain HTTPS GET for ${LINK_TTL_SECONDS / 60} minutes. Each document is recorded as downloaded.`,
    inputSchema: { roomId: z.string().min(1).max(150).optional().describe('Room id from list_rooms; optional when the user has one room.') },
    annotations: { ...readOnly, idempotentHint: false },
  }, async ({ roomId }) => {
    try {
      const room = await resolveRoom(actor, roomId);
      const { documents } = await downloadableDocuments(actor, room.id);
      if (!documents.length) throw new HttpError(404, 'No documents are available in this room yet.');
      const link = downloadLink(actor.id, room.id, null);
      return result({ roomId: room.id, room: room.name, contentType: 'application/zip', documents: documents.map(d => d.name), totalBytes: documents.reduce((sum, d) => sum + Number(d.fileSize), 0), downloadUrl: link.url, expiresAt: link.expiresAt });
    } catch (error) { return failure(error); }
  });

  return server;
}
