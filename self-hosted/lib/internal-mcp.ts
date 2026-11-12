import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextApiRequest } from 'next';
import { type Actor, HttpError } from './access';
import { adminEmails, appUrl, investorReplyTo, teamId } from './config';
import { db } from './db';
import { downloadableDocuments, downloadLink } from './downloads';
import { mcpAccessRequestEmail } from './emails';
import { sendMail } from './mail';
import { roomsFor } from './mcp';

// Server-to-server endpoints for the HorseUp MCP (mcp.horseup.de, apps/mcp in the monorepo).
// The MCP signs users in itself and passes only their verified email, authenticated with a
// shared service token. Membership and stage rules are the same as for the website and the
// deal room's own connector. Emails and the token are never logged.

const MIN_TOKEN_LENGTH = 32;

/** Constant-time check of the shared token. Unset token: every request is refused (503). */
export function authorizeService(req: NextApiRequest) {
  const expected = process.env.HORSEUP_MCP_SERVICE_TOKEN ?? '';
  if (expected.length < MIN_TOKEN_LENGTH) throw new HttpError(503, 'MCP access is not configured.');
  const header = req.headers.authorization ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  // Hash both sides so the comparison does not leak the token's length.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  if (!given || !timingSafeEqual(a, b)) throw new HttpError(401, 'unauthorized');
}

/** Trim and lowercase; reject anything that is not a plain address. */
export function normalizeEmail(raw: unknown): string {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9.-]+\.[a-z0-9-]+$/.test(email)) throw new HttpError(400, 'Invalid email.');
  return email;
}

// ---- Rate limits (in memory; the deal room runs as one container) -----------------------

const WINDOW_MS = 60 * 60 * 1000;
const PER_EMAIL = 30;
const PER_SERVICE = 600;
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter(at => now - at < WINDOW_MS);
  if (recent.length >= limit) throw new HttpError(429, 'Too many requests. Please try again later.');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some(at => now - at < WINDOW_MS)) hits.delete(k);
}
export function limitRequest(email: string) {
  rateLimit('service', PER_SERVICE);
  rateLimit(`email:${email}`, PER_EMAIL);
}
/** Tests reset the counters between cases. */
export function resetRateLimits() { hits.clear(); }

// ---- Membership and documents ------------------------------------------------------------

/** The deal room account for a verified email, if it exists and is verified there too. */
async function actorForEmail(email: string): Promise<Actor | null> {
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user?.email || !user.emailVerified) return null;
  return { id: user.id, email, admin: adminEmails().includes(email) };
}

export type McpRoom = {
  id: string; name: string; stage: string | null;
  /** `type` is the file extension, e.g. "pdf" or "xlsx". */
  documents: { id: string; name: string; type: string; url: string; expiresAt: string }[];
};

/** Accepted, non-revoked memberships only (administrators see every active room). */
export async function investorDocuments(email: string): Promise<{ member: false } | { member: true; rooms: McpRoom[] }> {
  const actor = await actorForEmail(email);
  if (!actor) return { member: false };
  const rooms = await roomsFor(actor);
  if (!rooms.length) return { member: false };
  const stages = new Map((await db.huRoomStage.findMany({ where: { teamId }, select: { id: true, name: true } })).map(s => [s.id, s.name]));
  const result: McpRoom[] = [];
  for (const room of rooms) {
    const { room: full, documents } = await downloadableDocuments(actor, room.id);
    result.push({
      id: room.id, name: room.name, stage: stages.get(full.stageId) ?? null,
      // Each link re-checks access when used and records the download with channel MCP.
      documents: documents.map(d => {
        const link = downloadLink(actor.id, room.id, d.id);
        return { id: d.id, name: d.fileName, type: d.ext, url: link.url, expiresAt: link.expiresAt };
      }),
    });
  }
  return { member: true, rooms: result };
}

/** investors@ hears once per address. Members are never reported. */
export async function recordAccessRequest(email: string): Promise<{ member: true } | { notified: boolean }> {
  const documents = await investorDocuments(email);
  if (documents.member) return { member: true };
  const existing = await db.huMcpAccessRequest.findUnique({ where: { teamId_email: { teamId, email } } });
  if (existing?.notifiedAt) return { notified: false };
  const row = existing ?? await db.huMcpAccessRequest.upsert({
    where: { teamId_email: { teamId, email } }, create: { teamId, email }, update: {},
  });
  // Claim the notification atomically, so two concurrent requests send one email.
  const claimed = await db.huMcpAccessRequest.updateMany({ where: { id: row.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
  if (claimed.count === 0) return { notified: false };
  const mail = mcpAccessRequestEmail(email, `${appUrl()}/`);
  try {
    await sendMail(investorReplyTo(), mail.subject, mail.text, { html: mail.html });
  } catch (error) {
    // Let a later request retry the email.
    await db.huMcpAccessRequest.update({ where: { id: row.id }, data: { notifiedAt: null } });
    throw error;
  }
  return { notified: true };
}

