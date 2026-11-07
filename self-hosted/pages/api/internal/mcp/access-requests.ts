import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpError, sendError } from '../../../../lib/access';
import { authorizeService, limitRequest, normalizeEmail, recordAccessRequest } from '../../../../lib/internal-mcp';

// POST {email}  For the HorseUp MCP only (shared service token). A verified email that is not
// a room member asked for investor materials: investors@ is emailed once per address.
export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    authorizeService(req);
    const email = normalizeEmail(req.body?.email);
    limitRequest(email);
    const result = await recordAccessRequest(email);
    return res.status('notified' in result && result.notified ? 202 : 200).json(result);
  } catch (error) { return sendError(res, error); }
}
