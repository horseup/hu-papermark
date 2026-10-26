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
- Google Drive-backed room copies are under evaluation; no architecture switch approved.
- Reuse eligible upstream login, document viewing, and page/duration analytics where feasible.
- Send invitations through Resend; retain NextAuth email-link sign-in. Clerk was explicitly declined.

## Hosting scope

- AWS Frankfurt, new hu-papermark host, provisioned using HorseUp instance runbook.
- Approved and launched t3.medium: 2 vCPU, 4 GiB RAM, encrypted 40 GB gp3. Approved baseline budget: under USD 50/month.
- PostgreSQL is planned on the app host but not installed yet. EU S3 bucket exists; 50 GiB planning target, warning at 35 GiB.
- Databasus for database backups to verified EU storage. Document backups require separate configuration.
- Coolify and SSM are verified; dedicated SSH key installed. SSH is still on bootstrap port 22; final port 222 hardening follows the runbook after application deployment.
- Intended public domain: dealroom.horseup.de.
- AWS host, private versioned S3 bucket and Coolify server registration are complete. No application or DNS cutover yet.

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

The independent investor access policy is implemented in lib/horseup/rooms/access-policy.ts. Eight unit tests pass for access rules. The approved dedicated self-hosted entrypoint now contains server-side room operations, email-link authentication configuration, PDF streaming and publication, discussion history, mentions and visit/page reporting. Six database integration tests pass against disposable local PostgreSQL, along with the SQL constraint suite. They cover acceptance, stage enforcement, room isolation, discussion references/history, analytics and revocation. TypeScript checking passes. Browser flows, actual email/S3 transfers and deployment are not yet verified. No investor invitations have been sent.

The user approved the dedicated HorseUp entrypoint inside the fork, excluding upstream enterprise/SaaS routes from the build. Dependency auditing found security advisories in inherited packages; approval for patched framework/authentication/PDF versions is pending. No production app deployment should occur before these fixes and verification.

Docker, SSM, SSH and Coolify reachability/usable status were checked successfully; proxy and sentinel containers are running. CPU and S3 storage alarms are connected to the confirmed administrator email subscription. Further monitoring work is deferred at the user request.

Production deployment must use horseup/hu-papermark, with a verified commit from the implementation branch. No Coolify application or pinned deploy commit exists yet.
