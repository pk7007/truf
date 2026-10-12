import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { trufDb?: PrismaClient };
export const db = globalDb.trufDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.trufDb = db;
