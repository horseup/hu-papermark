import type { NextApiRequest, NextApiResponse } from 'next';
import { protectedResourceMetadata } from '../../lib/oauth';

// /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/mcp (RFC 9728).
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json(protectedResourceMetadata());
}
