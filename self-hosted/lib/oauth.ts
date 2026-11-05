import { createPrivateKey, hkdfSync } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import Provider, { errors, type Adapter, type AdapterPayload, type Configuration, type KoaContextWithOIDC } from 'oidc-provider';
import type { Prisma } from '@prisma/client';
import { adminEmails, appUrl, teamId } from './config';
import { db } from './db';

// OAuth 2.1 authorization server for the deal room MCP connector, built on
// oidc-provider. A user signs in with the usual email link, approves the
// connector once, and the connector then acts as that user. Every MCP call
// re-checks current room membership, so removing someone ends their access.

/** The MCP endpoint is the only resource tokens are issued for. */
export function mcpResource() { return `${appUrl()}/mcp`; }
export const MCP_SCOPE = 'dealroom:read';
export const ACCESS_TOKEN_TTL = 60 * 60;
export const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error('Signing secret is not configured');
  return value;
}
function derive(label: string, length = 32) {
  return Buffer.from(hkdfSync('sha256', secret(), 'hu-dealroom-oauth', label, length));
}

/**
 * Ed25519 signing key derived from NEXTAUTH_SECRET, so no extra secret has to be
 * provisioned. Rotating NEXTAUTH_SECRET rotates this key and ends all connector sessions.
 */
function signingKey() {
  const seed = derive('id-token-signing-key-v1');
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const jwk = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' }).export({ format: 'jwk' });
  return { ...jwk, kid: 'hu-dealroom-1', alg: 'EdDSA', use: 'sig' };
}

// ---- Prisma adapter --------------------------------------------------------

function grantable(payload: AdapterPayload) {
  return payload.grantId ?? null;
}
class PrismaAdapter implements Adapter {
  constructor(private model: string) {}
  async upsert(id: string, payload: AdapterPayload, expiresIn?: number) {
    const data = {
      payload: payload as unknown as Prisma.InputJsonValue,
      grantId: grantable(payload), userCode: payload.userCode ?? null, uid: payload.uid ?? null,
      accountId: payload.accountId ?? null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    };
    await db.huOAuthRecord.upsert({ where: { model_id: { model: this.model, id } }, create: { model: this.model, id, ...data }, update: data });
    // Opportunistic cleanup keeps the table small without a separate job.
    if (Math.random() < 0.02) await db.huOAuthRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
  private async one(where: Prisma.HuOAuthRecordWhereInput) {
    const row = await db.huOAuthRecord.findFirst({ where: { model: this.model, ...where } });
    if (!row || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) return undefined;
    return { ...(row.payload as AdapterPayload), ...(row.consumedAt ? { consumed: Math.floor(row.consumedAt.getTime() / 1000) } : {}) };
  }
  find(id: string) { return this.one({ id }); }
  findByUserCode(userCode: string) { return this.one({ userCode }); }
  findByUid(uid: string) { return this.one({ uid }); }
  async consume(id: string) { await db.huOAuthRecord.updateMany({ where: { model: this.model, id }, data: { consumedAt: new Date() } }); }
  async destroy(id: string) { await db.huOAuthRecord.deleteMany({ where: { model: this.model, id } }); }
  async revokeByGrantId(grantId: string) { await db.huOAuthRecord.deleteMany({ where: { grantId } }); }
}

/** Sign-in is allowed for administrators and anyone with an open invitation, the same rule as the email login. */
export async function mayConnect(email: string) {
  const normalized = email.trim().toLowerCase();
  if (adminEmails().includes(normalized)) return true;
  return Boolean(await db.huRoomMembership.findFirst({ where: { email: normalized, revokedAt: null, room: { teamId, archivedAt: null } }, select: { id: true } }));
}

// ---- Provider --------------------------------------------------------------

function configuration(): Configuration {
  const resource = mcpResource();
  return {
    adapter: PrismaAdapter,
    clients: [],
    async findAccount(_ctx, sub) {
      const user = await db.user.findUnique({ where: { id: sub }, select: { id: true, email: true, emailVerified: true } });
      if (!user?.email || !user.emailVerified) return undefined;
      return { accountId: user.id, claims: async () => ({ sub: user.id, email: user.email, email_verified: true }) };
    },
    claims: { email: ['email', 'email_verified'], openid: ['sub'] },
    // OpenID scopes only. MCP_SCOPE belongs to the resource server (getResourceServerInfo below).
    scopes: ['openid', 'email', 'offline_access'],
    jwks: { keys: [signingKey()] },
    cookies: { keys: [derive('cookie-key-v1').toString('base64url')], long: { signed: true }, short: { signed: true } },
    clientDefaults: { grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', id_token_signed_response_alg: 'EdDSA' },
    enabledJWA: { idTokenSigningAlgValues: ['EdDSA'] },
    pkce: { required: () => true },
    features: {
      devInteractions: { enabled: false },
      // Open dynamic client registration, as MCP clients such as Claude expect.
      registration: { enabled: true },
      revocation: { enabled: true },
      introspection: { enabled: false },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => resource,
        useGrantedResource: () => true,
        getResourceServerInfo: (_ctx, indicator) => {
          if (indicator !== resource) throw new errors.InvalidTarget();
          return { scope: MCP_SCOPE, audience: resource, accessTokenTTL: ACCESS_TOKEN_TTL, accessTokenFormat: 'opaque' };
        },
      },
    },
    issueRefreshToken: async (_ctx, client) => client.grantTypeAllowed('refresh_token'),
    rotateRefreshToken: true,
    ttl: { AccessToken: ACCESS_TOKEN_TTL, AuthorizationCode: 300, RefreshToken: REFRESH_TOKEN_TTL, Grant: REFRESH_TOKEN_TTL, Interaction: 15 * 60, Session: 7 * 24 * 60 * 60, IdToken: ACCESS_TOKEN_TTL },
    interactions: { url: (_ctx, interaction) => `/oauth/interaction/${interaction.uid}` },
    routes: {
      authorization: '/oauth/authorize', token: '/oauth/token', registration: '/oauth/register', revocation: '/oauth/revoke',
      jwks: '/oauth/jwks', userinfo: '/oauth/userinfo', end_session: '/oauth/logout',
    },
    // Native and server MCP clients need no CORS.
    clientBasedCORS: () => false,
    async renderError(ctx: KoaContextWithOIDC, out) {
      ctx.type = 'html';
      const message = String(out.error_description ?? out.error ?? 'The request could not be completed.').replace(/[<>&"]/g, '');
      ctx.body = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HorseUp deal room</title><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 16px"><h1>Connection failed</h1><p>${message}</p><p>Start the connection again from your AI assistant.</p></body>`;
    },
  };
}

const cache = globalThis as unknown as { huOAuthProvider?: Provider };
export function oauthProvider() {
  if (!cache.huOAuthProvider) {
    const provider = new Provider(appUrl(), configuration());
    // TLS ends at the Coolify proxy.
    provider.proxy = true;
    cache.huOAuthProvider = provider;
  }
  return cache.huOAuthProvider;
}

/** Routes a Next.js API request into the provider. The path is the public one, e.g. /oauth/token. */
export async function handleOAuth(req: NextApiRequest, res: NextApiResponse, path: string) {
  const original = req.url ?? '/';
  const query = original.includes('?') ? original.slice(original.indexOf('?')) : '';
  req.url = `${path}${query}`;
  await new Promise<void>((resolve, reject) => {
    res.on('finish', resolve); res.on('close', resolve);
    Promise.resolve(oauthProvider().callback()(req, res)).catch(reject);
  });
}

/** The user an access token acts for, or null. Checks expiry, audience and that the grant still exists. */
export async function verifyAccessToken(value: string) {
  const provider = oauthProvider();
  const token = await provider.AccessToken.find(value);
  if (!token || token.isExpired || !token.accountId || !token.grantId) return null;
  const audience = Array.isArray(token.aud) ? token.aud : [token.aud];
  if (!audience.includes(mcpResource())) return null;
  if (!(await provider.Grant.find(token.grantId))) return null;
  return { userId: token.accountId, clientId: token.clientId, scopes: String(token.scope ?? '').split(' ').filter(Boolean) };
}

/** RFC 9728 metadata for the MCP resource. */
export function protectedResourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [appUrl()],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'HorseUp deal room',
    resource_documentation: `${appUrl()}/connect`,
  };
}

// ---- Connected apps, for the account page ----------------------------------

export async function connectionsFor(userId: string) {
  const grants = await db.huOAuthRecord.findMany({ where: { model: 'Grant', accountId: userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } });
  const clientIds = [...new Set(grants.map(g => String((g.payload as AdapterPayload).clientId ?? '')))];
  const clients = new Map((await db.huOAuthRecord.findMany({ where: { model: 'Client', id: { in: clientIds } } })).map(c => [c.id, c.payload as AdapterPayload]));
  return grants.map(g => {
    const clientId = String((g.payload as AdapterPayload).clientId ?? '');
    const client = clients.get(clientId);
    const redirect = Array.isArray(client?.redirect_uris) ? String(client.redirect_uris[0] ?? '') : '';
    let host = ''; try { host = redirect ? new URL(redirect).host : ''; } catch { /* custom scheme */ }
    return { id: g.id, name: String(client?.client_name ?? 'AI assistant'), host, connectedAt: g.createdAt.toISOString() };
  });
}

export async function disconnect(userId: string, grantId: string) {
  const grant = await db.huOAuthRecord.findFirst({ where: { model: 'Grant', id: grantId, accountId: userId } });
  if (!grant) return false;
  await db.huOAuthRecord.deleteMany({ where: { OR: [{ model: 'Grant', id: grantId }, { grantId }] } });
  return true;
}
