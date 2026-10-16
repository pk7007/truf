import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/server/db";
import { postWalletEntry } from "../src/server/wallet";
import { seedDemoWeek } from "./demo-week";
async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw Error("Seed is only permitted on a local development database.");
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw Error("Set a local SEED_PASSWORD of at least 12 characters.");
  const hash = await hashPassword(password);
  for (const [id, name, role] of [
    ["player", "Praveen", "PLAYER"],
    ["owner", "TRUF Venue Owner", "PLAYER"],
    ["other", "Second Turf Owner", "PLAYER"],
    ["admin", "TRUF Administrator", "ADMIN"],
  ]) {
    await db.user.upsert({
      where: { id: "seed-" + id },
      create: {
        id: "seed-" + id,
        name,
        email: id + "@truf.local",
        emailVerified: true,
        role,
        accountType: id === "owner" || id === "other" ? "OWNER" : "PLAYER",
        locality: "Chennai",
        sports: ["Football", "Badminton"],
      },
      update: {
        accountType: id === "owner" || id === "other" ? "OWNER" : "PLAYER",
      },
    });
    await db.account.upsert({
      where: { id: "seed-account-" + id },
      create: {
        id: "seed-account-" + id,
        accountId: "seed-" + id,
        userId: "seed-" + id,
        providerId: "credential",
        password: hash,
      },
      update: { password: hash },
    });
  }
  await db.$transaction(async (tx) => {
    await postWalletEntry(tx, {
      userId: "seed-player",
      type: "TOP_UP",
      amountPaise: 500000,
      direction: "CREDIT",
      referenceType: "DEMO",
      referenceId: "local-player-opening-balance",
      description: "Fictional local-demo wallet balance",
      idempotencyKey: "seed:wallet:player",
    });
    await postWalletEntry(tx, {
      userId: "seed-owner",
      type: "SETTLEMENT",
      amountPaise: 800000,
      direction: "CREDIT",
      referenceType: "DEMO",
      referenceId: "local-owner-settlement",
      description: "Completed venue bookings · fictional settlement",
      idempotencyKey: "seed:wallet:owner",
    });
    await postWalletEntry(tx, {
      userId: "seed-other",
      type: "SETTLEMENT",
      amountPaise: 600000,
      direction: "CREDIT",
      referenceType: "DEMO",
      referenceId: "local-second-owner-settlement",
      description: "Completed venue bookings · fictional settlement",
      idempotencyKey: "seed:wallet:other",
    });
  });
  for (let n = 0; n < 2; n++) {
    const org = "seed-org-" + n,
      venue = "seed-venue-" + n;
    await db.organization.upsert({
      where: { id: org },
      create: {
        id: org,
        name: n ? "Eastside Sports" : "TRUF Arena",
        status: "APPROVED",
      },
      update: {},
    });
    await db.membership.upsert({
      where: {
        userId_organizationId: {
          userId: n ? "seed-other" : "seed-owner",
          organizationId: org,
        },
      },
      create: { userId: n ? "seed-other" : "seed-owner", organizationId: org },
      update: {},
    });
    await db.venue.upsert({
      where: { id: venue },
      create: {
        id: venue,
        organizationId: org,
        name: n ? "Eastside Sports Park" : "TRUF Arena · Velachery",
        locality: n ? "Adyar" : "Velachery",
        address: "Development fixture — not a real listed venue",
        approved: true,
        published: true,
      },
      update: {},
    });
    for (const sport of ["Football", "Cricket", "Badminton"]) {
      const area = venue + "-" + sport;
      await db.playingArea.upsert({
        where: { id: area },
        create: { id: area, venueId: venue, name: sport + " court", sport },
        update: {},
      });
      for (let day = 1; day <= 7; day++) {
        const starts = new Date();
        starts.setUTCDate(starts.getUTCDate() + day);
        starts.setUTCHours(12, 30, 0, 0);
        await db.slot.upsert({
          where: { id: area + "-future-" + starts.toISOString().slice(0, 10) },
          create: {
            id: area + "-future-" + starts.toISOString().slice(0, 10),
            areaId: area,
            startsAt: starts,
            endsAt: new Date(+starts + 3600000),
            pricePaise: sport === "Badminton" ? 40000 : 120000,
          },
          update: {},
        });
      }
    }
  }
  for (let i = 1; i <= 8; i++) {
    const sport = i % 3 === 0 ? "Badminton" : "Football",
      slotId = "seed-past-slot-" + i,
      matchId = "seed-match-" + i,
      pId = "seed-part-" + i,
      starts = new Date(Date.now() - i * 4 * 86400000);
    starts.setUTCHours(12, 30, 0, 0);
    await db.slot.upsert({
      where: { id: slotId },
      create: {
        id: slotId,
        areaId: "seed-venue-0-" + sport,
        startsAt: starts,
        endsAt: new Date(+starts + 3600000),
        pricePaise: 120000,
      },
      update: {},
    });
    await db.match.upsert({
      where: { id: matchId },
      create: {
        id: matchId,
        captainId: "seed-player",
        slotId,
        title:
          (sport === "Football" ? "Evening kickabout" : "Doubles session") +
          " · development sample",
        capacity: 4,
        sharePaise: 30000,
        status: "COMPLETED",
        createdAt: new Date(+starts - 86400000),
        confirmedAt: new Date(+starts - 7200000),
        completedAt: new Date(+starts + 3600000),
      },
      update: {},
    });
    await db.booking.upsert({
      where: { slotId },
      create: { slotId, matchId, status: "COMPLETED" },
      update: {},
    });
    await db.participation.upsert({
      where: { id: pId },
      create: { id: pId, matchId, userId: "seed-player", status: "PAID" },
      update: {},
    });
    await db.attendance.upsert({
      where: { participationId: pId },
      create: {
        participationId: pId,
        status: "ATTENDED",
        points: 100,
        recordedBy: "seed-owner",
      },
      update: {},
    });
    await db.paymentOrder.upsert({
      where: { id: "seed-order-" + i },
      create: {
        id: "seed-order-" + i,
        participationId: pId,
        amountPaise: 30000,
        status: "PAID",
      },
      update: {},
    });
    await db.payment.upsert({
      where: { providerPaymentId: "seed-payment-" + i },
      create: {
        orderId: "seed-order-" + i,
        providerPaymentId: "seed-payment-" + i,
        amountPaise: 30000,
        feePaise: 0,
        capturedAt: new Date(+starts - 7200000),
      },
      update: {},
    });
  }
  await seedDemoWeek();
  console.log(
    "Local development fixtures ready. Accounts: player@truf.local, owner@truf.local, other@truf.local, admin@truf.local. Password: SEED_PASSWORD in ignored .env. Admin must enroll MFA.",
  );
}
main().finally(() => db.$disconnect());
