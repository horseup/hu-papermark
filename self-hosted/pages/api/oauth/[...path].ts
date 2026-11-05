import type { NextApiRequest, NextApiResponse } from 'next';
import { handleOAuth } from '../../../lib/oauth';

// Public paths /oauth/* and /.well-known/openid-configuration are rewritten here
// (next.config.mjs). The provider parses its own request bodies.
export const config = { api: { bodyParser: false, externalResolver: true } };

const registrations = new Map<string, { count: number; until: number }>();
/** Open client registration is rate limited per address: 20 per hour. */
function registrationAllowed(req: NextApiRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  for (const [key, value] of registrations) if (value.until < now) registrations.delete(key);
  const entry = registrations.get(ip) ?? { count: 0, until: now + 60 * 60 * 1000 };
  if (entry.count >= 20 || registrations.size > 10000) return false;
  registrations.set(ip, { ...entry, count: entry.count + 1 });
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const segments = ([] as string[]).concat(req.query.path ?? []);
  // /.well-known/oauth-authorization-server (RFC 8414) gets the same document as OpenID discovery.
  const path = segments[0] === '.well-known' ? '/.well-known/openid-configuration' : `/oauth/${segments.map(encodeURIComponent).join('/')}`;
  if (path === '/oauth/register' && req.method === 'POST' && !registrationAllowed(req)) {
    return res.status(429).json({ error: 'temporarily_unavailable', error_description: 'Too many registrations. Try again later.' });
  }
  await handleOAuth(req, res, path);
}
