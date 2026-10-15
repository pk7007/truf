import { Prisma, PrismaClient } from "@prisma/client";
import { istDay } from "../src/lib/rules";

// Explicit operator fixture: isolated demo organization, no provider/payment records.
export async function seedDemoMonth(
  db: PrismaClient,
  accountBatch = "hosted-demo-20261015",
  now = new Date(),
) {
  const batch = `${accountBatch}-month-v1`;
  return db.$transaction(
    async (tx) => {
      const prior = await tx.auditLog.findUnique({ where: { id: batch } });
      if (prior) return prior.details;
      const player = await tx.user.findUniqueOrThrow({
        where: { id: `${accountBatch}-player` },
      });
      const owner = await tx.membership.findUniqueOrThrow({
        where: {
          userId_organizationId: {
            userId: `${accountBatch}-owner`,
            organizationId: `${accountBatch}-org`,
          },
        },
      });
      if (player.email !== "player@demo.truf.example" || owner.role !== "OWNER")
        throw Error("Demo identity mismatch");
      const today = +new Date(`${istDay(now)}T00:00:00+05:30`);
      const venueId = `${batch}-venue`;
      await tx.venue.create({
        data: {
          id: venueId,
          organizationId: owner.organizationId,
          name: "TRUF Demo Sports Centre · Fictional",
          locality: "Chennai",
          address: "Demonstration venue — not a real bookable facility",
          approved: true,
          published: true,
        },
      });
      const sports = ["Football", "Cricket", "Badminton"];
      for (const sport of sports)
        await tx.playingArea.create({
          data: {
            id: `${batch}-${sport}`,
            venueId,
            name: `${sport} · Demo`,
            sport,
          },
        });
      for (let i = 1; i <= 3; i++)
        await tx.user.create({
          data: {
            id: `${batch}-guest-${i}`,
            name: `Demo teammate ${i}`,
            email: `${batch}-guest-${i}@demo.truf.example`,
          },
        });
      // Fifteen one-hour sessions across the preceding thirty completed IST days.
      for (let i = 0; i < 18; i++) {
        const completed = i < 15;
        const sport = sports[i % 3];
        const dayOffset = completed ? -(29 - i * 2) : i - 14;
        const startsAt = new Date(today + dayOffset * 86400000 + 18 * 3600000);
        const endsAt = new Date(+startsAt + 3600000);
        const createdAt = new Date(+startsAt - 2 * 86400000);
        const confirmedAt = new Date(+startsAt - 86400000);
        const id = `${batch}-match-${i}`;
        await tx.slot.create({
          data: {
            id,
            areaId: `${batch}-${sport}`,
            startsAt,
            endsAt,
            pricePaise: 80000,
          },
        });
        await tx.match.create({
          data: {
            id,
            slotId: id,
            captainId: player.id,
            title: `${sport} community game · Demo`,
            capacity: 4,
            sharePaise: 20000,
            status: completed ? "COMPLETED" : "REQUESTED",
            createdAt: completed ? createdAt : now,
            confirmedAt: completed ? confirmedAt : null,
            completedAt: completed ? endsAt : null,
          },
        });
        if (!completed) continue;
        await tx.booking.create({
          data: {
            slotId: id,
            matchId: id,
            status: "COMPLETED",
            source: "OFFLINE",
            note: "Fictional offline demo game. No real money collected or provider transaction created.",
            createdAt: confirmedAt,
          },
        });
        for (let p = 0; p < 4; p++) {
          const userId = p === 0 ? player.id : `${batch}-guest-${p}`;
          const pid = `${id}-p${p}`;
          await tx.participation.create({
            data: {
              id: pid,
              matchId: id,
              userId,
              status: "PAID",
              createdAt,
              attendance: {
                create: {
                  status: "ATTENDED",
                  points: 100,
                  recordedBy: owner.userId,
                  updatedAt: endsAt,
                },
              },
            },
          });
          await tx.pointsEntry.create({
            data: {
              participationId: pid,
              userId,
              delta: 100,
              reason: "Fictional demo attendance · non-cash points",
              createdAt: endsAt,
            },
          });
        }
        await tx.statusEvent.createMany({
          data: [
            { matchId: id, status: "CONFIRMED", at: confirmedAt },
            { matchId: id, status: "COMPLETED", at: endsAt },
          ],
        });
      }
      const summary = {
        completed: 15,
        upcoming: 3,
        points: 1500,
        hours: 15,
      from: istDay(new Date(today - 29 * 86400000)),
        to: istDay(new Date(today - 86400000)),
        fictional: true,
      };
      await tx.auditLog.create({
        data: {
          id: batch,
          actorId: "authorized-deployment-operator",
          action: "SEED_DEMO_MONTH",
          targetId: owner.organizationId,
          details: summary,
        },
      });
      return summary;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120000,
    },
  );
}
