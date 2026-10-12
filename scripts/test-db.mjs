import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL || "");
if (!["localhost", "127.0.0.1", "postgres"].includes(url.hostname))
  throw Error("Integration tests require a local/CI PostgreSQL database.");
const schema = "truf_test_" + randomBytes(8).toString("hex");
url.searchParams.set("schema", schema);
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  INTEGRATION_TEST: "1",
};
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  let result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: "inherit" },
  );
  if (result.status !== 0) throw Error("Test migration failed");
  result = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run"],
    { env, stdio: "inherit" },
  );
  process.exitCode = result.status || 0;
} finally {
  if (!/^truf_test_[a-f0-9]{16}$/.test(schema))
    throw Error("Unsafe test schema");
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
  await db.$disconnect();
}
