import type { NextApiRequest, NextApiResponse } from 'next';
import { actorFor, jsonSafe, roomContext, sendError } from '../../lib/access';
import { db } from '../../lib/db';
import { teamId } from '../../lib/config';
import { canReadRoomDocument } from '../../../lib/horseup/rooms/access-policy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const actor = await actorFor(req, res);
    const stages = await db.huRoomStage.findMany({ where: { teamId }, orderBy: { position: 'asc' } });
    const rooms = await db.huInvestorRoom.findMany({
      where: { teamId, ...(actor.admin ? {} : { archivedAt: null, memberships: { some: { email: actor.email, revokedAt: null } } }) },
      select: { id: true, name: true, stageId: true, archivedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' },
    });
    const library = actor.admin ? await db.document.findMany({ where: { teamId }, select: {
      id: true, name: true, updatedAt: true, huAccessRule: { select: { minimumStageId: true } },
      versions: { where: { isPrimary: true }, select: { id: true, versionNumber: true, fileSize: true, numPages: true } },
    }, orderBy: { updatedAt: 'desc' } }) : [];

    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : null;
    if (!roomId) return res.json(jsonSafe({ actor, stages, rooms, library }));
    const state = await roomContext(db, actor, roomId);
    const documents = await db.document.findMany({ where: { teamId, huRoomSelections: { some: { roomId } } }, select: {
      id: true, name: true, huAccessRule: { select: { minimumStageId: true } },
      versions: { where: { isPrimary: true }, orderBy: { versionNumber: 'desc' }, take: 1,
        select: { id: true, versionNumber: true, numPages: true, fileSize: true, createdAt: true } },
    }, orderBy: { name: 'asc' } });
    const visible = documents.filter(d => d.versions.length && (actor.admin || canReadRoomDocument(state.context,
      { id: d.id, teamId, minimumStageId: d.huAccessRule?.minimumStageId ?? null }, { roomId, documentId: d.id })));
    const ids = visible.map(d => d.id);
    const discussions = await db.huRoomDiscussion.findMany({
      where: { roomId, OR: [{ documentId: null }, { documentId: { in: ids } }] },
      select: { id: true, title: true, documentId: true, documentVersionId: true, pageNumber: true,
        createdAt: true, resolvedAt: true, createdById: true,
        messages: { orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }], select: {
          id: true, body: true, createdAt: true, editedAt: true, sequence: true,
          author: { select: { id: true, name: true, email: true } }, mentions: { select: { userId: true } },
        } }, events: { orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }], select: { type: true, createdAt: true, actor: { select: { name: true, email: true } } } },
      }, orderBy: { createdAt: 'desc' },
    });
    const members = await db.huRoomMembership.findMany({ where: { roomId, ...(actor.admin ? {} : { revokedAt: null, acceptedAt: { not: null } }) },
      select: { id: true, email: true, userId: true, invitedAt: true, acceptedAt: true, revokedAt: true }, orderBy: { invitedAt: 'asc' },
    });
    const administrators = await db.userTeam.findMany({ where: { teamId, status: 'ACTIVE', role: 'ADMIN' }, select: { user: { select: { id: true, email: true, name: true } } } });
    const visits = actor.admin ? await db.huRoomVisit.findMany({ where: { roomId }, take: 100, orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, lastSeenAt: true, user: { select: { email: true, name: true } },
        readings: { select: { documentId: true, documentVersionId: true, pageNumber: true, visibleMs: true } },
      },
    }) : [];
    return res.json(jsonSafe({ actor, stages, rooms, library, room: {
      id: state.room.id, name: state.room.name, stageId: state.room.stageId, archivedAt: state.room.archivedAt,
      selectedDocumentIds: actor.admin ? state.room.documents.map(d => d.documentId) : ids,
    }, documents: visible, discussions, members, administrators: administrators.map(a => a.user), visits }));
  } catch (error) { return sendError(res, error); }
}
