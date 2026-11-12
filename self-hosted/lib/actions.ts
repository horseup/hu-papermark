import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Actor, type Database, HttpError, requireAdmin, roomContext, documentAccess, threadAccess } from './access';
import { adminEmails, teamId } from './config';
import { fileTypeByExt, fileTypeFor, matchesSignature, MAX_THUMBNAIL_BYTES, MAX_UPLOAD_BYTES, SIGNATURE_BYTES, THUMBNAIL_MIME, wantsThumbnail } from './file-types';
import { sendRoomInvite } from './mail';
import { notifyAccessEnded, notifyAdmins, notifyDiscussionMessage, notifyDocumentChanges, visibleDocuments } from './notifications';
import { storage } from './storage';
import { db } from './db';

const id = z.string().min(1).max(150);
const title = z.string().trim().min(1).max(300);
const email = z.string().trim().toLowerCase().email().max(254);
const ids = z.array(id).max(1000).transform(value => [...new Set(value)]);
const fraction = z.number().finite().min(0).max(1);
// Inline comment position, as fractions of the rendered page so it survives any zoom level.
const anchorSchema = z.object({
  kind: z.enum(['text', 'area']),
  rects: z.array(z.object({ x: fraction, y: fraction, w: fraction, h: fraction })
    .refine(r => r.w > 0 && r.h > 0 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001, 'Highlight outside the page.')).min(1).max(60),
  quote: z.string().trim().max(1000).optional(),
}).strict();
// Invitations are sent immediately; everything else goes through the debounced
// notification outbox in ./notifications.
type Notice = { kind: 'invite'; email: string; roomId: string; roomName: string; invitedBy?: string };
/** Everyone invites at most this many people at once; investors keep rooms below this many open memberships. */
export const INVITE_BATCH = 10;
export const ROOM_MEMBER_LIMIT = 25;
export const MAX_FOLDERS = 300;
type Outcome = { value: unknown; notices?: Notice[] };

const folderName = z.string().trim().min(1).max(120);
async function validFolder(tx: Database, folderId: string) {
  const folder = await tx.huFolder.findFirst({ where: { id: folderId, teamId } });
  if (!folder) throw new HttpError(400, 'Choose a valid folder.');
  return folder;
}
/** Sibling names are unique regardless of case; the database enforces the same rule. */
async function uniqueFolderName(tx: Database, parentId: string | null, name: string, exceptId?: string) {
  const clash = await tx.huFolder.findFirst({ where: { teamId, parentId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw new HttpError(409, `A folder named "${name}" already exists here.`);
}
/** Throws when moving folderId under parentId would create a loop. */
async function assertNotDescendant(tx: Database, folderId: string, parentId: string | null) {
  let cursor = parentId;
  for (let depth = 0; cursor; depth++) {
    if (cursor === folderId) throw new HttpError(400, 'A folder cannot be moved into itself or one of its subfolders.');
    if (depth > 64) throw new HttpError(400, 'The folder structure is too deep.');
    const parent: { parentId: string | null } | null = await tx.huFolder.findFirst({ where: { id: cursor, teamId }, select: { parentId: true } });
    cursor = parent?.parentId ?? null;
  }
}
async function placeDocument(tx: Database, documentId: string, folderId: string | null) {
  if (!folderId) { await tx.huDocumentFolder.deleteMany({ where: { documentId, teamId } }); return; }
  await tx.huDocumentFolder.upsert({ where: { documentId }, create: { documentId, teamId, folderId }, update: { folderId } });
}

async function validStage(tx: Database, stageId: string) {
  const stage = await tx.huRoomStage.findFirst({ where: { id: stageId, teamId } });
  if (!stage) throw new HttpError(400, 'Choose a valid stage.');
  return stage;
}
async function validDocuments(tx: Database, documentIds: string[]) {
  const count = await tx.document.count({ where: { id: { in: documentIds }, teamId, huDeletedAt: null } });
  if (count !== documentIds.length) throw new HttpError(400, 'Choose documents from this library.');
}
async function discussionAccess(tx: Database, actor: Actor, roomId: string, discussionId: string) {
  await roomContext(tx, actor, roomId);
  const discussion = await tx.huRoomDiscussion.findFirst({ where: { id: discussionId, roomId, teamId } });
  if (!discussion) throw new HttpError(404, 'Discussion not found.');
  await threadAccess(tx, actor, roomId, discussion.documentId);
  return discussion;
}
async function validMentions(tx: Database, roomId: string, recipients: string[]) {
  const users = await tx.user.findMany({ where: { id: { in: recipients }, OR: [
    { email: { in: adminEmails() } },
    { huRoomMemberships: { some: { roomId, acceptedAt: { not: null }, revokedAt: null } } },
  ] }, select: { id: true } });
  if (users.length !== recipients.length) throw new HttpError(400, 'Mentions must be current room members.');
}

async function change(tx: Database, actor: Actor, input: Record<string, unknown>): Promise<Outcome> {
  switch (input.action) {
    case 'createStage': {
      requireAdmin(actor);
      const data = z.object({ name: z.string().trim().min(1).max(80) }).parse(input);
      const stages = await tx.huRoomStage.findMany({ where: { teamId } });
      if (stages.length >= 20) throw new HttpError(400, 'A maximum of 20 stages is supported.');
      return { value: await tx.huRoomStage.create({ data: { teamId, name: data.name, position: Math.max(-1, ...stages.map(s => s.position)) + 1 } }) };
    }
    case 'renameStage': {
      requireAdmin(actor);
      const data = z.object({ stageId: id, name: z.string().trim().min(1).max(80) }).parse(input);
      await validStage(tx, data.stageId);
      return { value: await tx.huRoomStage.update({ where: { id: data.stageId }, data: { name: data.name } }) };
    }
    case 'reorderStages': {
      requireAdmin(actor);
      const data = z.object({ stageIds: ids }).parse(input);
      const current = await tx.huRoomStage.findMany({ where: { teamId } });
      if (data.stageIds.length !== current.length || current.some(s => !data.stageIds.includes(s.id))) throw new HttpError(400, 'Include every stage exactly once.');
      const offset = Math.max(0, ...current.map(s => s.position)) + current.length + 1;
      for (let i = 0; i < data.stageIds.length; i++) await tx.huRoomStage.update({ where: { id: data.stageIds[i] }, data: { position: offset + i } });
      for (let i = 0; i < data.stageIds.length; i++) await tx.huRoomStage.update({ where: { id: data.stageIds[i] }, data: { position: i } });
      return { value: { updated: true } };
    }
    case 'deleteStage': {
      requireAdmin(actor);
      const data = z.object({ stageId: id, replacementStageId: id }).parse(input);
      if (data.stageId === data.replacementStageId) throw new HttpError(400, 'Choose a different stage to move rooms and documents to.');
      await validStage(tx, data.stageId); await validStage(tx, data.replacementStageId);
      const before = await visibleDocuments(tx);
      // Move every room and document rule first; both relations are ON DELETE RESTRICT.
      const rooms = await tx.huInvestorRoom.updateMany({ where: { teamId, stageId: data.stageId }, data: { stageId: data.replacementStageId } });
      const documents = await tx.huDocumentAccess.updateMany({ where: { teamId, minimumStageId: data.stageId }, data: { minimumStageId: data.replacementStageId } });
      await tx.huRoomStage.delete({ where: { id: data.stageId } });
      await notifyDocumentChanges(tx, actor, before);
      return { value: { deleted: true, movedRooms: rooms.count, movedDocuments: documents.count } };
    }
    case 'deleteDocument': {
      requireAdmin(actor);
      const data = z.object({ documentId: id }).parse(input);
      await validDocuments(tx, [data.documentId]);
      // Soft delete: discussions and reading analytics keep their references;
      // the S3 object versions are retained so the document can be restored.
      await tx.document.update({ where: { id: data.documentId }, data: { huDeletedAt: new Date(), huDeletedById: actor.id } });
      const removed = await tx.huRoomDocument.deleteMany({ where: { documentId: data.documentId, teamId } });
      return { value: { deleted: true, removedFromRooms: removed.count } };
    }
    case 'createRoom': {
      requireAdmin(actor);
      const data = z.object({ name: title, stageId: id, documentIds: ids }).parse(input);
      await validStage(tx, data.stageId); await validDocuments(tx, data.documentIds);
      const room = await tx.huInvestorRoom.create({ data: { teamId, name: data.name, stageId: data.stageId } });
      await tx.huRoomDocument.createMany({ data: data.documentIds.map(documentId => ({ roomId: room.id, documentId, teamId })) });
      return { value: { id: room.id } };
    }
    case 'setRoomStage': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, stageId: id }).parse(input);
      await roomContext(tx, actor, data.roomId); await validStage(tx, data.stageId);
      const before = await visibleDocuments(tx);
      const room = await tx.huInvestorRoom.update({ where: { id: data.roomId }, data: { stageId: data.stageId } });
      await notifyDocumentChanges(tx, actor, before);
      return { value: room };
    }
    case 'setRoomDocuments': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, documentIds: ids }).parse(input);
      await roomContext(tx, actor, data.roomId); await validDocuments(tx, data.documentIds);
      const before = await visibleDocuments(tx);
      await tx.huRoomDocument.deleteMany({ where: { roomId: data.roomId, documentId: { notIn: data.documentIds } } });
      await tx.huRoomDocument.createMany({ data: data.documentIds.map(documentId => ({ roomId: data.roomId, documentId, teamId })), skipDuplicates: true });
      await notifyDocumentChanges(tx, actor, before);
      return { value: { updated: true } };
    }
    case 'setDocumentStage': {
      requireAdmin(actor);
      const data = z.object({ documentId: id, stageId: id }).parse(input);
      await validStage(tx, data.stageId); await validDocuments(tx, [data.documentId]);
      const before = await visibleDocuments(tx);
      const rule = await tx.huDocumentAccess.upsert({ where: { documentId: data.documentId },
        create: { documentId: data.documentId, teamId, minimumStageId: data.stageId }, update: { minimumStageId: data.stageId },
      });
      await notifyDocumentChanges(tx, actor, before);
      return { value: rule };
    }
    case 'invite': {
      // Admins invite to any room; accepted investors invite colleagues to their own room.
      const data = z.object({ roomId: id, emails: z.array(email).min(1).max(INVITE_BATCH) }).parse(input);
      const { room } = await roomContext(tx, actor, data.roomId);
      if (room.archivedAt) throw new HttpError(400, 'Reopen the room before inviting people.');
      const admins = adminEmails();
      const notices: Notice[] = [];
      for (const address of new Set(data.emails)) {
        if (admins.includes(address)) continue;
        const existing = await tx.huRoomMembership.findUnique({ where: { roomId_email: { roomId: room.id, email: address } }, include: { revokedBy: { select: { email: true } } } });
        if (existing?.acceptedAt && !existing.revokedAt) continue;
        // An administrator's removal is final for investors.
        if (!actor.admin && existing?.revokedAt && admins.includes(existing.revokedBy?.email?.toLowerCase() ?? '')) {
          throw new HttpError(403, `HorseUp removed ${address} from this room. Please ask the HorseUp team to invite them again.`);
        }
        if (!actor.admin && !(existing && !existing.revokedAt)) {
          const open = await tx.huRoomMembership.count({ where: { roomId: room.id, revokedAt: null } });
          if (open >= ROOM_MEMBER_LIMIT) throw new HttpError(400, `A room can have up to ${ROOM_MEMBER_LIMIT} members. Please ask the HorseUp team to add more.`);
        }
        await tx.huRoomMembership.upsert({ where: { roomId_email: { roomId: room.id, email: address } },
          create: { roomId: room.id, email: address, invitedById: actor.id },
          update: { invitedById: actor.id, invitedAt: new Date(), revokedAt: null, revokedById: null, acceptedAt: null, userId: null },
        });
        if (!actor.admin) await notifyAdmins(tx, actor, room.id, 'ADMIN_MEMBER_INVITED', address);
        notices.push({ kind: 'invite', email: address, roomId: room.id, roomName: room.name, ...(actor.admin ? {} : { invitedBy: actor.email }) });
      }
      return { value: { invited: notices.length }, notices };
    }
    case 'acceptInvitation': {
      const data = z.object({ roomId: id }).parse(input);
      const found = await tx.huRoomMembership.findFirst({ where: {
        roomId: data.roomId, email: actor.email, revokedAt: null, room: { teamId, archivedAt: null },
      } });
      if (!found) throw new HttpError(404, 'Invitation not found.');
      if (!found.acceptedAt) {
        await tx.huRoomMembership.update({ where: { id: found.id }, data: { userId: actor.id, acceptedAt: new Date() } });
        await notifyAdmins(tx, actor, data.roomId, 'ADMIN_INVITE_ACCEPTED');
      }
      return { value: { accepted: true } };
    }
    case 'revokeMember': {
      // Admins remove anyone. Accepted investors remove any investor in their own room, themselves included.
      // Admins are not memberships, so investors can never remove them.
      const data = z.object({ roomId: id, membershipId: id }).parse(input);
      await roomContext(tx, actor, data.roomId);
      const member = await tx.huRoomMembership.findFirst({ where: { id: data.membershipId, roomId: data.roomId } });
      if (!member) throw new HttpError(404, 'Member not found.');
      if (!member.revokedAt) {
        await tx.huRoomMembership.update({ where: { id: member.id }, data: { revokedAt: new Date(), revokedById: actor.id } });
        await notifyAccessEnded(tx, actor, data.roomId, [member]);
        if (!actor.admin) await notifyAdmins(tx, actor, data.roomId, 'ADMIN_MEMBER_REMOVED', member.email);
      }
      return { value: { revoked: true } };
    }
    case 'archiveRoom': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, archived: z.boolean() }).parse(input);
      const { room } = await roomContext(tx, actor, data.roomId);
      if (data.archived && !room.archivedAt) {
        await notifyAccessEnded(tx, actor, data.roomId, await tx.huRoomMembership.findMany({ where: { roomId: data.roomId, revokedAt: null } }));
      }
      return { value: await tx.huInvestorRoom.update({ where: { id: data.roomId }, data: { archivedAt: data.archived ? (room.archivedAt ?? new Date()) : null } }) };
    }
    case 'createDiscussion': {
      const data = z.object({ roomId: id, title, body: z.string().trim().min(1).max(20000), documentId: id.nullable(),
        versionId: id.nullable(), pageNumber: z.number().int().min(1).nullable(), anchor: anchorSchema.nullable().default(null), mentionIds: ids.default([]), requestId: z.string().uuid() }).parse(input);
      if (data.anchor && (!data.documentId || !data.pageNumber)) throw new HttpError(400, 'A highlight needs a document page.');
      await roomContext(tx, actor, data.roomId);
      if (data.documentId) {
        await documentAccess(tx, actor, data.roomId, data.documentId);
        const version = await tx.documentVersion.findFirst({ where: { id: data.versionId ?? '', documentId: data.documentId } });
        // Only PDFs have pages; other files are referenced as a whole.
        if (!version?.huS3VersionId || (data.pageNumber && (!version.numPages || data.pageNumber > version.numPages))) throw new HttpError(400, 'Invalid document reference.');
      } else if (data.versionId || data.pageNumber) throw new HttpError(400, 'A page reference needs a document.');
      await validMentions(tx, data.roomId, data.mentionIds);
      const existing = await tx.huRoomDiscussion.findUnique({ where: { id: data.requestId } });
      if (existing) {
        if (existing.roomId !== data.roomId || existing.createdById !== actor.id) throw new HttpError(409, 'Request identifier already used.');
        return { value: { id: existing.id } };
      }
      const discussion = await tx.huRoomDiscussion.create({ data: { id: data.requestId, roomId: data.roomId, teamId, title: data.title,
        documentId: data.documentId, documentVersionId: data.versionId, pageNumber: data.pageNumber, createdById: actor.id,
        anchor: data.anchor ?? Prisma.DbNull,
      } });
      const message = await tx.huRoomMessage.create({ data: { roomId: data.roomId, discussionId: discussion.id, authorId: actor.id, body: data.body } });
      await tx.huRoomMention.createMany({ data: data.mentionIds.map(userId => ({ messageId: message.id, roomId: data.roomId, userId })) });
      await notifyDiscussionMessage(tx, actor, data.roomId, discussion.id, data.mentionIds);
      return { value: { id: discussion.id } };
    }
    case 'reply': {
      const data = z.object({ roomId: id, discussionId: id, body: z.string().trim().min(1).max(20000), mentionIds: ids.default([]), requestId: z.string().uuid() }).parse(input);
      const discussion = await discussionAccess(tx, actor, data.roomId, data.discussionId);
      if (discussion.resolvedAt) throw new HttpError(409, 'Reopen this discussion before replying.');
      await validMentions(tx, data.roomId, data.mentionIds);
      const existing = await tx.huRoomMessage.findUnique({ where: { id: data.requestId } });
      if (existing) {
        if (existing.discussionId !== data.discussionId || existing.authorId !== actor.id) throw new HttpError(409, 'Request identifier already used.');
        return { value: { id: existing.id } };
      }
      const message = await tx.huRoomMessage.create({ data: { id: data.requestId, discussionId: data.discussionId, roomId: data.roomId, authorId: actor.id, body: data.body } });
      await tx.huRoomMention.createMany({ data: data.mentionIds.map(userId => ({ messageId: message.id, roomId: data.roomId, userId })) });
      await notifyDiscussionMessage(tx, actor, data.roomId, discussion.id, data.mentionIds);
      return { value: { id: message.id } };
    }
    case 'resolveDiscussion': {
      const data = z.object({ roomId: id, discussionId: id, resolved: z.boolean() }).parse(input);
      const discussion = await discussionAccess(tx, actor, data.roomId, data.discussionId);
      if (!actor.admin && discussion.createdById !== actor.id) throw new HttpError(403, 'Only the author or an administrator can resolve this discussion.');
      if (Boolean(discussion.resolvedAt) !== data.resolved) {
        await tx.huRoomDiscussion.update({ where: { id: discussion.id }, data: { resolvedAt: data.resolved ? new Date() : null, resolvedById: data.resolved ? actor.id : null } });
        await tx.huRoomDiscussionEvent.create({ data: { discussionId: discussion.id, roomId: data.roomId, actorId: actor.id, type: data.resolved ? 'RESOLVED' : 'REOPENED' } });
      }
      return { value: { updated: true } };
    }
    case 'setRoomNotifications': {
      const data = z.object({ roomId: id, enabled: z.boolean() }).parse(input);
      await roomContext(tx, actor, data.roomId);
      const result = await tx.huRoomMembership.updateMany({ where: { roomId: data.roomId, userId: actor.id, revokedAt: null },
        data: { notificationsMutedAt: data.enabled ? null : new Date() } });
      if (!result.count) throw new HttpError(404, 'Membership not found.');
      return { value: { enabled: data.enabled } };
    }
    case 'startVisit': {
      const data = z.object({ roomId: id, visitId: z.string().uuid() }).parse(input);
      await roomContext(tx, actor, data.roomId);
      if (actor.admin) return { value: { id: null } };
      const existing = await tx.huRoomVisit.findUnique({ where: { id: data.visitId } });
      if (existing && (existing.userId !== actor.id || existing.roomId !== data.roomId)) throw new HttpError(409, 'Visit identifier already used.');
      if (existing) return { value: { id: existing.id } };
      const firstVisit = !(await tx.huRoomVisit.count({ where: { roomId: data.roomId, userId: actor.id } }));
      const visit = await tx.huRoomVisit.create({ data: { id: data.visitId, roomId: data.roomId, teamId, userId: actor.id } });
      if (firstVisit) await notifyAdmins(tx, actor, data.roomId, 'ADMIN_FIRST_VISIT');
      return { value: { id: visit.id } };
    }
    case 'recordReading': {
      const data = z.object({ roomId: id, visitId: id, documentId: id, versionId: id, page: z.number().int().min(1), visibleMs: z.number().int().min(0).max(12 * 60 * 60 * 1000) }).parse(input);
      await documentAccess(tx, actor, data.roomId, data.documentId);
      const visit = await tx.huRoomVisit.findFirst({ where: { id: data.visitId, roomId: data.roomId, userId: actor.id, teamId } });
      const version = await tx.documentVersion.findFirst({ where: { id: data.versionId, documentId: data.documentId } });
      if (!visit || !version?.numPages || !version.huS3VersionId || data.page > version.numPages) throw new HttpError(404, 'Reading session not found.');
      const visibleMs = Math.min(data.visibleMs, Date.now() - visit.startedAt.getTime() + 5000);
      const key = { visitId: visit.id, documentVersionId: version.id, pageNumber: data.page };
      await tx.huPageReading.upsert({ where: { visitId_documentVersionId_pageNumber: key }, create: { ...key, teamId, documentId: data.documentId, visibleMs }, update: {} });
      await tx.huPageReading.updateMany({ where: { ...key, visibleMs: { lt: visibleMs } }, data: { visibleMs } });
      await tx.huRoomVisit.update({ where: { id: visit.id }, data: { lastSeenAt: new Date() } });
      return { value: { recorded: true } };
    }
    case 'beginUpload': {
      requireAdmin(actor);
      const data = z.object({ name: title, fileName: z.string().trim().min(1).max(300), documentId: id.optional(), stageId: id, folderId: id.nullable().default(null),
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES), thumbnailSize: z.number().int().positive().max(MAX_THUMBNAIL_BYTES).nullable().default(null) }).parse(input);
      const type = fileTypeFor(data.fileName);
      if (!type) throw new HttpError(400, 'This file type is not supported.');
      await validStage(tx, data.stageId);
      if (data.documentId) await validDocuments(tx, [data.documentId]);
      if (data.folderId) await validFolder(tx, data.folderId);
      const key = `documents/${teamId}/${randomUUID()}.${type.ext}`;
      const thumbnailKey = data.thumbnailSize && wantsThumbnail(type.kind) ? `${key}.thumb.jpg` : null;
      const document = data.documentId ? await tx.document.findUniqueOrThrow({ where: { id: data.documentId } }) : await tx.document.create({ data: {
        name: data.name, teamId, ownerId: actor.id, file: key, type: type.ext, contentType: type.mime, storageType: 'S3_PATH',
      } });
      const previous = await tx.documentVersion.aggregate({ where: { documentId: document.id }, _max: { versionNumber: true } });
      const version = await tx.documentVersion.create({ data: { documentId: document.id, versionNumber: (previous._max.versionNumber ?? 0) + 1,
        file: key, fileSize: data.size, type: type.ext, contentType: type.mime, storageType: 'S3_PATH', isPrimary: false, huThumbnailFile: thumbnailKey,
      } });
      if (!data.documentId) {
        await tx.huDocumentAccess.create({ data: { documentId: document.id, teamId, minimumStageId: data.stageId } });
        await placeDocument(tx, document.id, data.folderId);
      }
      return { value: { documentId: document.id, versionId: version.id, key, size: data.size, mime: type.mime, thumbnailKey, thumbnailSize: data.thumbnailSize } };
    }
    case 'createFolder': {
      requireAdmin(actor);
      const data = z.object({ name: folderName, parentId: id.nullable().default(null) }).parse(input);
      if (data.parentId) await validFolder(tx, data.parentId);
      if (await tx.huFolder.count({ where: { teamId } }) >= MAX_FOLDERS) throw new HttpError(400, `A maximum of ${MAX_FOLDERS} folders is supported.`);
      await uniqueFolderName(tx, data.parentId, data.name);
      return { value: await tx.huFolder.create({ data: { teamId, name: data.name, parentId: data.parentId } }) };
    }
    case 'renameFolder': {
      requireAdmin(actor);
      const data = z.object({ folderId: id, name: folderName }).parse(input);
      const folder = await validFolder(tx, data.folderId);
      await uniqueFolderName(tx, folder.parentId, data.name, folder.id);
      return { value: await tx.huFolder.update({ where: { id: folder.id }, data: { name: data.name } }) };
    }
    case 'moveFolder': {
      requireAdmin(actor);
      const data = z.object({ folderId: id, parentId: id.nullable() }).parse(input);
      const folder = await validFolder(tx, data.folderId);
      if (data.parentId) await validFolder(tx, data.parentId);
      await assertNotDescendant(tx, folder.id, data.parentId);
      await uniqueFolderName(tx, data.parentId, folder.name, folder.id);
      return { value: await tx.huFolder.update({ where: { id: folder.id }, data: { parentId: data.parentId } }) };
    }
    case 'deleteFolder': {
      // Contents move up one level instead of disappearing.
      requireAdmin(actor);
      const data = z.object({ folderId: id }).parse(input);
      const folder = await validFolder(tx, data.folderId);
      const children = await tx.huFolder.findMany({ where: { teamId, parentId: folder.id } });
      for (const child of children) await uniqueFolderName(tx, folder.parentId, child.name, child.id);
      await tx.huFolder.updateMany({ where: { teamId, parentId: folder.id }, data: { parentId: folder.parentId } });
      const moved = folder.parentId
        ? await tx.huDocumentFolder.updateMany({ where: { teamId, folderId: folder.id }, data: { folderId: folder.parentId } })
        : await tx.huDocumentFolder.deleteMany({ where: { teamId, folderId: folder.id } });
      await tx.huFolder.delete({ where: { id: folder.id } });
      return { value: { deleted: true, movedFolders: children.length, movedDocuments: moved.count } };
    }
    case 'setDocumentFolder': {
      requireAdmin(actor);
      const data = z.object({ documentId: id, folderId: id.nullable() }).parse(input);
      await validDocuments(tx, [data.documentId]);
      if (data.folderId) await validFolder(tx, data.folderId);
      await placeDocument(tx, data.documentId, data.folderId);
      return { value: { updated: true } };
    }
    default: throw new HttpError(400, 'Unknown action.');
  }
}

export async function performAction(actor: Actor, input: Record<string, unknown>) {
  if (input.action === 'publishUpload') return publishUpload(actor, input);
  let outcome: Outcome | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      outcome = await db.$transaction(tx => change(tx, actor, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
      break;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  if (!outcome) throw new HttpError(409, 'Please retry the change.');
  if (input.action === 'beginUpload') {
    const value = outcome.value as { key: string; size: number; mime: string; documentId: string; versionId: string; thumbnailKey: string | null; thumbnailSize: number | null };
    const { client, bucket } = storage();
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: value.key, ContentType: value.mime, ContentLength: value.size }), { expiresIn: 300 });
    const thumbnailUploadUrl = value.thumbnailKey && value.thumbnailSize
      ? await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: value.thumbnailKey, ContentType: THUMBNAIL_MIME, ContentLength: value.thumbnailSize }), { expiresIn: 300 })
      : null;
    return { documentId: value.documentId, versionId: value.versionId, contentType: value.mime, uploadUrl, thumbnailUploadUrl };
  }
  let failedNotifications = 0;
  for (const notice of outcome.notices ?? []) {
    try { await sendRoomInvite(notice.email, notice.roomName, notice.roomId, notice.invitedBy); } catch { failedNotifications++; }
  }
  return { ...(outcome.value as object), ...(failedNotifications ? { warning: `${failedNotifications} email notification(s) could not be delivered. Invitations can be resent from Members.` } : {}) };
}

async function publishUpload(actor: Actor, input: Record<string, unknown>) {
  requireAdmin(actor);
  const data = z.object({ versionId: id, pages: z.number().int().min(1).max(10000).nullable().default(null) }).parse(input);
  const version = await db.documentVersion.findFirst({ where: { id: data.versionId, document: { teamId, huDeletedAt: null } } });
  if (!version) throw new HttpError(404, 'Upload not found.');
  // Published versions are immutable: retries must not repin old discussions to
  // a later S3 object uploaded through a still-valid presigned upload URL.
  if (version.huS3VersionId) return { documentId: version.documentId };
  const type = fileTypeByExt(version.type);
  if (type.kind === 'pdf' && !data.pages) throw new HttpError(400, 'The PDF page count is missing.');
  const { client, bucket } = storage();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: version.file }));
  if (!head.ContentLength || head.ContentLength > MAX_UPLOAD_BYTES || BigInt(head.ContentLength) !== version.fileSize || head.ContentType !== type.mime) throw new HttpError(400, 'The uploaded file does not match the expected file.');
  if (!head.VersionId) throw new HttpError(500, 'Document storage versioning is required.');
  const prefix = await client.send(new GetObjectCommand({ Bucket: bucket, Key: version.file, VersionId: head.VersionId, Range: `bytes=0-${SIGNATURE_BYTES - 1}` }));
  const bytes = await prefix.Body?.transformToByteArray();
  if (!bytes || !matchesSignature(type, bytes)) throw new HttpError(400, `The file content does not look like a ${type.label}.`);
  // The preview is optional: a missing or invalid thumbnail never blocks publishing.
  let thumbnailVersionId: string | null = null;
  if (version.huThumbnailFile) {
    try {
      const thumb = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: version.huThumbnailFile }));
      if (thumb.VersionId && thumb.ContentType === THUMBNAIL_MIME && thumb.ContentLength && thumb.ContentLength <= MAX_THUMBNAIL_BYTES) {
        const start = await client.send(new GetObjectCommand({ Bucket: bucket, Key: version.huThumbnailFile, VersionId: thumb.VersionId, Range: 'bytes=0-2' }));
        const magic = await start.Body?.transformToByteArray();
        if (magic && matchesSignature(fileTypeByExt('jpg'), magic)) thumbnailVersionId = thumb.VersionId;
      }
    } catch { thumbnailVersionId = null; }
  }
  await db.$transaction(async tx => {
    const saved = await tx.documentVersion.findUniqueOrThrow({ where: { id: version.id } });
    if (saved.huS3VersionId) return;
    const before = await visibleDocuments(tx);
    const current = await tx.documentVersion.findFirst({ where: { documentId: version.documentId, isPrimary: true }, orderBy: { versionNumber: 'desc' } });
    if (current && current.versionNumber > version.versionNumber) throw new HttpError(409, 'A newer version has already been published.');
    await tx.documentVersion.updateMany({ where: { documentId: version.documentId, isPrimary: true }, data: { isPrimary: false } });
    const pages = type.kind === 'pdf' ? data.pages : null;
    await tx.documentVersion.update({ where: { id: version.id }, data: { isPrimary: true, numPages: pages, huS3VersionId: head.VersionId, huThumbnailS3VersionId: thumbnailVersionId } });
    await tx.document.update({ where: { id: version.documentId }, data: { file: version.file, numPages: pages, type: type.ext, contentType: type.mime } });
    await notifyDocumentChanges(tx, actor, before);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { documentId: version.documentId };
}
