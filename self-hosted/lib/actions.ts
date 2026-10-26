import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Actor, type Database, HttpError, requireAdmin, roomContext, documentAccess } from './access';
import { adminEmails, appUrl, MAX_PDF_BYTES, teamId } from './config';
import { sendMail, sendRoomInvite } from './mail';
import { storage } from './storage';
import { db } from './db';

const id = z.string().min(1).max(150);
const title = z.string().trim().min(1).max(300);
const email = z.string().trim().toLowerCase().email().max(254);
const ids = z.array(id).max(1000).transform(value => [...new Set(value)]);
type Notice = { kind: 'invite'; email: string; roomId: string; roomName: string } |
  { kind: 'mention'; userId: string; roomId: string; documentId: string | null };
type Outcome = { value: unknown; notices?: Notice[] };

async function validStage(tx: Database, stageId: string) {
  const stage = await tx.huRoomStage.findFirst({ where: { id: stageId, teamId } });
  if (!stage) throw new HttpError(400, 'Choose a valid stage.');
  return stage;
}
async function validDocuments(tx: Database, documentIds: string[]) {
  const count = await tx.document.count({ where: { id: { in: documentIds }, teamId } });
  if (count !== documentIds.length) throw new HttpError(400, 'Choose documents from this library.');
}
async function discussionAccess(tx: Database, actor: Actor, roomId: string, discussionId: string) {
  await roomContext(tx, actor, roomId);
  const discussion = await tx.huRoomDiscussion.findFirst({ where: { id: discussionId, roomId, teamId } });
  if (!discussion) throw new HttpError(404, 'Discussion not found.');
  if (discussion.documentId) await documentAccess(tx, actor, roomId, discussion.documentId);
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
      return { value: await tx.huInvestorRoom.update({ where: { id: data.roomId }, data: { stageId: data.stageId } }) };
    }
    case 'setRoomDocuments': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, documentIds: ids }).parse(input);
      await roomContext(tx, actor, data.roomId); await validDocuments(tx, data.documentIds);
      await tx.huRoomDocument.deleteMany({ where: { roomId: data.roomId, documentId: { notIn: data.documentIds } } });
      await tx.huRoomDocument.createMany({ data: data.documentIds.map(documentId => ({ roomId: data.roomId, documentId, teamId })), skipDuplicates: true });
      return { value: { updated: true } };
    }
    case 'setDocumentStage': {
      requireAdmin(actor);
      const data = z.object({ documentId: id, stageId: id }).parse(input);
      await validStage(tx, data.stageId); await validDocuments(tx, [data.documentId]);
      return { value: await tx.huDocumentAccess.upsert({ where: { documentId: data.documentId },
        create: { documentId: data.documentId, teamId, minimumStageId: data.stageId }, update: { minimumStageId: data.stageId },
      }) };
    }
    case 'invite': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, emails: z.array(email).min(1).max(50) }).parse(input);
      const { room } = await roomContext(tx, actor, data.roomId);
      if (room.archivedAt) throw new HttpError(400, 'Reopen the room before inviting people.');
      const notices: Notice[] = [];
      for (const address of new Set(data.emails)) {
        const existing = await tx.huRoomMembership.findUnique({ where: { roomId_email: { roomId: room.id, email: address } } });
        if (existing?.acceptedAt && !existing.revokedAt) continue;
        await tx.huRoomMembership.upsert({ where: { roomId_email: { roomId: room.id, email: address } },
          create: { roomId: room.id, email: address, invitedById: actor.id },
          update: { invitedById: actor.id, invitedAt: new Date(), revokedAt: null, acceptedAt: null, userId: null },
        });
        notices.push({ kind: 'invite', email: address, roomId: room.id, roomName: room.name });
      }
      return { value: { invited: notices.length }, notices };
    }
    case 'acceptInvitation': {
      const data = z.object({ roomId: id }).parse(input);
      const found = await tx.huRoomMembership.findFirst({ where: {
        roomId: data.roomId, email: actor.email, revokedAt: null, room: { teamId, archivedAt: null },
      } });
      if (!found) throw new HttpError(404, 'Invitation not found.');
      if (!found.acceptedAt) await tx.huRoomMembership.update({ where: { id: found.id }, data: { userId: actor.id, acceptedAt: new Date() } });
      return { value: { accepted: true } };
    }
    case 'revokeMember': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, membershipId: id }).parse(input);
      await roomContext(tx, actor, data.roomId);
      const result = await tx.huRoomMembership.updateMany({ where: { id: data.membershipId, roomId: data.roomId }, data: { revokedAt: new Date() } });
      if (!result.count) throw new HttpError(404, 'Member not found.');
      return { value: { revoked: true } };
    }
    case 'archiveRoom': {
      requireAdmin(actor);
      const data = z.object({ roomId: id, archived: z.boolean() }).parse(input);
      await roomContext(tx, actor, data.roomId);
      return { value: await tx.huInvestorRoom.update({ where: { id: data.roomId }, data: { archivedAt: data.archived ? new Date() : null } }) };
    }
    case 'createDiscussion': {
      const data = z.object({ roomId: id, title, body: z.string().trim().min(1).max(20000), documentId: id.nullable(),
        versionId: id.nullable(), pageNumber: z.number().int().min(1).nullable(), mentionIds: ids.default([]), requestId: z.string().uuid() }).parse(input);
      await roomContext(tx, actor, data.roomId);
      if (data.documentId) {
        await documentAccess(tx, actor, data.roomId, data.documentId);
        const version = await tx.documentVersion.findFirst({ where: { id: data.versionId ?? '', documentId: data.documentId } });
        if (!version?.numPages || !version.huS3VersionId || (data.pageNumber && data.pageNumber > version.numPages)) throw new HttpError(400, 'Invalid document reference.');
      } else if (data.versionId || data.pageNumber) throw new HttpError(400, 'A page reference needs a document.');
      await validMentions(tx, data.roomId, data.mentionIds);
      const existing = await tx.huRoomDiscussion.findUnique({ where: { id: data.requestId } });
      if (existing) {
        if (existing.roomId !== data.roomId || existing.createdById !== actor.id) throw new HttpError(409, 'Request identifier already used.');
        return { value: { id: existing.id } };
      }
      const discussion = await tx.huRoomDiscussion.create({ data: { id: data.requestId, roomId: data.roomId, teamId, title: data.title,
        documentId: data.documentId, documentVersionId: data.versionId, pageNumber: data.pageNumber, createdById: actor.id,
      } });
      const message = await tx.huRoomMessage.create({ data: { roomId: data.roomId, discussionId: discussion.id, authorId: actor.id, body: data.body } });
      await tx.huRoomMention.createMany({ data: data.mentionIds.map(userId => ({ messageId: message.id, roomId: data.roomId, userId })) });
      return { value: { id: discussion.id }, notices: data.mentionIds.map(userId => ({ kind: 'mention', userId, roomId: data.roomId, documentId: data.documentId })) };
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
      return { value: { id: message.id }, notices: data.mentionIds.map(userId => ({ kind: 'mention', userId, roomId: data.roomId, documentId: discussion.documentId })) };
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
    case 'startVisit': {
      const data = z.object({ roomId: id, visitId: z.string().uuid() }).parse(input);
      await roomContext(tx, actor, data.roomId);
      if (actor.admin) return { value: { id: null } };
      const existing = await tx.huRoomVisit.findUnique({ where: { id: data.visitId } });
      if (existing && (existing.userId !== actor.id || existing.roomId !== data.roomId)) throw new HttpError(409, 'Visit identifier already used.');
      const visit = existing ?? await tx.huRoomVisit.create({ data: { id: data.visitId, roomId: data.roomId, teamId, userId: actor.id } });
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
      const data = z.object({ name: title, documentId: id.optional(), stageId: id, size: z.number().int().positive().max(MAX_PDF_BYTES) }).parse(input);
      await validStage(tx, data.stageId);
      if (data.documentId) await validDocuments(tx, [data.documentId]);
      const key = `documents/${teamId}/${randomUUID()}.pdf`;
      const document = data.documentId ? await tx.document.findUniqueOrThrow({ where: { id: data.documentId } }) : await tx.document.create({ data: {
        name: data.name, teamId, ownerId: actor.id, file: key, type: 'pdf', contentType: 'application/pdf', storageType: 'S3_PATH',
      } });
      const previous = await tx.documentVersion.aggregate({ where: { documentId: document.id }, _max: { versionNumber: true } });
      const version = await tx.documentVersion.create({ data: { documentId: document.id, versionNumber: (previous._max.versionNumber ?? 0) + 1,
        file: key, fileSize: data.size, type: 'pdf', contentType: 'application/pdf', storageType: 'S3_PATH', isPrimary: false,
      } });
      if (!data.documentId) await tx.huDocumentAccess.create({ data: { documentId: document.id, teamId, minimumStageId: data.stageId } });
      return { value: { documentId: document.id, versionId: version.id, key, size: data.size } };
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
    const value = outcome.value as { key: string; size: number; documentId: string; versionId: string };
    const { client, bucket } = storage();
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: value.key, ContentType: 'application/pdf', ContentLength: value.size }), { expiresIn: 300 });
    return { documentId: value.documentId, versionId: value.versionId, uploadUrl };
  }
  let failedNotifications = 0;
  for (const notice of outcome.notices ?? []) {
    try {
      if (notice.kind === 'invite') await sendRoomInvite(notice.email, notice.roomName, notice.roomId);
      else {
        const user = await db.user.findUnique({ where: { id: notice.userId } });
        if (!user?.email || !user.emailVerified || user.id === actor.id) continue;
        const recipient = { id: user.id, email: user.email.toLowerCase(), admin: adminEmails().includes(user.email.toLowerCase()) };
        if (notice.documentId) await documentAccess(db, recipient, notice.roomId, notice.documentId);
        else await roomContext(db, recipient, notice.roomId);
        await sendMail(user.email, 'You were mentioned in a HorseUp room', `A discussion in your HorseUp room mentions you. Sign in to read it:\n${appUrl()}/rooms/${notice.roomId}`);
      }
    } catch { failedNotifications++; }
  }
  return { ...(outcome.value as object), ...(failedNotifications ? { warning: `${failedNotifications} email notification(s) could not be delivered. Invitations can be resent from Members.` } : {}) };
}

async function publishUpload(actor: Actor, input: Record<string, unknown>) {
  requireAdmin(actor);
  const data = z.object({ versionId: id, pages: z.number().int().min(1).max(10000) }).parse(input);
  const version = await db.documentVersion.findFirst({ where: { id: data.versionId, document: { teamId } } });
  if (!version) throw new HttpError(404, 'Upload not found.');
  // Published versions are immutable: retries must not repin old discussions to
  // a later S3 object uploaded through a still-valid presigned upload URL.
  if (version.huS3VersionId) return { documentId: version.documentId };
  const { client, bucket } = storage();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: version.file }));
  if (!head.ContentLength || head.ContentLength > MAX_PDF_BYTES || BigInt(head.ContentLength) !== version.fileSize || head.ContentType !== 'application/pdf') throw new HttpError(400, 'The uploaded PDF does not match the expected file.');
  if (!head.VersionId) throw new HttpError(500, 'Document storage versioning is required.');
  const prefix = await client.send(new GetObjectCommand({ Bucket: bucket, Key: version.file, VersionId: head.VersionId, Range: 'bytes=0-4' }));
  if (await prefix.Body?.transformToString() !== '%PDF-') throw new HttpError(400, 'Only PDF documents can be published.');
  await db.$transaction(async tx => {
    const saved = await tx.documentVersion.findUniqueOrThrow({ where: { id: version.id } });
    if (saved.huS3VersionId) return;
    const current = await tx.documentVersion.findFirst({ where: { documentId: version.documentId, isPrimary: true }, orderBy: { versionNumber: 'desc' } });
    if (current && current.versionNumber > version.versionNumber) throw new HttpError(409, 'A newer version has already been published.');
    await tx.documentVersion.updateMany({ where: { documentId: version.documentId, isPrimary: true }, data: { isPrimary: false } });
    await tx.documentVersion.update({ where: { id: version.id }, data: { isPrimary: true, numPages: data.pages, huS3VersionId: head.VersionId } });
    await tx.document.update({ where: { id: version.documentId }, data: { file: version.file, numPages: data.pages } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { documentId: version.documentId };
}
