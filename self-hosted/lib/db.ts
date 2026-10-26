import { PrismaClient } from '@prisma/client';

const globalDb = globalThis as unknown as { horseupDb?: PrismaClient };
export const db = globalDb.horseupDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.horseupDb = db;
