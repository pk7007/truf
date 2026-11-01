import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Reports } from "@/components/reports";
import { Records } from "@/components/records";
import type { RecordsData } from "@/components/records";
import { currentUser } from "@/server/access";
import { db } from "@/server/db";
import { isDemoAdministrator } from "@/lib/demo-access";

const reportSections = ["progress", "owner", "admin"];
const recordSections = [
  "discover",
  "matches",
  "payments",
  "wallet",
  "notifications",
  "venues",
  "owner-bookings",
  "moderation",
  "settings",
  "access-denied",
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  if (![...reportSections, ...recordSections].includes(section)) notFound();

  const user = await currentUser();
  const scope = first(query.scope);
  const approvedOwner =
    user.role !== "ADMIN" &&
    (await db.membership.count({
      where: { userId: user.id, organization: { status: "APPROVED" } },
    })) > 0;
  const playerOnly = ["discover", "matches", "progress"].includes(section);
  if (playerOnly && user.role === "ADMIN") redirect("/app/admin");
  if (playerOnly && approvedOwner) redirect("/app/owner");
  if (section === "payments" && !scope && user.role === "ADMIN")
    redirect("/app/payments?scope=admin");
  if (section === "payments" && !scope && approvedOwner)
    redirect("/app/payments?scope=owner");
  if (section === "wallet" && !scope && user.role === "ADMIN")
    redirect("/app/wallet?scope=admin");
  const adminArea =
    section === "admin" || section === "moderation" || scope === "admin";
  const ownerArea =
    ["owner", "owner-bookings", "venues"].includes(section) ||
    scope === "owner";

  if (adminArea) {
    if (user.role !== "ADMIN")
      redirect("/app/access-denied?area=administrator");
    if (!user.twoFactorEnabled && !isDemoAdministrator(user)) {
      redirect("/app/settings?notice=mfa-required");
    }
  }

  if (ownerArea) {
    if (user.role === "ADMIN") redirect("/app/admin");
    if (!approvedOwner) redirect("/app/access-denied?area=owner");
  }

  if (section === "access-denied") {
    const area =
      first(query.area) === "administrator"
        ? "administrator"
        : "approved turf owner or staff";
    return (
      <section className="page-stack" aria-labelledby="access-title">
        <div className="card empty-state">
          <p className="tag">Access restricted</p>
          <h1 id="access-title">This account does not have {area} access.</h1>
          <p>
            Signing in through a different portal does not change your account
            permissions. Ask the pilot administrator to approve the correct role
            if you need this workspace.
          </p>
          <div className="row">
            <Link className="button primary" href="/app/discover">
              Continue as a player
            </Link>
            <Link className="button" href="/app/settings">
              Account settings
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (reportSections.includes(section)) {
    return (
      <Reports
        view={
          section === "progress" ? "player" : (section as "owner" | "admin")
        }
      />
    );
  }

  let initialData: RecordsData | undefined;
  if (section === "matches" && Object.keys(query).length === 0) {
    const matches = await db.match.findMany({
      where: {
        OR: [
          { captainId: user.id },
          { participations: { some: { userId: user.id } } },
        ],
      },
      include: {
        slot: { include: { area: { include: { venue: true } } } },
        _count: { select: { participations: { where: { status: "PAID" } } } },
      },
      orderBy: { slot: { startsAt: "asc" } },
      take: 100,
    });
    initialData = JSON.parse(JSON.stringify({ matches, slots: [] }));
  }
  return <Records view={section} initialData={initialData} />;
}
