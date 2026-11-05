import type { NextApiRequest, NextApiResponse } from 'next';
import { optOutStatus, setOptOut } from '../../lib/notifications';

// Token-authenticated, so no session or origin check: mail providers send
// RFC 8058 one-click POSTs with the link's query parameters.
// GET reads the current state and never changes it, so link scanners are harmless.
// POST unsubscribes; POST with { resubscribe: true } in the body turns emails back on.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  const body = req.method === 'POST' && req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const membershipId = String(req.query.m ?? body.m ?? '');
  const token = String(req.query.t ?? body.t ?? '');
  try {
    if (!membershipId || !token || membershipId.length > 150 || token.length > 100) return res.status(404).json({ error: 'This link is not valid.' });
    const status = req.method === 'GET' ? await optOutStatus(membershipId, token) : await setOptOut(membershipId, token, body.resubscribe === true);
    if (!status) return res.status(404).json({ error: 'This link is not valid.' });
    return res.json({ room: status.room, roomId: status.roomId, subscribed: status.subscribed, unsubscribed: !status.subscribed });
  } catch {
    return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
  }
}
