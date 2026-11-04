import { createHmac, timingSafeEqual } from 'node:crypto';
import type { HuNotification, HuNotificationKind } from '@prisma/client';
import { type Actor, type Database, documentAccess, threadAccess } from './access';
import { adminEmails, appUrl, investorReplyTo, NOTIFICATION_SENDER_NAME, notificationMaxWaitMs, notificationQuietMs, teamId } from './config';
import { db } from './db';
import { sendMail } from './mail';

// Notification outbox. Changes write rows inside their own transaction; the
// flusher sends one debounced email per recipient and re-checks access first.
// Emails carry room names, document names and links only, never content.

type Pending = { roomId: string; recipientEmail: string; kind: HuNotificationKind; actorId?: string | null;
  documentId?: string | null; documentVersionId?: string | null; discussionId?: string | null };

async function enqueue(tx: Database, rows: Pending[]) {
  if (rows.length) await tx.huNotification.createMany({ data: rows.map(row => ({ ...row, teamId, recipientEmail: row.recipientEmail.trim().toLowerCase() })) });
}

function activeMembers(tx: Database, roomId: string) {
  return tx.huRoomMembership.findMany({ where: { roomId, acceptedAt: { not: null }, revokedAt: null, userId: { not: null } }, select: { id: true, email: true, userId: true } });
}

/** roomId -> documentId -> published primary version id, for open rooms. */
export type Visibility = Map<string, Map<string, string>>;
export async function visibleDocuments(tx: Database): Promise<Visibility> {
  const stages = await tx.huRoomStage.findMany({ where: { teamId }, select: { id: true, position: true } });
  const position = new Map(stages.map(stage => [stage.id, stage.position]));
  const rooms = await tx.huInvestorRoom.findMany({ where: { teamId, archivedAt: null }, select: { id: true, stageId: true,
    documents: { select: { document: { select: { id: true, huDeletedAt: true, huAccessRule: { select: { minimumStageId: true } },
      versions: { where: { isPrimary: true, huS3VersionId: { not: null } }, orderBy: { versionNumber: 'desc' }, take: 1, select: { id: true } } } } } } } });
  const result: Visibility = new Map();
  for (const room of rooms) {
    const roomPosition = position.get(room.stageId);
    const visible = new Map<string, string>();
    for (const { document } of room.documents) {
      const minimum = document.huAccessRule ? position.get(document.huAccessRule.minimumStageId) : undefined;
      if (document.huDeletedAt || !document.versions[0] || roomPosition === undefined || minimum === undefined || roomPosition < minimum) continue;
      visible.set(document.id, document.versions[0].id);
    }
    result.set(room.id, visible);
  }
  return result;
}

/** Compares a snapshot taken before the change with the current state. */
export async function notifyDocumentChanges(tx: Database, actor: Actor, before: Visibility) {
  const after = await visibleDocuments(tx);
  const rows: Pending[] = [];
  for (const [roomId, documents] of after) {
    const prior = before.get(roomId) ?? new Map<string, string>();
    const changes: Pending[] = [];
    for (const [documentId, versionId] of documents) {
      const previous = prior.get(documentId);
      if (previous === versionId) continue;
      changes.push({ roomId, recipientEmail: '', kind: previous === undefined ? 'DOCUMENT_AVAILABLE' : 'DOCUMENT_UPDATED', actorId: actor.id, documentId, documentVersionId: versionId });
    }
    if (!changes.length) continue;
    for (const member of await activeMembers(tx, roomId)) {
      if (member.userId === actor.id) continue;
      for (const change of changes) rows.push({ ...change, recipientEmail: member.email });
    }
  }
  await enqueue(tx, rows);
}

/** New discussion or reply: admins hear about investor messages, investors about replies in their threads. */
export async function notifyDiscussionMessage(tx: Database, actor: Actor, roomId: string, discussionId: string, mentionIds: string[]) {
  const admins = adminEmails();
  const rows: Pending[] = [];
  const base = { roomId, actorId: actor.id, discussionId };
  if (!actor.admin) for (const email of admins) if (email !== actor.email) rows.push({ ...base, recipientEmail: email, kind: 'ADMIN_MESSAGE' });
  const discussion = await tx.huRoomDiscussion.findUniqueOrThrow({ where: { id: discussionId }, select: { createdById: true, messages: { select: { authorId: true } } } });
  const participants = new Set([discussion.createdById, ...discussion.messages.map(m => m.authorId)]);
  participants.delete(actor.id);
  const users = await tx.user.findMany({ where: { id: { in: [...participants, ...mentionIds] } }, select: { id: true, email: true } });
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email || user.id === actor.id) continue;
    if (mentionIds.includes(user.id)) rows.push({ ...base, recipientEmail: email, kind: 'MENTION' });
    // Admins already receive ADMIN_MESSAGE for investor posts; admin posts do not notify other admins.
    else if (participants.has(user.id) && !admins.includes(email)) rows.push({ ...base, recipientEmail: email, kind: 'THREAD_REPLY' });
  }
  await enqueue(tx, rows);
}

export async function notifyAdmins(tx: Database, actor: { id: string; email: string }, roomId: string, kind: 'ADMIN_INVITE_ACCEPTED' | 'ADMIN_FIRST_VISIT') {
  if (adminEmails().includes(actor.email)) return;
  await enqueue(tx, adminEmails().map(email => ({ roomId, recipientEmail: email, kind, actorId: actor.id })));
}

/** Only investors who had accepted are told; pending invitations end silently. */
export async function notifyAccessEnded(tx: Database, actor: Actor, roomId: string, memberships: { email: string; userId: string | null; acceptedAt: Date | null }[]) {
  await enqueue(tx, memberships.filter(m => m.acceptedAt && m.userId && m.userId !== actor.id)
    .map(m => ({ roomId, recipientEmail: m.email, kind: 'ACCESS_ENDED' as const, actorId: actor.id })));
}

// ---- Opt-out links -------------------------------------------------------

function unsubscribeSignature(membershipId: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('Signing secret is not configured');
  return createHmac('sha256', secret).update(`hu-unsubscribe:${membershipId}`).digest('base64url');
}
export function unsubscribeUrl(membershipId: string) {
  return `${appUrl()}/unsubscribe?m=${encodeURIComponent(membershipId)}&t=${unsubscribeSignature(membershipId)}`;
}
export async function unsubscribe(membershipId: string, token: string) {
  const expected = Buffer.from(unsubscribeSignature(membershipId));
  const given = Buffer.from(token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  await db.huRoomMembership.updateMany({ where: { id: membershipId, notificationsMutedAt: null, room: { teamId } }, data: { notificationsMutedAt: new Date() } });
  return true;
}

// ---- Flushing ------------------------------------------------------------

const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const INVESTOR_KINDS: HuNotificationKind[] = ['DOCUMENT_AVAILABLE', 'DOCUMENT_UPDATED', 'THREAD_REPLY', 'MENTION'];
type Recipient = { email: string; admin: boolean; user: { id: string; emailVerified: Date | null } | null };
type Delivery = { subject: string; text: string; headers?: Record<string, string>; replyTo?: string };

async function stillRelevant(row: HuNotification, recipient: Recipient): Promise<boolean> {
  if (recipient.user && row.actorId === recipient.user.id) return false;
  if (row.kind.startsWith('ADMIN_')) {
    if (!recipient.admin) return false;
    if (row.kind !== 'ADMIN_MESSAGE') return true;
    return Boolean(await db.huRoomDiscussion.findFirst({ where: { id: row.discussionId ?? '', roomId: row.roomId }, select: { id: true } }));
  }
  if (row.kind === 'ACCESS_ENDED') {
    if (recipient.admin) return false;
    const membership = await db.huRoomMembership.findUnique({ where: { roomId_email: { roomId: row.roomId, email: recipient.email } }, include: { room: true } });
    // Re-invited or reopened before the batch went out: nothing ended.
    return Boolean(membership?.acceptedAt && (membership.revokedAt || membership.room.archivedAt));
  }
  if (!INVESTOR_KINDS.includes(row.kind) || !recipient.user?.emailVerified) return false;
  if (!recipient.admin) {
    const membership = await db.huRoomMembership.findFirst({ where: { roomId: row.roomId, email: recipient.email, userId: recipient.user.id, acceptedAt: { not: null }, revokedAt: null } });
    if (!membership || membership.notificationsMutedAt) return false;
  }
  const actor: Actor = { id: recipient.user.id, email: recipient.email, admin: recipient.admin };
  try {
    if (row.kind === 'DOCUMENT_AVAILABLE' || row.kind === 'DOCUMENT_UPDATED') {
      await documentAccess(db, actor, row.roomId, row.documentId ?? '');
      return Boolean(await db.documentVersion.findFirst({ where: { documentId: row.documentId ?? '', isPrimary: true, huS3VersionId: { not: null } }, select: { id: true } }));
    }
    const discussion = await db.huRoomDiscussion.findFirst({ where: { id: row.discussionId ?? '', roomId: row.roomId } });
    if (!discussion) return false;
    await threadAccess(db, actor, row.roomId, discussion.documentId);
    return true;
  } catch { return false; }
}

async function describe(rows: HuNotification[]) {
  const rooms = new Map((await db.huInvestorRoom.findMany({ where: { id: { in: [...new Set(rows.map(r => r.roomId))] } }, select: { id: true, name: true } })).map(r => [r.id, r.name]));
  const discussions = new Map((await db.huRoomDiscussion.findMany({ where: { id: { in: rows.flatMap(r => r.discussionId ? [r.discussionId] : []) } }, select: { id: true, documentId: true } })).map(d => [d.id, d.documentId]));
  const documentIds = [...new Set([...rows.flatMap(r => r.documentId ? [r.documentId] : []), ...[...discussions.values()].flatMap(id => id ? [id] : [])])];
  const documents = new Map((await db.document.findMany({ where: { id: { in: documentIds } }, select: { id: true, name: true,
    versions: { where: { isPrimary: true }, orderBy: { versionNumber: 'desc' }, take: 1, select: { versionNumber: true } } } })).map(d => [d.id, d]));
  const actors = new Map((await db.user.findMany({ where: { id: { in: rows.flatMap(r => r.actorId ? [r.actorId] : []) } }, select: { id: true, email: true } })).map(u => [u.id, u.email ?? 'An investor']));
  const topic = (discussionId: string | null) => {
    const documentId = discussionId ? discussions.get(discussionId) : null;
    const name = documentId ? documents.get(documentId)?.name : null;
    return name ? `a discussion about "${name}"` : 'a room-wide discussion';
  };
  return { room: (id: string) => rooms.get(id) ?? 'your deal room', document: (id: string | null) => documents.get(id ?? ''), actor: (id: string | null) => actors.get(id ?? '') ?? 'An investor', topic };
}

function byRoom(rows: HuNotification[]) {
  const groups = new Map<string, HuNotification[]>();
  for (const row of rows) groups.set(row.roomId, [...(groups.get(row.roomId) ?? []), row]);
  return groups;
}

async function investorEmail(rows: HuNotification[], recipient: Recipient): Promise<Delivery> {
  const names = await describe(rows);
  const sections: string[] = []; const optOuts: { room: string; url: string }[] = [];
  const updateRooms: string[] = []; const endedRooms: string[] = [];
  for (const [roomId, items] of byRoom(rows)) {
    const room = names.room(roomId);
    if (items.some(i => i.kind === 'ACCESS_ENDED')) {
      endedRooms.push(room);
      sections.push(`Your access to "${room}" has ended. If you have questions, reply to this email.`);
      continue;
    }
    updateRooms.push(room);
    const added = [...new Set(items.filter(i => i.kind === 'DOCUMENT_AVAILABLE').map(i => i.documentId ?? ''))];
    const updated = [...new Set(items.filter(i => i.kind === 'DOCUMENT_UPDATED' && !added.includes(i.documentId ?? '')).map(i => i.documentId ?? ''))];
    const lines = [`"${room}"`];
    if (added.length) lines.push('', 'New documents available:', ...added.map(id => `- ${names.document(id)?.name ?? 'Document'}`));
    if (updated.length) lines.push('', 'Updated documents:', ...updated.map(id => { const doc = names.document(id); return `- ${doc?.name ?? 'Document'}${doc?.versions[0] ? ` (version ${doc.versions[0].versionNumber})` : ''}`; }));
    const threads = new Map<string, HuNotification[]>();
    for (const item of items) if (item.discussionId) threads.set(item.discussionId, [...(threads.get(item.discussionId) ?? []), item]);
    if (threads.size) lines.push('', 'Discussions:', ...[...threads].map(([discussionId, entries]) => {
      const replies = entries.filter(e => e.kind === 'THREAD_REPLY').length;
      const mentioned = entries.some(e => e.kind === 'MENTION');
      const what = mentioned ? 'You were mentioned in' : replies > 1 ? `${replies} new replies in` : 'New reply in';
      return `- ${what} ${names.topic(discussionId)}`;
    }));
    lines.push('', `Open the room: ${appUrl()}/rooms/${encodeURIComponent(roomId)}`);
    sections.push(lines.join('\n'));
    const membership = await db.huRoomMembership.findUnique({ where: { roomId_email: { roomId, email: recipient.email } }, select: { id: true } });
    if (membership) optOuts.push({ room, url: unsubscribeUrl(membership.id) });
  }
  const subject = updateRooms.length === 0
    ? (endedRooms.length === 1 ? `Your access to ${endedRooms[0]} has ended` : 'Your access to HorseUp deal rooms has ended')
    : (updateRooms.length === 1 && !endedRooms.length ? `Updates in ${updateRooms[0]}` : 'Updates in your HorseUp deal rooms');
  const intro = updateRooms.length ? 'There are updates in your HorseUp deal room. Sign in with this email address to see them.' : 'An update about your HorseUp deal room access.';
  const footer = optOuts.length ? ['', '--', 'You receive these emails because you were invited to the room above. Reply to this email to reach the HorseUp team.',
    ...optOuts.map(o => `Stop notification emails for "${o.room}": ${o.url}`)] : [];
  const headers = optOuts.length === 1 ? { 'List-Unsubscribe': `<${optOuts[0].url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
  return { subject, text: ['Hello,', '', intro, '', sections.join('\n\n'), ...footer].join('\n'), headers, replyTo: investorReplyTo() };
}

async function adminEmail(rows: HuNotification[]): Promise<Delivery> {
  const names = await describe(rows);
  const sections: string[] = [];
  for (const [roomId, items] of byRoom(rows)) {
    const lines = [names.room(roomId)];
    const seen = new Set<string>();
    for (const item of items) {
      const who = names.actor(item.actorId);
      if (item.kind === 'ADMIN_INVITE_ACCEPTED') lines.push(`- ${who} accepted the invitation`);
      else if (item.kind === 'ADMIN_FIRST_VISIT') lines.push(`- ${who} opened the room for the first time`);
      else if (item.discussionId && (item.kind === 'ADMIN_MESSAGE' || item.kind === 'MENTION' || item.kind === 'THREAD_REPLY')) {
        const key = `${item.discussionId}:${item.actorId}`;
        if (seen.has(key)) continue; seen.add(key);
        const count = items.filter(i => i.discussionId === item.discussionId && i.actorId === item.actorId && i.kind === 'ADMIN_MESSAGE').length;
        const mentioned = items.some(i => i.discussionId === item.discussionId && i.actorId === item.actorId && i.kind === 'MENTION');
        lines.push(`- ${who} ${mentioned ? 'mentioned you in' : count > 1 ? `wrote ${count} messages in` : 'wrote in'} ${names.topic(item.discussionId)}`);
      }
    }
    lines.push(`Open: ${appUrl()}/rooms/${encodeURIComponent(roomId)}`);
    sections.push(lines.join('\n'));
  }
  const rooms = [...byRoom(rows).keys()];
  const subject = rooms.length === 1 ? `Deal room activity in ${names.room(rooms[0])}` : `Deal room activity in ${rooms.length} rooms`;
  return { subject, text: ['Investor activity in the HorseUp deal room:', '', sections.join('\n\n')].join('\n') };
}

async function deliver(email: string, rows: HuNotification[], now: Date) {
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, emailVerified: true } });
  const recipient: Recipient = { email, admin: adminEmails().includes(email), user };
  const keep: HuNotification[] = []; const drop: string[] = [];
  for (const row of rows) { if (await stillRelevant(row, recipient)) keep.push(row); else drop.push(row.id); }
  if (drop.length) await db.huNotification.updateMany({ where: { id: { in: drop } }, data: { processedAt: now, outcome: 'skipped', claimedAt: null } });
  if (!keep.length) return { sent: 0, skipped: drop.length, failed: 0 };
  const ids = keep.map(r => r.id);
  try {
    const mail = recipient.admin ? await adminEmail(keep) : await investorEmail(keep, recipient);
    await sendMail(email, mail.subject, mail.text, { fromName: NOTIFICATION_SENDER_NAME, replyTo: mail.replyTo, headers: mail.headers });
    await db.huNotification.updateMany({ where: { id: { in: ids } }, data: { processedAt: new Date(), outcome: 'sent', claimedAt: null } });
    return { sent: 1, skipped: drop.length, failed: 0 };
  } catch (error) {
    console.error('HorseUp notification email failed', error instanceof Error ? error.name : 'UnknownError');
    const attempts = Math.max(...keep.map(r => r.attempts)) + 1;
    await db.huNotification.updateMany({ where: { id: { in: ids } }, data: attempts >= MAX_ATTEMPTS
      ? { attempts, claimedAt: null, processedAt: new Date(), outcome: 'failed' } : { attempts, claimedAt: null } });
    return { sent: 0, skipped: drop.length, failed: 1 };
  }
}

let flushing = false;
/** Sends every recipient batch whose quiet window has passed. Safe to call often. */
export async function flushNotifications(now = new Date()) {
  const totals = { sent: 0, skipped: 0, failed: 0 };
  if (flushing) return totals;
  flushing = true;
  try {
    const pending = await db.huNotification.findMany({ where: { teamId, processedAt: null }, orderBy: { createdAt: 'asc' } });
    const groups = new Map<string, HuNotification[]>();
    for (const row of pending) groups.set(row.recipientEmail, [...(groups.get(row.recipientEmail) ?? []), row]);
    for (const [email, rows] of groups) {
      const quiet = rows[rows.length - 1].createdAt.getTime() <= now.getTime() - notificationQuietMs();
      const overdue = rows[0].createdAt.getTime() <= now.getTime() - notificationMaxWaitMs();
      if (!quiet && !overdue) continue;
      const claim = new Date();
      await db.huNotification.updateMany({ where: { id: { in: rows.map(r => r.id) }, processedAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(claim.getTime() - CLAIM_TIMEOUT_MS) } }] }, data: { claimedAt: claim } });
      const claimed = await db.huNotification.findMany({ where: { id: { in: rows.map(r => r.id) }, claimedAt: claim }, orderBy: { createdAt: 'asc' } });
      if (!claimed.length) continue;
      const result = await deliver(email, claimed, claim);
      totals.sent += result.sent; totals.skipped += result.skipped; totals.failed += result.failed;
    }
  } finally { flushing = false; }
  return totals;
}

export function startNotificationTimer() {
  const state = globalThis as typeof globalThis & { __huNotificationTimer?: ReturnType<typeof setInterval> };
  if (state.__huNotificationTimer || process.env.HORSEUP_NOTIFICATIONS_DISABLED === '1') return;
  state.__huNotificationTimer = setInterval(() => {
    flushNotifications().catch(error => console.error('HorseUp notification flush failed', error instanceof Error ? error.name : 'UnknownError'));
  }, 60 * 1000);
  state.__huNotificationTimer.unref?.();
}
