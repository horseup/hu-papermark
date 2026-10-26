# HorseUp deal room deployment

Verified 2026-10-26. Public URL: https://dealroom.horseup.de.

## Source and runtime

- Repository: https://github.com/horseup/hu-papermark
- Branch: codex/investor-rooms
- Runtime commit: 7c01e366acc16fdb984864ba14e3798d82c120c5
- Dedicated self-hosted/Dockerfile; upstream commercial routes excluded.
- EC2 eu-central-1 i-0459d221e872d0ac6, t3.medium, encrypted 40 GB gp3.
- Coolify server sexrxw9utshltxnzkkpuo0wj; app brpnkywxcuzedeiaa7yuv1c4.
- PostgreSQL 17: pc9zydurh0bvc8hv9fk9kd9j, private coolify network.
- Runtime limits: app 1536 MiB / 1.25 CPU; PostgreSQL 768 MiB / 0.75 CPU.
- DNS-only A record 63.187.53.39; valid HTTPS. This is not an Elastic IP: update DNS after any stop/start that changes the address.
- SSH key-only port 222; users ubuntu and restricted hu-backup. UFW and fail2ban active. AWS port 22 ingress removed.

## Secrets

Infisical project bd87e1e6-cb3a-4f74-bbea-ac9cb58eab1f, prod environment, rob@horseup.de profile, https://infisical.horseup.de.
Values must never be committed. Secret names:

- HU_PAPERMARK_DB_PASSWORD
- HU_PAPERMARK_AUTH_SECRET
- HU_PAPERMARK_BACKUP_DB_PASSWORD
- HU_PAPERMARK_BACKUP_SSH_PRIVATE_KEY
- HU_PAPERMARK_BACKUP_S3_KEY_ID
- HU_PAPERMARK_BACKUP_S3_SECRET
- RESEND_API_KEY (existing send-only key)

## Backup and restore

Databasus database "HorseUp deal room": daily at 01:00 as displayed by Databasus, one-month retention, encrypted, three retry attempts. Storage "HorseUp deal room · Frankfurt" uses private versioned S3 bucket hu-papermark-backups-143207290060-eu-central-1. Dedicated IAM user can access only that bucket.

Read-only PostgreSQL login hu_backup uses pg_read_all_data and cannot create temporary tables. SSH user hu-backup is restricted to port forwarding to 127.0.0.1:55433, with command execution disabled. SSH host uses port 222. The root-owned hu-backup-tunnel systemd service listens only on loopback and resolves the database container's current coolify-network IP for every connection. This survives Coolify database container recreation. Its files are /etc/systemd/system/hu-backup-tunnel.service and /usr/local/sbin/hu-backup-connect. The earlier loopback Docker mapping on 55432 is not needed by backups and may be removed by a normal database redeploy.

First encrypted backup succeeded (0.31 MB). Databasus temporary restore verification succeeded: 90 tables, pg_restore exit code 0, restored size 13.64 MB. It verified five stages and the synthetic room/document/discussion records. This was a temporary restore, not an overwrite of the live database.

Document bucket hu-papermark-documents-143207290060-eu-central-1 is private, encrypted and versioned. The app uses immutable S3 version IDs. Versioning is not an independent backup: independent document replication and its recovery mapping are still outstanding. No expiration policy may remove referenced versions.

## Evidence and limits

- HTTPS health endpoint 200; anonymous workspace API 401.
- Real Resend email delivered to Rob; email-link admin sign-in succeeded.
- Live browser: stage creation, S3 PDF upload/publication, PDF canvas, question/reply and resolve.
- Eight policy unit tests, six disposable PostgreSQL integration tests and SQL constraints passed. These do not prove all live investor browser journeys.
- Live investor invitation acceptance, mentions and simultaneous multi-user journeys remain to be exercised; no external investors were invited by deployment verification.
- Synthetic fixture is named SYNTHETIC deployment verification; it contains no financial or investor information.
- Databasus failure notifications have no notifier selected yet. Existing CPU/storage SNS notifications go to the confirmed Rob address.

## Recovery notes

During initial deployment the Coolify control server became unavailable after image build. The app was recovered using Coolify's generated Compose file with secrets populated from Infisical. Control service subsequently recovered, and its pin was reconciled to the runtime commit above. Do not infer successful future releases from a queued deployment: verify the exact commit, deployment result, container health and public endpoint.

On database recreation, check the backup relay, Databasus connection, successful new backup and temporary restore. On app changes, apply only the dedicated self-hosted migration ledger and retain an immediately preceding verified backup.
