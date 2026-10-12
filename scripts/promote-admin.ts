import "dotenv/config";
import { db } from "../src/server/db";
const email = process.argv[2];
if (!email) throw Error("Usage: npm run admin:promote -- verified-email");
async function main() {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  if (!user.emailVerified)
    throw Error("Verify email before granting administrator access.");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    db.auditLog.create({
      data: {
        actorId: "operator",
        action: "PROMOTE_ADMIN",
        targetId: user.id,
        details: {},
      },
    }),
  ]);
  console.log(
    "Administrator role assigned. MFA enrollment is required before admin access.",
  );
}
main().finally(() => db.$disconnect());
