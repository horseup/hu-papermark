import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { appUrl } from '../../lib/config';
import { db } from '../../lib/db';
import { MCP_SCOPE, mayConnect, mcpResource, oauthProvider } from '../../lib/oauth';

// POST /oauth/interaction/:uid/allow and /oauth/interaction/:uid/deny (rewritten here).
// The interaction cookie is scoped to /oauth/interaction/:uid, so only the browser
// that started this authorization can finish it.
export const config = { api: { externalResolver: true } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers.origin !== appUrl()) return res.status(403).send('Invalid request origin.');
  const provider = oauthProvider();
  try {
    const details = await provider.interactionDetails(req, res);
    if (details.uid !== req.query.uid) return res.status(400).send('This approval belongs to another connection attempt.');
    if (req.query.step === 'deny') {
      return await provider.interactionFinished(req, res, { error: 'access_denied', error_description: 'The deal room user declined the connection.' }, { mergeWithLastSubmission: false });
    }
    if (req.query.step !== 'allow') return res.status(404).end();
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    const user = email ? await db.user.findUnique({ where: { email } }) : null;
    if (!user?.emailVerified || !email || !(await mayConnect(email))) return res.status(403).send('Please sign in with an invited email address and try again.');

    const clientId = String(details.params.client_id);
    // Reconnecting the same assistant reuses its grant, so it is listed once and disconnects in one step.
    const existingId = details.grantId ?? (await db.huOAuthRecord.findFirst({
      where: { model: 'Grant', accountId: user.id, payload: { path: ['clientId'], equals: clientId } }, orderBy: { createdAt: 'desc' }, select: { id: true },
    }))?.id;
    const grant = existingId ? await provider.Grant.find(existingId) : undefined;
    const next = grant ?? new provider.Grant({ accountId: user.id, clientId });
    if (grant && grant.accountId !== user.id) return res.status(403).send('This connection belongs to another account.');
    const requested = String(details.params.scope ?? '').split(' ').filter(Boolean);
    const oidc = [...new Set([...requested.filter(s => ['openid', 'email', 'offline_access'].includes(s)), MCP_SCOPE])];
    next.addOIDCScope(oidc.join(' '));
    next.addResourceScope(mcpResource(), MCP_SCOPE);
    const grantId = await next.save();
    await provider.interactionFinished(req, res, { login: { accountId: user.id }, consent: { grantId } }, { mergeWithLastSubmission: false });
  } catch {
    if (!res.headersSent) res.status(400).send('This connection request has expired. Start it again from your AI assistant.');
  }
}
