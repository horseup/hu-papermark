# HorseUp deal room

The investor deal room at https://dealroom.horseup.de. It started as a fork of
[Papermark](https://github.com/mfts/papermark) and is licensed under the AGPLv3
(see [LICENSE](LICENSE)). The unused original Papermark app was removed on
2026-11-05; its history stays in git.

- `self-hosted/` is the application: code, Dockerfile, migrations, tests and
  docs. Start with [self-hosted/README.md](self-hosted/README.md).
- `prisma/schema/` holds the Prisma schema the app generates its client from.
- `lib/horseup/` holds the room access policy and its tests.
- `tests/integration/` holds the SQL constraint suite.
- `docs/horseup/` holds the original implementation scope.

`main` is the only branch and the one Coolify deploys from, pinned to a commit.
