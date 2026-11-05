import type { NextApiRequest, NextApiResponse } from 'next';
import { z, ZodError } from 'zod';
import { actorFor, requireOrigin, sendError } from '../../lib/access';
import { connectionsFor, disconnect } from '../../lib/oauth';

// GET: the AI assistants connected to the signed-in account. POST { grantId }: disconnect one.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const actor = await actorFor(req, res);
    if (req.method === 'GET') return res.json({ connections: await connectionsFor(actor.id) });
    if (req.method !== 'POST') return res.status(405).end();
    requireOrigin(req);
    const { grantId } = z.object({ grantId: z.string().min(1).max(200) }).parse(req.body);
    if (!(await disconnect(actor.id, grantId))) return res.status(404).json({ error: 'Connection not found.' });
    return res.json({ disconnected: true });
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: 'Invalid request.' });
    return sendError(res, error);
  }
}
