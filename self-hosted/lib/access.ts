import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import type { Prisma } from '@prisma/client';
import { canEnterRoom, canReadRoomDocument, type InvestorAccessContext } from '../../lib/horseup/rooms/access-policy';
import { authOptions } from './auth';
import { adminEmails, appUrl, teamId } from './config';
import { db } from './db';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Actor = { id: string; email: string; admin: boolean };
export type Database = Prisma.TransactionClient;

export async function actorFor(req: NextApiRequest, res: NextApiResponse): Promise<Actor> {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) throw new HttpError(401, 'Please sign in.');
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user?.email || !user.emailVerified) throw new HttpError(401, 'Please sign in again.');
  return { id: user.id, email: user.email.toLowerCase(), admin: adminEmails().includes(user.email.toLowerCase()) };
}

export function requireAdmin(actor: Actor) {
  if (!actor.admin) throw new HttpError(403, 'Administrator access required.');
}
export function requireOrigin(req: NextApiRequest) {
  if (req.headers.origin !== appUrl()) throw new HttpError(403, 'Invalid request origin.');
}

export async function roomContext(client: Database, actor: Actor, roomId: string) {
  const room = await client.huInvestorRoom.findFirst({ where: { id: roomId, teamId },
    include: { memberships: { where: { userId: actor.id, email: actor.email } }, documents: true },
  });
  if (!room) throw new HttpError(404, 'Room not found.');
  const stages = await client.huRoomStage.findMany({ where: { teamId }, orderBy: { position: 'asc' } });
  const member = room.memberships[0];
  const context: InvestorAccessContext = {
    userId: actor.id, emailVerified: true,
    room: { id: room.id, teamId: room.teamId, stageId: room.stageId, archived: Boolean(room.archivedAt) },
    membership: member ? { roomId, userId: actor.id, accepted: Boolean(member.acceptedAt), revoked: Boolean(member.revokedAt) } : null,
    stages,
  };
  if (!actor.admin && !canEnterRoom(context)) throw new HttpError(404, 'Room not found.');
  return { room, context, stages };
}

export async function documentAccess(client: Database, actor: Actor, roomId: string, documentId: string) {
  const state = await roomContext(client, actor, roomId);
  const document = await client.document.findFirst({ where: { id: documentId, teamId }, include: { huAccessRule: true } });
  if (!document) throw new HttpError(404, 'Document not found.');
  const selected = state.room.documents.find(d => d.documentId === documentId) ?? null;
  if (!actor.admin && !canReadRoomDocument(state.context, {
    id: document.id, teamId, minimumStageId: document.huAccessRule?.minimumStageId ?? null,
  }, selected)) throw new HttpError(404, 'Document not found.');
  return { ...state, document };
}

export function sendError(res: NextApiResponse, error: unknown) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  console.error('HorseUp request failed', error instanceof Error ? error.name : 'UnknownError');
  return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
}

export function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
}
