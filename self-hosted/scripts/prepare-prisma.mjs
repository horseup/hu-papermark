import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Resolve relative to self-hosted/scripts, retaining the fork's schema as authority.
const actualSource = fileURLToPath(new URL('../../prisma/schema/', import.meta.url));
const actualTarget = fileURLToPath(new URL('../.generated/prisma/', import.meta.url));
await mkdir(actualTarget, { recursive: true });
await cp(actualSource, `${actualTarget}/schema`, { recursive: true });
await cp(new URL('../migrations/', import.meta.url), `${actualTarget}/migrations`, { recursive: true });
