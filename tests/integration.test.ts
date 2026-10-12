import { recordProviderRefund } from "../src/server/refunds";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("../src/server/payments", async (original) => ({
  ...(await original<typeof import("../src/server/payments")>()),
  razorpay: vi.fn(async () => ({ id: "order_" + randomUUID() })),
}));
import { db } from "../src/server/db";
import {
  requestMatch,
  approveHold,
  checkout,
  capture,
  withdraw,
  serial,
  closeMatch,
} from "../src/server/booking";
import { analytics } from "../src/server/analytics";
import { requireOrganization } from "../src/server/access";
import { processJob } from "../src/server/worker";
import { recordAttendance } from "../src/server/attendance";
import { istDay } from "../src/lib/rules";
const suite = process.env.INTEGRATION_TEST === "1" ? describe : describe.skip;
suite("database booking and tenant isolation", () => {
  const prefix = "test-" + randomUUID();
  let owner: Awaited<ReturnType<typeof db.user.create>>,
    other: typeof owner,
    player: typeof owner,
    sub: typeof owner,
    org: string,
    area: string;
  beforeAll(async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
    process.env.RAZORPAY_KEY_SECRET = "fixture-secret";
    for (const name of ["owner", "other", "player", "sub"])
      await db.user.create({
        data: {
          id: prefix + name,
          name,
          email: prefix + name + "@example.test",
          emailVerified: true,
        },
      });
    [owner, other, player, sub] = await Promise.all(
      ["owner", "other", "player", "sub"].map((name) =>
        db.user.findUniqueOrThrow({ where: { id: prefix + name } }),
      ),
    );
    const o = await db.organization.create({
      data: {
        name: "Integration fixture",
        status: "APPROVED",
        memberships: { create: { userId: owner.id } },
        venues: {
          create: {
            name: "Test venue",
            locality: "Test",
            address: "Test only",
            approved: true,
            published: true,
            areas: { create: { name: "Court", sport: "Badminton" } },
          },
        },
      },
      include: { venues: { include: { areas: true } } },
    });
    org = o.id;
    area = o.venues[0].areas[0].id;
  });
  afterAll(() => db.$disconnect());
  let offset = 0;
  async function match() {
    const start = new Date(Date.now() + (++offset + 2) * 86400000);
    const slot = await db.slot.create({
      data: {
        areaId: area,
        startsAt: start,
        endsAt: new Date(+start + 3600000),
        pricePaise: 40000,
      },
    });
    return requestMatch(player, {
      slotId: slot.id,
      title: "Fixture game",
      capacity: 2,
      visibility: "PUBLIC",
    });
  }
  async function pay(user: typeof player, id: string) {
    const order = await checkout(user, id);
    await capture({
      id: "pay_" + randomUUID(),
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      status: "captured",
      created_at: Math.floor(Date.now() / 1000),
    });
    return order;
  }
  it("denies cross-organization access", async () => {
    await expect(requireOrganization(other, org)).rejects.toThrow(
      "Approved owner",
    );
  });
  it("reserves a slot only once under concurrent approvals", async () => {
    const m = await match(),
      m2 = await requestMatch(sub, {
        slotId: m.slotId,
        title: "Competing game",
        capacity: 2,
        visibility: "PUBLIC",
      });
    const results = await Promise.allSettled([
      approveHold(owner, m.id, new Date(Date.now() + 3600000)),
      approveHold(owner, m2.id, new Date(Date.now() + 3600000)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.booking.count({ where: { slotId: m.slotId } })).toBe(1);
  });
  it("allows only one checkout for the final roster place", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    await pay(player, m.id);
    const results = await Promise.allSettled([
      checkout(other, m.id),
      checkout(sub, m.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("confirms captured shares and refunds a paid replacement only once", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    await pay(player, m.id);
    await pay(other, m.id);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: m.id } })).status,
    ).toBe("CONFIRMED");
    await withdraw(player, m.id);
    expect(
      await db.refund.count({
        where: { payment: { order: { participation: { matchId: m.id } } } },
      }),
    ).toBe(0);
    const order = await checkout(sub, m.id),
      payment = {
        id: "pay_" + randomUUID(),
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        status: "captured",
        created_at: Math.floor(Date.now() / 1000),
      };
    await capture(payment);
    await capture(payment);
    expect(
      await db.payment.count({ where: { providerPaymentId: payment.id } }),
    ).toBe(1);
    expect(
      await db.refund.count({
        where: { payment: { order: { participation: { matchId: m.id } } } },
      }),
    ).toBe(1);
  });
  it("refunds late captures without reopening an expired match", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    const order = await checkout(player, m.id);
    await serial((tx) => closeMatch(tx, m.id, "EXPIRED", "test"));
    await capture({
      id: "pay_" + randomUUID(),
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      status: "captured",
      created_at: Math.floor(Date.now() / 1000),
    });
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: m.id } })).status,
    ).toBe("EXPIRED");
    expect(await db.booking.count({ where: { matchId: m.id } })).toBe(0);
    expect(
      await db.refund.count({
        where: { payment: { order: { participation: { matchId: m.id } } } },
      }),
    ).toBe(1);
  });
  it("enforces overlapping-slot exclusion in PostgreSQL", async () => {
    const m = await match(),
      s = await db.slot.findUniqueOrThrow({ where: { id: m.slotId } });
    await expect(
      db.slot.create({
        data: {
          areaId: area,
          startsAt: new Date(+s.startsAt + 1800000),
          endsAt: new Date(+s.endsAt + 1800000),
          pricePaise: 40000,
        },
      }),
    ).rejects.toThrow();
  });
  it("scope-checks analytics venue filters", async () => {
    await expect(
      analytics(other, new URLSearchParams("view=owner")),
    ).rejects.toThrow();
    const result = await analytics(owner, new URLSearchParams("view=owner"));
    expect(result.venues.length).toBe(1);
    expect(result.charts.map((c) => c.id)).toEqual([
      "bookings",
      "cash",
      "utilization",
      "demand",
      "attendance",
    ]);
  });
  it("expires durable jobs idempotently", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    await db.match.update({
      where: { id: m.id },
      data: { deadline: new Date(Date.now() - 1000) },
    });
    const job = await db.job.findUniqueOrThrow({
      where: { key: "expire:" + m.id },
    });
    await processJob(job);
    await processJob(job);
    expect(
      await db.statusEvent.count({
        where: { matchId: m.id, status: "EXPIRED" },
      }),
    ).toBe(1);
  });
  it("corrects attendance and points without duplicate awards", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    await pay(player, m.id);
    await pay(other, m.id);
    const startsAt = new Date(Date.now() - 2 * 86400000);
    await db.slot.update({
      where: { id: m.slotId },
      data: { startsAt, endsAt: new Date(+startsAt + 3600000) },
    });
    await processJob(
      await db.job.findUniqueOrThrow({ where: { key: "complete:" + m.id } }),
    );
    const p = await db.participation.findUniqueOrThrow({
      where: { matchId_userId: { matchId: m.id, userId: player.id } },
    });
    await recordAttendance(owner, p.id, "ATTENDED");
    await recordAttendance(owner, p.id, "ATTENDED");
    expect(
      (
        await db.pointsEntry.aggregate({
          where: { participationId: p.id },
          _sum: { delta: true },
        })
      )._sum.delta,
    ).toBe(100);
    expect(
      await db.rewardClaim.count({
        where: { userId: player.id, badge: "first-game" },
      }),
    ).toBe(1);
    await recordAttendance(owner, p.id, "NO_SHOW");
    expect(
      (
        await db.pointsEntry.aggregate({
          where: { participationId: p.id },
          _sum: { delta: true },
        })
      )._sum.delta,
    ).toBe(0);
    expect(
      await db.rewardClaim.count({
        where: { userId: player.id, badge: "first-game" },
      }),
    ).toBe(0);
    await recordAttendance(owner, p.id, "UNMARKED");
    expect(
      await db.attendance.count({ where: { participationId: p.id } }),
    ).toBe(0);
  });
  it("reconciles cash charts with partial completed refunds at IST boundaries", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    const order = await pay(player, m.id);
    const payment = await db.payment.findFirstOrThrow({
      where: { order: { providerOrderId: order.orderId } },
    });
    const day = "2026-08-01",
      captureAt = new Date("2026-07-31T18:30:00Z");
    await db.payment.update({
      where: { id: payment.id },
      data: { capturedAt: captureAt },
    });
    await db.refund.create({
      data: {
        paymentId: payment.id,
        amountPaise: 5000,
        status: "PROCESSED",
        reason: "Reporting fixture",
        completedAt: new Date("2026-08-01T18:29:59Z"),
      },
    });
    expect(istDay(captureAt)).toBe(day);
    const report = await analytics(
      owner,
      new URLSearchParams("view=owner&from=" + day + "&to=" + day),
    );
    expect(report.summary.capturedPaise).toBe(20000);
    expect(report.summary.refundedPaise).toBe(5000);
    expect(report.summary.netPaise).toBe(15000);
    const cash = report.charts.find((c) => c.id === "cash")!;
    expect(cash.rows[0].Captured).toBe(200);
    expect(cash.rows[0].Refunded).toBe(50);
  });
  it("rejects incorrect capture amount and foreign venue reports", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    const order = await checkout(player, m.id);
    await expect(
      capture({
        id: "pay_" + randomUUID(),
        order_id: order.orderId,
        amount: 1,
        currency: "INR",
        status: "captured",
        created_at: 0,
      }),
    ).rejects.toThrow("does not match");
    await expect(
      analytics(owner, new URLSearchParams("view=owner&venue=foreign-venue")),
    ).rejects.toThrow("Venue not found");
  });

  it("reconciles a delayed refund once and rejects a different payment", async () => {
    const m = await match();
    await approveHold(owner, m.id, new Date(Date.now() + 3600000));
    await pay(player, m.id);
    await withdraw(player, m.id);
    const refund = await db.refund.findFirstOrThrow({
      where: { payment: { order: { participation: { matchId: m.id } } } },
      include: { payment: true },
    });
    const provider = {
      id: "rfnd_" + randomUUID(),
      payment_id: refund.payment.providerPaymentId,
      amount: refund.amountPaise,
      currency: "INR",
      status: "processed",
      notes: { truf_refund: refund.id },
    };
    await expect(
      recordProviderRefund({ ...provider, payment_id: "wrong-payment" }),
    ).rejects.toThrow("original payment");
    await recordProviderRefund(provider);
    const first = await db.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    await recordProviderRefund(provider);
    await recordProviderRefund({ ...provider, status: "pending" });
    const latest = await db.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(latest.status).toBe("PROCESSED");
    expect(latest.completedAt).toEqual(first.completedAt);
    expect(
      (
        await db.job.findUniqueOrThrow({
          where: { key: "refund:" + refund.id },
        })
      ).status,
    ).toBe("DONE");
  });
});
