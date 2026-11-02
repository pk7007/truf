import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { istDay } from "../src/lib/rules";
import { walletDirection } from "../src/lib/wallet";

// Explicit operator command; never imported by the web application or build.
export async function seedPresentationMonth(
  db: PrismaClient,
  reference = "2026-11-02",
  apply = false,
) {
  const batch = "hosted-demo-20261015-month-v2";
  const today = +new Date(reference + "T00:00:00+05:30");
  if (
    !Number.isFinite(today) ||
    istDay(new Date(today)) !== reference ||
    reference > istDay(new Date())
  )
    throw Error("Invalid or future reference date");
  const plan = {
    batch,
    from: istDay(new Date(today - 29 * 86400000)),
    to: reference,
    historical: 60,
    upcoming: 9,
    organizations: 3,
    newVenues: 6,
    fictional: true,
  };
  const prior = await db.auditLog.findUnique({ where: { id: batch } });
  if (prior) return { applied: false, existing: prior.details };
  if (!apply) return { applied: false, plan };
  return db.$transaction(
    async (tx) => {
      const player = await tx.user.findUniqueOrThrow({
        where: { id: "hosted-demo-20261015-player" },
      });
      const member = await tx.membership.findUniqueOrThrow({
        where: {
          userId_organizationId: {
            userId: "hosted-demo-20261015-owner",
            organizationId: "hosted-demo-20261015-org",
          },
        },
      });
      if (
        ![
          "player@demo.truf.example",
          ...(process.env.INTEGRATION_TEST === "1"
            ? ["player@presentation.truf.example"]
            : []),
        ].includes(player.email) ||
        member.role !== "OWNER"
      )
        throw Error("Demo identity mismatch");
      const players = [player.id];
      const staleRequests = await tx.match.findMany({
        where: {
          OR: [
            { id: { startsWith: "hosted-demo-20261015-month-v1-" } },
            { id: { startsWith: "demo-discovery-nov-" } },
          ],
          status: "REQUESTED",
          slot: {
            endsAt: { lt: new Date() },
            area: { venue: { organizationId: member.organizationId } },
          },
          participations: { none: {} },
          booking: null,
        },
        select: { id: true },
      });
      for (const match of staleRequests) {
        await tx.match.update({
          where: { id: match.id },
          data: { status: "EXPIRED" },
        });
        await tx.statusEvent.create({
          data: { matchId: match.id, status: "EXPIRED" },
        });
      }
      for (let n = 1; n < 24; n++) {
        const id = `${batch}-player-${n}`;
        await tx.user.create({
          data: {
            id,
            name: `Fictional player ${n}`,
            email: `${id}@demo.truf.example`,
            createdAt: new Date(today - (30 - n) * 86400000),
            sports: ["Football", "Cricket", "Badminton"],
          },
        });
        players.push(id);
      }
      const organizations = [member.organizationId],
        owners = [member.userId];
      for (let n = 1; n < 3; n++) {
        const id = `${batch}-owner-${n}`,
          org = `${batch}-org-${n}`;
        await tx.user.create({
          data: {
            id,
            name: `Fictional venue owner ${n}`,
            email: `${id}@demo.truf.example`,
            accountType: "OWNER",
          },
        });
        await tx.organization.create({
          data: {
            id: org,
            name: `Demo sports organization ${n} · fictional`,
            status: "APPROVED",
            memberships: { create: { userId: id, role: "OWNER" } },
          },
        });
        organizations.push(org);
        owners.push(id);
      }
      const sports = ["Football", "Cricket", "Badminton"];
      for (let venue = 0; venue < 6; venue++) {
        const id = `${batch}-venue-${venue}`;
        await tx.venue.create({
          data: {
            id,
            organizationId: organizations[Math.floor(venue / 2)],
            name: `Demo ${["Arena", "Park", "Court", "Ground", "Club", "Centre"][venue]} · fictional`,
            locality: "Chennai",
            address: "Presentation fixture — not a real facility",
            approved: true,
            published: true,
          },
        });
        for (const sport of sports)
          await tx.playingArea.create({
            data: { id: `${id}-${sport}`, venueId: id, name: sport, sport },
          });
      }
      async function entry(
        userId: string,
        type: string,
        amountPaise: number,
        referenceType: string,
        referenceId: string,
        key: string,
        at: Date,
      ) {
        const wallet = await tx.wallet.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        const balanceAfterPaise =
          wallet.balancePaise +
          (type === "BOOKING" ? -amountPaise : amountPaise);
        if (balanceAfterPaise < 0) throw Error("Fixture would overdraw wallet");
        await tx.walletEntry.create({
          data: {
            walletId: wallet.id,
            type,
            amountPaise,
            balanceAfterPaise,
            referenceType,
            referenceId,
            idempotencyKey: key,
            description: "Demo · fictional " + type.toLowerCase(),
            createdAt: at,
          },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balancePaise: balanceAfterPaise },
        });
      }
      for (const id of players)
        await entry(
          id,
          "ADJUSTMENT",
          2000000,
          "DEMO",
          batch,
          `${batch}:fund:${id}`,
          new Date(today - 30 * 86400000),
        );
      let debits = 0,
        refunds = 0,
        settlements = 0,
        attended = 0;
      for (let n = 0; n < 69; n++) {
        const future = n >= 60,
          day = future ? 1 + Math.floor((n - 60) / 2) : -29 + Math.floor(n / 2);
        // Historical sessions finish before today's presentation time; future sessions start at 16/18 IST.
        const hour = future ? 16 + (n % 2) * 2 : 6 + (n % 2) * 2;
        const start = new Date(today + day * 86400000 + hour * 3600000),
          end = new Date(+start + 3600000);
        if (!future && end > new Date())
          throw Error(
            "Reference day's historical sessions have not finished; use yesterday",
          );
        const status = future
          ? ["REQUESTED", "RECRUITING", "CONFIRMED"][(n - 60) % 3]
          : n % 10 === 0
            ? "CANCELLED"
            : n % 10 === 1
              ? "EXPIRED"
              : "COMPLETED";
        const venue = n % 6,
          sport = sports[n % 3],
          id = `${batch}-match-${n}`,
          capacity = sport === "Badminton" ? 4 : 6,
          share = 15000 + (n % 3) * 5000;
        const createdAt = new Date(future ? today : +start - 4 * 3600000),
          paidAt = new Date(future ? today + 3600000 : +start - 3 * 3600000),
          deadline = new Date(+start - 3600000);
        await tx.slot.create({
          data: {
            id,
            areaId: `${batch}-venue-${venue}-${sport}`,
            startsAt: start,
            endsAt: end,
            pricePaise: capacity * share,
          },
        });
        await tx.match.create({
          data: {
            id,
            slotId: id,
            captainId: players[(n * 6) % 24],
            title: `${sport} community game · Demo · fictional`,
            capacity,
            sharePaise: share,
            status,
            createdAt,
            deadline: status === "REQUESTED" ? null : deadline,
            confirmedAt: ["COMPLETED", "CONFIRMED", "CANCELLED"].includes(
              status,
            )
              ? paidAt
              : null,
            completedAt: status === "COMPLETED" ? end : null,
          },
        });
        if (["COMPLETED", "CONFIRMED", "RECRUITING"].includes(status))
          await tx.booking.create({
            data: {
              slotId: id,
              matchId: id,
              status: status === "RECRUITING" ? "HELD" : status,
              note: "Demo · fictional. No provider transaction.",
              createdAt,
            },
          });
        const count =
          status === "REQUESTED"
            ? 0
            : ["RECRUITING", "EXPIRED"].includes(status)
              ? 2
              : capacity;
        for (let p = 0; p < count; p++) {
          const userId = players[(n * 6 + p) % 24],
            pid = `${id}-p${p}`,
            refunded = ["CANCELLED", "EXPIRED"].includes(status);
          await tx.participation.create({
            data: {
              id: pid,
              matchId: id,
              userId,
              status: refunded ? "WITHDRAWN" : "PAID",
              createdAt: paidAt,
            },
          });
          await entry(
            userId,
            "BOOKING",
            share,
            "PARTICIPATION",
            pid,
            `booking:${pid}`,
            paidAt,
          );
          debits += share;
          if (refunded) {
            await entry(
              userId,
              "REFUND",
              share,
              "PARTICIPATION",
              pid,
              `refund:${pid}`,
              deadline,
            );
            refunds += share;
          }
          if (status === "COMPLETED" && p !== capacity - 1) {
            const present = !(p === capacity - 2 && n % 4 === 0);
            await tx.attendance.create({
              data: {
                participationId: pid,
                status: present ? "ATTENDED" : "NO_SHOW",
                points: present ? 100 : 0,
                recordedBy: owners[Math.floor(venue / 2)],
                updatedAt: end,
              },
            });
            if (present) {
              await tx.pointsEntry.create({
                data: {
                  participationId: pid,
                  userId,
                  delta: 100,
                  reason: "Demo · fictional attendance",
                  createdAt: end,
                },
              });
              attended++;
            }
          }
        }
        if (status === "COMPLETED") {
          const owner = owners[Math.floor(venue / 2)];
          await entry(
            owner,
            "SETTLEMENT",
            count * share,
            "MATCH",
            id,
            `settlement:${id}:${owner}`,
            end,
          );
          settlements += count * share;
        }
        await tx.statusEvent.create({
          data: { matchId: id, status, at: future ? createdAt : end },
        });
      }
      // Unreserved future slots support the create-request journey.
      for (let n = 0; n < 6; n++)
        await tx.slot.create({
          data: {
            id: `${batch}-available-${n}`,
            areaId: `${batch}-venue-${n}-Football`,
            startsAt: new Date(today + 6 * 86400000 + 16 * 3600000),
            endsAt: new Date(today + 6 * 86400000 + 17 * 3600000),
            pricePaise: 120000,
          },
        });
      // Recompute chronological running balances for demo wallets when adding
      // historical entries alongside their existing presentation transactions.
      for (const userId of [...players, ...owners]) {
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { userId },
          include: {
            entries: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        });
        let balance = 0;
        for (const item of wallet.entries) {
          balance +=
            walletDirection(item.type) === "DEBIT"
              ? -item.amountPaise
              : item.amountPaise;
          if (balance < 0)
            throw Error(
              "Existing demo ledger cannot reconcile chronologically",
            );
          if (item.balanceAfterPaise !== balance)
            await tx.walletEntry.update({
              where: { id: item.id },
              data: { balanceAfterPaise: balance },
            });
        }
        if (balance !== wallet.balancePaise)
          throw Error(
            "Existing demo balance does not reconcile with its ledger",
          );
      }
      const summary = {
        ...plan,
        expiredUnpaidLegacyRequests: staleRequests.length,
        bookingDebitsPaise: debits,
        refundsPaise: refunds,
        netPaise: debits - refunds,
        settlementsPaise: settlements,
        attended,
        openingCreditsPaise: players.length * 2000000,
      };
      await tx.auditLog.create({
        data: {
          id: batch,
          actorId: "authorized-demo-operator",
          action: "SEED_DEMO_MONTH_V2",
          targetId: member.organizationId,
          details: summary,
        },
      });
      return { applied: true, summary };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120000,
    },
  );
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/demo-month-v2.ts")) {
  const db = new PrismaClient();
  seedPresentationMonth(
    db,
    process.env.DEMO_REFERENCE_DATE || "2026-11-02",
    process.argv.includes("--apply"),
  )
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      console.error(
        "Demo provisioning failed; transaction rolled back. Check demo identities and reference date.",
      );
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
