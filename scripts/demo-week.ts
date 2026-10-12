import { db } from "../src/server/db";
import { istDay } from "../src/lib/rules";

/** Fictional records in the local development database only; never call provider APIs. */
export async function seedDemoWeek() {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw Error("Demo activity is restricted to a local development database.");
  const today = new Date(istDay(new Date()) + "T00:00:00+05:30");
  for (let i = 1; i <= 11; i++) {
    const id = `demo-week-player-${i}`;
    await db.user.upsert({
      where: { id },
      create: {
        id,
        name: `Demo player ${i}`,
        email: `${id}@example.test`,
        locality: "Chennai",
        sports: ["Football", "Cricket", "Badminton"],
        createdAt: new Date(+today - (1 + (i % 7)) * 86400000),
      },
      update: {},
    });
  }
  for (let day = 7; day >= 1; day--) {
    for (let venue = 0; venue < 2; venue++) {
      for (let sportIndex = 0; sportIndex < 3; sportIndex++) {
        const sport = ["Football", "Cricket", "Badminton"][sportIndex];
        const startsAt = new Date(
          +today - day * 86400000 + (15 + sportIndex) * 3600000,
        );
        const endsAt = new Date(+startsAt + 3600000);
        const id = `demo-week-${istDay(startsAt)}-${venue}-${sportIndex}`;
        // Never rewrite a previously demonstrated booking or attendance correction.
        if (await db.match.findUnique({ where: { id } })) continue;
        const cancelled = (day + venue + sportIndex) % 7 === 0;
        const capacity = sport === "Badminton" ? 4 : 6;
        const sharePaise = sport === "Badminton" ? 15000 : 20000;
        const createdAt = new Date(+startsAt - 6 * 3600000);
        const confirmedAt = new Date(+startsAt - 2 * 3600000);
        await db.$transaction(async (tx) => {
          await tx.slot.create({
            data: {
              id,
              areaId: `seed-venue-${venue}-${sport}`,
              startsAt,
              endsAt,
              pricePaise: capacity * sharePaise,
            },
          });
          await tx.match.create({
            data: {
              id,
              slotId: id,
              captainId: "seed-player",
              title: `${sport} community session · Demo`,
              capacity,
              sharePaise,
              status: cancelled ? "CANCELLED" : "COMPLETED",
              createdAt,
              confirmedAt,
              completedAt: cancelled ? null : endsAt,
            },
          });
          await tx.booking.create({
            data: {
              slotId: id,
              matchId: id,
              status: cancelled ? "CANCELLED" : "COMPLETED",
              createdAt: confirmedAt,
            },
          });
          // One spare published hour makes utilization a meaningful ratio, not always 100%.
          await tx.slot.create({
            data: {
              id: id + "-available",
              areaId: `seed-venue-${venue}-${sport}`,
              startsAt: new Date(+startsAt + 4 * 3600000),
              endsAt: new Date(+endsAt + 4 * 3600000),
              pricePaise: capacity * sharePaise,
            },
          });
          for (let player = 0; player < capacity; player++) {
            const pid = `${id}-p${player}`;
            // Demo account attends one game per day; other fictional players fill the rosters.
            const userId =
              player === 0 && venue === 0 && sportIndex === day % 3
                ? "seed-player"
                : `demo-week-player-${1 + player + venue * 5}`;
            await tx.participation.create({
              data: {
                id: pid,
                userId,
                matchId: id,
                status: cancelled ? "CANCELLED" : "PAID",
                createdAt,
              },
            });
            await tx.paymentOrder.create({
              data: {
                id: pid,
                participationId: pid,
                amountPaise: sharePaise,
                status: "PAID",
                createdAt,
                reconciledAt: confirmedAt,
              },
            });
            await tx.payment.create({
              data: {
                id: pid,
                orderId: pid,
                providerPaymentId: `demo-only-${pid}`,
                amountPaise: sharePaise,
                feePaise: 0,
                capturedAt: confirmedAt,
              },
            });
            if (cancelled) {
              await tx.refund.create({
                data: {
                  paymentId: pid,
                  providerRefundId: `demo-refund-${pid}`,
                  amountPaise: sharePaise,
                  status: "PROCESSED",
                  reason: "Fictional owner cancellation for demonstration",
                  createdAt: startsAt,
                  completedAt: startsAt,
                },
              });
            } else if (!(player === capacity - 1 && day % 3 === 0)) {
              const attended = !(player === capacity - 1 && day % 4 === 0);
              await tx.attendance.create({
                data: {
                  participationId: pid,
                  status: attended ? "ATTENDED" : "NO_SHOW",
                  points: attended ? 100 : 0,
                  recordedBy: venue ? "seed-other" : "seed-owner",
                  updatedAt: endsAt,
                },
              });
              if (attended)
                await tx.pointsEntry.create({
                  data: {
                    participationId: pid,
                    userId,
                    delta: 100,
                    reason: "Fictional demo attendance",
                    createdAt: endsAt,
                  },
                });
            }
          }
          await tx.statusEvent.createMany({
            data: [
              { matchId: id, status: "CONFIRMED", at: confirmedAt },
              {
                matchId: id,
                status: cancelled ? "CANCELLED" : "COMPLETED",
                at: endsAt,
              },
            ],
          });
        });
      }
    }
  }
  // Upcoming matches use ordinary owner approval and checkout flows.
  for (let day = 1; day <= 3; day++) {
    const date = istDay(new Date(+today + day * 86400000));
    const slotId = `seed-venue-0-Badminton-future-${date}`;
    const slot = await db.slot.findUnique({
      where: { id: slotId },
      include: { matches: true, booking: true },
    });
    if (!slot || slot.matches.length || slot.booking) continue;
    await db.match.create({
      data: {
        id: `demo-upcoming-${date}`,
        slotId,
        captainId: "seed-player",
        title: "After-work badminton · Demo",
        capacity: 4,
        sharePaise: slot.pricePaise / 4,
        status: "REQUESTED",
      },
    });
  }
  console.log(
    "Seven completed IST days of fictional sales-demo activity are ready; no provider payments were made.",
  );
}
