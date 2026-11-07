# HorseUp self-hosted entrypoint

This directory is the deal room application in `horseup/hu-papermark`. The
original Papermark app was removed from the repository on 2026-11-05. The Prisma
schema in `../prisma/schema` and the independently implemented
`../lib/horseup/rooms/access-policy.ts` live outside this directory.

## Current status

Deployed at https://dealroom.horseup.de. See [deployment record](DEPLOYMENT.md) for the pinned source, completed checks, backup restore evidence and remaining operational checks. This directory's `package-lock.json` is the only dependency manifest in the repository.

## Members, downloads and the MCP connector

**Members.** Accepted investors can invite colleagues to their own room (10 per
request, 25 open memberships per room), resend or withdraw invitations, remove
any investor in the room, and leave. They can never remove administrators, who
are not memberships. Someone an administrator removed can only be re-invited by
an administrator. Investor invitations and removals appear in the admin digest.

**Downloads.** `GET /api/download?roomId=…&documentId=…` returns one PDF and
`?roomId=…&all=1` a ZIP (stored, not recompressed) of every document the user
can read. Access is checked per request with the same policy as the viewer.
Investor downloads are recorded in `HuRoomDownload` and listed under room
activity; administrators' own downloads are not recorded.

**MCP connector.** `https://dealroom.horseup.de/mcp` (Streamable HTTP,
stateless, JSON). Tools: `list_rooms`, `list_documents`,
`get_document_download_link` and `get_all_documents_download_link`. It cannot
read discussions or change anything. Authentication is OAuth 2.1 through
`oidc-provider`: open dynamic client registration (rate limited per IP),
PKCE required, resource indicator `…/mcp`, scope `dealroom:read`, opaque
access tokens (1 hour) and rotating refresh tokens (30 days). The user signs in
with the normal email link and approves the assistant on
`/oauth/interaction/:uid`; only invited or admin emails can approve.
Assistants are listed and disconnected on `/connect`. Each tool call
re-evaluates current membership. Download links are HMAC-signed, bound to the
user, room and document, valid for 10 minutes, and re-check access when used.

**HorseUp MCP (internal).** The global HorseUp MCP (`mcp.horseup.de`, `apps/mcp`
in the monorepo) signs users in itself and asks the deal room server to server,
with the shared token `HORSEUP_MCP_SERVICE_TOKEN` (≥ 32 characters; unset means
every request gets 503) and only the user's verified email:

- `GET /api/internal/mcp/investor-documents?email=` → `{member:false}`, or
  `{member:true, rooms:[{id, name, stage, documents:[{id, name, type, url, expiresAt}]}]}`
  with the documents the room's stage unlocks. Membership means accepted and not
  revoked, the same rule as `list_rooms`. Each `url` is a 10-minute download link
  bound to the member, and fetching it is recorded with channel `MCP`.
- `POST /api/internal/mcp/access-requests {email}` → for a verified non-member,
  emails `investors@horseup.de` (`HORSEUP_INVESTOR_REPLY_TO`) once per address
  (`HuMcpAccessRequest`): `202 {notified:true}`, then `200 {notified:false}`;
  members get `200 {member:true}` and no email.
- Rate limits: 30 requests per email and 600 overall per hour (in memory). The
  token and emails are never logged.
- Tests: `node --test tests/mcp-internal.integration.cjs` (same disposable
  database rules as below).

Metadata: `/.well-known/oauth-protected-resource/mcp` (RFC 9728),
`/.well-known/oauth-authorization-server` and
`/.well-known/openid-configuration`. OAuth state lives in `HuOAuthRecord`.
The ID-token signing key and cookie keys are derived from `NEXTAUTH_SECRET`
with HKDF, so no new secret is needed; rotating `NEXTAUTH_SECRET` ends every
connector session.

Known advisory: `archiver@8` pulls `minimatch@10` (GHSA-g3hv-75wg-m249,
moderate) through `readdir-glob`. Only archiver's glob helpers reach it; this
app only appends S3 streams.

The database suite for these features is
`node --test tests/members-downloads.integration.cjs`, with the same
disposable-database requirements as below. Run the two database suites one at a time
(`--test-concurrency=1`); in parallel their serializable transactions conflict.

## Local database verification

Use Node 24 and a disposable local PostgreSQL database. Generate the client with
`node scripts/prepare-prisma.mjs`, then the installed Prisma CLI's `generate`
command. Schema files are copied into ignored `.generated/prisma`.

After applying the core schema and HorseUp migration to the disposable database,
set `POSTGRES_PRISMA_URL` and `POSTGRES_PRISMA_URL_NON_POOLING` to its local URL,
then run `node --test tests/room-actions.integration.cjs`. The runner refuses a
non-local database or a database name without the `_test` suffix. Its randomly
identified fixtures are removed afterward. It does not send email (the mail
transport is replaced by an in-memory stub) or access S3.

The SQL constraint suite is `../tests/integration/horseup-room-constraints.sql`.
Run it using `psql -v ON_ERROR_STOP=1`; fixtures are rolled back.

Email rendering tests (no database, no email) run with `npm run test:emails`.
Set `EMAIL_PREVIEW_DIR` to also write every rendered email as HTML and text for review.

The pure access-policy suite is
`node --experimental-strip-types --test ../lib/horseup/rooms/access-policy.test.mjs`.

These are unit and database integration tests. They do not verify browser flows,
real email delivery, S3 transfers, deployment, backup restore, or TLS.

## Deployment checklist reference

- Patched dependencies, working UI, verified production build and container.
- Provision the standalone PostgreSQL database and apply reviewed migrations.
- Configure the environment from `.env.example` through the secret manager.
- Confirm the Resend sender and verify actual email-link sign-in.
- Enable the application's S3 CORS origin and instance-role `GetObjectVersion`.
- Verify document upload, immutable version publication and authenticated reading.
- Configure EU database/document backups and test a restore.
- Deploy a verified commit from this fork through Coolify; configure DNS/TLS.
- Follow the instance runbook's final SSH hardening after app/email health checks.

Published files are identified by immutable S3 version IDs. Investor PDF requests
are authorized against current room membership, document selection and stage on
every request. A later revocation cannot erase content a visitor already received.

