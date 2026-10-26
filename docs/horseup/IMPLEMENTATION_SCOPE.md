# HorseUp investor rooms: implementation scope

Status: AWS host and S3 provisioned; application implementation and deployment pending.

## Confirmed product behavior

- Live investor deal room for Slush in November 2026.
- Rob and Judith administer a central document library.
- Create a room for an investor organization; select which core documents belong in it.
- Invite one or multiple people by email, add members later, and revoke membership.
- Rooms always resolve the latest version of selected core documents.
- Configurable ordered access stages (approximately five initially).
- Each document has a required access stage; advancing a room reveals eligible selected documents.
- Questions and comments are shared among members of that room and administrators, never across investor rooms.
- Discussions/messages need server timestamps, stable chronological ordering, resolve/reopen state with actor/time, and references or @mentions limited to eligible room participants.
- Preserve original document-version/page context for discussions after document updates (approved).
- Google Drive is the authoring tool; manually export approved PDFs to the central library. No Drive integration in this release.
- Reuse eligible upstream login, document viewing, and page/duration analytics where feasible.
- Send invitations through Resend; retain NextAuth email-link sign-in. Clerk was explicitly declined.

## Hosting scope

- AWS Frankfurt, new hu-papermark host, provisioned using HorseUp instance runbook.
- Approved and launched t3.medium: 2 vCPU, 4 GiB RAM, encrypted 40 GB gp3. Approved baseline budget: under USD 50/month.
- PostgreSQL 17 is running privately on the app host. EU S3 bucket exists; 50 GiB planning target, warning at 35 GiB.
- Databasus for database backups to verified EU storage. Document backups require separate configuration.
- Coolify and SSM are verified; dedicated SSH key installed. SSH is hardened on port 222; password/root login and port 22 are disabled.
- Intended public domain: dealroom.horseup.de.
- AWS host, private versioned S3 bucket and Coolify server registration are complete. Application and DNS/TLS are live.

## Initial source audit

- Public fork: horseup/hu-papermark; upstream: papermark/papermark.
- Main repository license assigns AGPLv3 to the core and separate commercial terms to enterprise directories, subject to file-specific exceptions and third-party licenses.
- Do not reuse commercially restricted room/Q&A implementations in production without a license. Build HorseUp behavior independently.
- Upstream Node engine is >=24 (README guidance is older).
- Resend implementation exists in lib/resend.ts; sender defaults are upstream Papermark addresses and must be replaced with verified HorseUp sender configuration before sending.
- Initial text scan found 209 TypeScript/TSX files importing enterprise paths across app, pages, lib, and components. This is a dependency-screening count, not a determination that all such files have identical licensing.
- Login route pages/api/auth/[...nextauth].ts imports enterprise security rate limiting. Merely hiding data-room UI does not produce an enterprise-independent deployment.
- Existing analytics uses Tinybird; compatibility, EU region, credentials and cost need evaluation before claiming reuse is deployment-ready.
- Existing email verification uses Redis-backed codes and Vercel background functions; adapt to the agreed email-link flow for this VPS rather than assuming it runs unchanged.
- Storage client imports enterprise storage configuration; replace this dependency independently with single-bucket, instance-role configuration.

## Implementation milestones

1. Audit the executable core dependency graph and establish a deployable AGPL-only baseline, replacing required restricted dependencies independently.
2. Review the proposed data model and access behavior before schema changes.
3. Implement central library selection, ordered configurable stages, room membership and document access enforcement.
4. Implement scoped invitations/authentication and prompt membership revocation.
5. Independently implement room-shared discussions with document-version context.
6. Integrate eligible analytics and Resend notifications, avoiding upstream marketing/tracking defaults.
7. Test isolation, invitation reuse/expiry, revocation, direct file URLs, stage transitions, and latest-version propagation.
8. Provision and validate the approved host, database, EU storage, backup restore and Coolify deployment.
9. Configure domain/TLS; validate administrator and investor flows before launch.

## Decisions to settle before implementation

- Confirmed: one stage per room, shared by every member; no per-member stage.
- Stage downgrade behavior and removal/reordering of stages with existing documents.
- How discussions anchored to an old document page appear after a new version is uploaded.
- Whether document downloads are permitted and how revocation limits apply to already downloaded files.
- Notification events and frequency (invitation, first visit, new question, stage promotion).
- Restore point/retention targets and independent document backup strategy.

## Validation status

The dedicated HorseUp entrypoint is deployed at https://dealroom.horseup.de from fork commit 7c01e366acc16fdb984864ba14e3798d82c120c5. See ../../self-hosted/DEPLOYMENT.md for resources, verification and operational limitations.

Eight access-policy unit tests, six disposable PostgreSQL integration tests and the SQL constraint suite passed. These prove policy and database behavior, not every investor browser journey. The dedicated dependency audit reports zero known advisories as checked on 2026-10-26; this does not cover unused upstream root dependencies.

Live browser checks passed for Resend email-link authentication, administrator workspace, stage creation, PDF upload to S3, immutable publication, PDF viewing, discussion/reply and resolution. Synthetic fixtures are clearly labeled and contain no investor data. Investor invitation acceptance and multi-user browser behavior have not yet been exercised against the live deployment.

Daily encrypted Databasus backups use a dedicated private Frankfurt S3 bucket and one-month retention. First backup and temporary restore verification succeeded: 90 tables, pg_restore exit code 0. Backup credentials are stored in Infisical. New document versions are replicated into a separate private Frankfurt bucket, preserving version IDs and excluding delete markers.

