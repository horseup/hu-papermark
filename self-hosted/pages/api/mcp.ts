import type { NextApiRequest, NextApiResponse } from 'next';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { appUrl } from '../../lib/config';
import { actorForUser } from '../../lib/downloads';
import { dealRoomServer } from '../../lib/mcp';
import { verifyAccessToken } from '../../lib/oauth';

// Public URL /mcp (rewritten here). Streamable HTTP, stateless, JSON responses.
// Every request needs an OAuth access token issued for this resource.
export const config = { api: { bodyParser: { sizeLimit: '64kb' }, externalResolver: true } };

function unauthorized(res: NextApiResponse, invalid: boolean) {
  const metadata = `${appUrl()}/.well-known/oauth-protected-resource/mcp`;
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${metadata}"${invalid ? ', error="invalid_token"' : ''}`);
  return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Sign in to the HorseUp deal room to use this connector.' }, id: null });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  // DNS rebinding protection: browsers send Origin; native and server clients do not.
  if (req.headers.origin && req.headers.origin !== appUrl()) return res.status(403).json({ error: 'Origin not allowed.' });
  const header = req.headers.authorization ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) return unauthorized(res, false);
  const claims = await verifyAccessToken(token).catch(() => null);
  if (!claims) return unauthorized(res, true);
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  let actor;
  try { actor = await actorForUser(claims.userId); } catch { return unauthorized(res, true); }

  const server = dealRoomServer(actor);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error.' }, id: null });
  }
}
