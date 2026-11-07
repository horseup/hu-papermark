import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpError, jsonSafe, sendError } from '../../../../lib/access';
import { authorizeService, investorDocuments, limitRequest, normalizeEmail } from '../../../../lib/internal-mcp';

// GET ?email=…  For the HorseUp MCP only (shared service token). The email is already
// verified by HorseUp sign-in. Answers {member:false} or the member's rooms with the
// documents their stage unlocks, as 10-minute links that record an MCP download when used.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    authorizeService(req);
    const email = normalizeEmail(req.query.email);
    limitRequest(email);
    return res.status(200).json(jsonSafe(await investorDocuments(email)));
  } catch (error) { return sendError(res, error); }
}
