import type { NextApiRequest, NextApiResponse } from 'next';
import { actorFor, jsonSafe, roomContext, sendError } from '../../lib/access';
import { db } from '../../lib/db';
import { teamId } from '../../lib/config';
import { canReadRoomDocument } from '../../../lib/horseup/rooms/access-policy';
import { foldersLeadingTo, loadFolders } from '../../lib/folders';

const versionFields = { id: true, versionNumber: true, numPages: true, fileSize: true, createdAt: true, type: true, huThumbnailS3VersionId: true } as const;
type RawVersion = { id: string; versionNumber: number; numPages: number | null; fileSize: bigint | null; createdAt: Date; type: string | null; huThumbnailS3VersionId: string | null };
/** Flattens the folder placement and hides storage ids: the client only needs to know a thumbnail exists. */
function shapeDocument<T extends { type: string | null; huFolderPlacement: { folderId: string } | null; versions: RawVersion[] }>(d: T) {
  const { huFolderPlacement, versions, ...rest } = d;
  return { ...rest, folderId: huFolderPlacement?.folderId ?? null,
    versions: versions.map(({ huThumbnailS3VersionId, ...v }) => ({ ...v, type: v.type ?? d.type ?? 'pdf', hasThumbnail: Boolean(huThumbnailS3VersionId) })) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const actor = await actorFor(req, res);
    const stages = await db.huRoomStage.findMany({ where: { teamId }, orderBy: { position: 'asc' }, include: actor.admin ? {
      _count: { select: { rooms: true, documentRules: { where: { document: { huDeletedAt: null } } } } },
    } : undefined });
    const rooms = await db.huInvestorRoom.findMany({
      where: { teamId, ...(actor.admin ? {} : { archivedAt: null, memberships: { some: { email: actor.email, revokedAt: null } } }) },
      select: { id: true, name: true, stageId: true, archivedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' },
    });
    const allFolders = await loadFolders();
    const library = actor.admin ? (await db.document.findMany({ where: { teamId, huDeletedAt: null }, select: {
      id: true, name: true, type: true, updatedAt: true, huAccessRule: { select: { minimumStageId: true } },
      huFolderPlacement: { select: { folderId: true } },
      _count: { select: { huRoomSelections: true } },
      huRoomSelections: { select: { room: { select: { id: true, name: true, stageId: true, archivedAt: true } } }, orderBy: { addedAt: 'asc' } },
      versions: { where: { isPrimary: true }, select: versionFields },
    }, orderBy: { updatedAt: 'desc' } })).map(shapeDocument) : [];

    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : null;
    if (!roomId) return res.json(jsonSafe({ actor, stages, rooms, library, folders: actor.admin ? allFolders : [] }));
    const state = await roomContext(db, actor, roomId);
    const documents = (await db.document.findMany({ where: { teamId, huDeletedAt: null, huRoomSelections: { some: { roomId } } }, select: {
      id: true, name: true, type: true, huAccessRule: { select: { minimumStageId: true } },
      huFolderPlacement: { select: { folderId: true } },
      versions: { where: { isPrimary: true }, orderBy: { versionNumber: 'desc' }, take: 1, select: versionFields },
    }, orderBy: { name: 'asc' } })).map(shapeDocument);
    const visible = documents.filter(d => d.versions.length && (actor.admin || canReadRoomDocument(state.context,
      { id: d.id, teamId, minimumStageId: d.huAccessRule?.minimumStageId ?? null }, { roomId, documentId: d.id })));
    const ids = visible.map(d => d.id);
    // The room shows only folders that lead to something the viewer can open, so
    // empty folders and the names of folders holding locked documents stay hidden.
    const roomFolders = foldersLeadingTo(allFolders, visible.flatMap(d => d.folderId ? [d.folderId] : []));
    const discussions = await db.huRoomDiscussion.findMany({
      where: { roomId, OR: [{ documentId: null }, { documentId: { in: ids } }, { document: { huDeletedAt: { not: null } } }] },
      select: { id: true, title: true, documentId: true, documentVersionId: true, pageNumber: true, anchor: true,
        document: { select: { huDeletedAt: true } },
        createdAt: true, resolvedAt: true, createdById: true,
        messages: { orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }], select: {
          id: true, body: true, createdAt: true, editedAt: true, sequence: true,
          author: { select: { id: true, name: true, email: true } }, mentions: { select: { userId: true } },
        } }, events: { orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }], select: { type: true, createdAt: true, actor: { select: { name: true, email: true } } } },
      }, orderBy: { createdAt: 'desc' },
    });
    const members = await db.huRoomMembership.findMany({ where: { roomId, ...(actor.admin ? {} : { revokedAt: null }) },
      select: { id: true, email: true, userId: true, invitedAt: true, acceptedAt: true, revokedAt: true }, orderBy: { invitedAt: 'asc' },
    });
    const administrators = await db.userTeam.findMany({ where: { teamId, status: 'ACTIVE', role: 'ADMIN' }, select: { user: { select: { id: true, email: true, name: true } } } });
    const visits = actor.admin ? await db.huRoomVisit.findMany({ where: { roomId }, take: 100, orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, lastSeenAt: true, user: { select: { email: true, name: true } },
        readings: { select: { documentId: true, documentVersionId: true, pageNumber: true, visibleMs: true } },
      },
    }) : [];
    const downloads = actor.admin ? await db.huRoomDownload.findMany({ where: { roomId }, take: 100, orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, bulk: true, channel: true, documentId: true, user: { select: { email: true } } } }) : [];
    const own = actor.admin ? null : await db.huRoomMembership.findFirst({ where: { roomId, userId: actor.id, revokedAt: null }, select: { notificationsMutedAt: true } });
    const threads = discussions.map(({ document, ...d }) => ({ ...d, documentRemoved: Boolean(document?.huDeletedAt) }));
    return res.json(jsonSafe({ actor, stages, rooms, library, room: {
      id: state.room.id, name: state.room.name, stageId: state.room.stageId, archivedAt: state.room.archivedAt,
      selectedDocumentIds: actor.admin ? state.room.documents.map(d => d.documentId) : ids,
      notificationsEnabled: own ? !own.notificationsMutedAt : null,
    }, documents: visible, folders: roomFolders, discussions: threads, members, administrators: administrators.map(a => a.user), visits, downloads }));
  } catch (error) { return sendError(res, error); }
}
