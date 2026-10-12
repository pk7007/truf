import { User } from "@prisma/client";
import { db } from "./db";
import { AppError, requireOrganization } from "./access";
import { serial, audit } from "./booking";
import { streak } from "@/lib/rules";
export async function recordAttendance(
  user: User,
  id: string,
  status: "ATTENDED" | "NO_SHOW" | "UNMARKED",
) {
  const p = await db.participation.findUniqueOrThrow({
    where: { id },
    include: {
      match: {
        include: { slot: { include: { area: { include: { venue: true } } } } },
      },
    },
  });
  await requireOrganization(user, p.match.slot.area.venue.organizationId);
  if (
    p.match.slot.endsAt > new Date() ||
    p.match.status !== "COMPLETED" ||
    p.status !== "PAID"
  )
    throw new AppError(409, "Attendance is recorded after a completed game.");
  return serial(async (tx) => {
    const before = await tx.attendance.findUnique({
        where: { participationId: p.id },
      }),
      points = status === "ATTENDED" ? 100 : 0,
      delta = points - (before?.points || 0);
    if (status === "UNMARKED")
      await tx.attendance.deleteMany({ where: { participationId: p.id } });
    else
      await tx.attendance.upsert({
        where: { participationId: p.id },
        create: { participationId: p.id, status, points, recordedBy: user.id },
        update: { status, points, recordedBy: user.id },
      });
    if (delta)
      await tx.pointsEntry.create({
        data: {
          participationId: p.id,
          userId: p.userId,
          delta,
          reason: before ? "Attendance correction" : "Verified attendance",
        },
      });
    await audit(tx, user.id, "ATTENDANCE", p.id, {
      before: before?.status || "UNMARKED",
      after: status,
      pointsDelta: delta,
    });
    const games = await tx.attendance.findMany({
        where: { status: "ATTENDED", participation: { userId: p.userId } },
        include: {
          participation: { include: { match: { include: { slot: true } } } },
        },
      }),
      best = streak(games.map((g) => g.participation.match.slot.startsAt)).best;
    for (const [badge, eligible] of [
      ["first-game", games.length >= 1],
      ["three-week", best >= 3],
      ["five-game", games.length >= 5],
    ] as const) {
      if (eligible)
        await tx.rewardClaim.upsert({
          where: { userId_badge: { userId: p.userId, badge } },
          create: { userId: p.userId, badge },
          update: {},
        });
      else
        await tx.rewardClaim.deleteMany({ where: { userId: p.userId, badge } });
    }
  });
}
