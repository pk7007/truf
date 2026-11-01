import { redirect } from "next/navigation";
import { currentUser } from "@/server/access";
import { db } from "@/server/db";

export default async function Page() {
  const user = await currentUser();
  if (user.role === "ADMIN") redirect("/app/admin");
  const owner = await db.membership.count({
    where: { userId: user.id, organization: { status: "APPROVED" } },
  });
  redirect(owner ? "/app/owner" : "/app/discover");
}
