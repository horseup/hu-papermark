import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { actorFor, jsonSafe, requireOrigin, sendError } from '../../lib/access';
import { performAction } from '../../lib/actions';

export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).end();
  try {
    requireOrigin(req);
    const actor = await actorFor(req, res);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid request.' });
    return res.json(jsonSafe(await performAction(actor, req.body)));
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: 'Please check the form values.' });
    return sendError(res, error);
  }
}
