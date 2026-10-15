import { PrismaClient } from "@prisma/client";
import { seedDemoMonth } from "./demo-month";
async function main() {
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.BETTER_AUTH_URL !== "https://truf-red.vercel.app"
  )
    throw Error("Wrong deployment target");
  const db = new PrismaClient();
  try {
    console.log("Demo month:", await seedDemoMonth(db));
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Demo month provisioning failed");
  process.exitCode = 1;
});
