import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { provisionDemo } from "./provision-demo";

async function main() {
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.BETTER_AUTH_URL !== "https://truf-red.vercel.app"
  )
    throw Error(
      "Hosted demo provisioning is restricted to the authorized TRUF production project.",
    );
  if (
    !process.env.DATABASE_URL ||
    ["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL).hostname,
    )
  )
    throw Error("A hosted database is required.");
  const { batchId, publicKey } = JSON.parse(
    await readFile("scripts/hosted-demo-public.json", "utf8"),
  );
  const db = new PrismaClient();
  try {
    const envelope = await provisionDemo(db, batchId, publicKey);
    await mkdir("public", { recursive: true });
    await writeFile("public/truf-demo-delivery.json", JSON.stringify(envelope));
    console.log(
      "Three authorized demonstration accounts are provisioned. Admin MFA remains required. Password delivery is encrypted.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Hosted demo provisioning failed; no credentials were logged.");
  process.exitCode = 1;
});
