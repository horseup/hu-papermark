import type { NextApiRequest, NextApiResponse } from 'next';
import { unsubscribe } from '../../lib/notifications';

// Token-authenticated, so no session or origin check: mail providers send
// RFC 8058 one-click POSTs with the link's query parameters.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const membershipId = String(req.query.m ?? body.m ?? '');
  const token = String(req.query.t ?? body.t ?? '');
  try {
    if (!membershipId || !token || membershipId.length > 150 || token.length > 100 || !(await unsubscribe(membershipId, token))) {
      return res.status(404).json({ error: 'This link is not valid.' });
    }
    return res.json({ unsubscribed: true });
  } catch {
    return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
  }
}
