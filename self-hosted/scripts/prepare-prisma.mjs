import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Resolve relative to self-hosted/scripts, retaining the fork's schema as authority.
const actualSource = fileURLToPath(new URL('../../prisma/', import.meta.url));
const actualTarget = fileURLToPath(new URL('../.generated/prisma/', import.meta.url));
await mkdir(actualTarget, { recursive: true });
await cp(actualSource, actualTarget, { recursive: true });
