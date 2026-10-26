# HorseUp self-hosted entrypoint

This directory is the approved dedicated application entrypoint in the
`horseup/hu-papermark` fork. Next.js builds only this directory's routes, not the
upstream `app`, `pages`, middleware, or enterprise routes. The core Prisma models
and independently implemented `lib/horseup/rooms/access-policy.ts` are shared.
The room actions and discussions are independent implementations.

## Current status

Deployed at https://dealroom.horseup.de. See [deployment record](DEPLOYMENT.md) for the pinned source, completed checks, backup restore evidence and remaining operational checks. The isolated runtime dependency audit reports zero known advisories as checked on 2026-10-26; unused upstream root dependencies are outside this result.

## Local database verification

Use Node 24 and a disposable local PostgreSQL database. Generate the client with
`node scripts/prepare-prisma.mjs`, then the installed Prisma CLI's `generate`
command. Schema files are copied into ignored `.generated/prisma`.

After applying the core schema and HorseUp migration to the disposable database,
set `POSTGRES_PRISMA_URL` and `POSTGRES_PRISMA_URL_NON_POOLING` to its local URL,
then run `node --test tests/room-actions.integration.cjs`. The runner refuses a
non-local database or a database name without the `_test` suffix. Its randomly
identified fixtures are removed afterward. It does not send email or access S3.

The SQL constraint suite is `../tests/integration/horseup-room-constraints.sql`.
Run it using `psql -v ON_ERROR_STOP=1`; fixtures are rolled back.

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

