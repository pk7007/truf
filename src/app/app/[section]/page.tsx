import { notFound } from "next/navigation";
import { Reports } from "@/components/reports";
import { Records } from "@/components/records";
import type { RecordsData } from "@/components/records";
import { currentUser } from "@/server/access";
import { db } from "@/server/db";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  if (["progress", "owner", "admin"].includes(section))
    return (
      <Reports
        view={
          section === "progress" ? "player" : (section as "owner" | "admin")
        }
      />
    );
  if (
    ![
      "discover",
      "matches",
      "payments",
      "notifications",
      "venues",
      "owner-bookings",
      "moderation",
      "settings",
    ].includes(section)
  )
    notFound();
  let initialData: RecordsData | undefined;
  if (section === "matches" && Object.keys(query).length === 0) {
    const user = await currentUser();
    const matches = await db.match.findMany({
      where: {
        OR: [
          { captainId: user.id },
          { participations: { some: { userId: user.id } } },
        ],
      },
      include: {
        slot: { include: { area: { include: { venue: true } } } },
        _count: {
          select: { participations: { where: { status: "PAID" } } },
        },
      },
      orderBy: { slot: { startsAt: "asc" } },
      take: 100,
    });
    initialData = JSON.parse(JSON.stringify({ matches, slots: [] }));
  }
  return <Records view={section} initialData={initialData} />;
}
