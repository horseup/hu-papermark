import { spawnSync } from 'node:child_process';
// This entrypoint owns a new, dedicated database. Never point it at HorseUp's API DB.
const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', '.generated/prisma/schema'], { stdio: 'inherit' });
if (migration.status !== 0) process.exit(migration.status || 1);
await import('./server.js');
