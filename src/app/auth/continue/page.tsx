import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/server/access";
import { db } from "@/server/db";
import { isPortal, portalDestination } from "@/lib/login-portals";
import { SignOut } from "@/components/account";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  const query = await searchParams;
  const portal = isPortal(query.portal) ? query.portal : undefined;
  const user = await currentUser().catch(() => null);
  if (!user) redirect(portal ? `/login/${portal}` : "/login");
  const owner = await db.membership.count({
    where: { userId: user.id, organization: { status: "APPROVED" } },
  });
  const destination = portalDestination(portal, user, owner > 0);
  if (destination) redirect(destination);
  return (
    <main className="auth">
      <Link className="brand" href="/">
        TRUF.
      </Link>
      <h1>Access not available</h1>
      <p>
        This account does not have{" "}
        {portal === "admin" ? "administrator" : "approved turf owner or staff"}{" "}
        access. Choosing a sign-in page does not change your account
        permissions.
      </p>
      <div className="row">
        <Link className="button" href="/app/discover">
          Continue as a player
        </Link>
        <SignOut />
      </div>
    </main>
  );
}
