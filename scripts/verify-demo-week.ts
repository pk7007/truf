import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../src/server/db";
import { seedDemoWeek } from "./demo-week";
import { istDay } from "../src/lib/rules";
async function main() {
  await seedDemoWeek();
  const before = await db.payment.count({
    where: { providerPaymentId: { startsWith: "demo-only-" } },
  });
  await seedDemoWeek();
  assert.equal(
    await db.payment.count({
      where: { providerPaymentId: { startsWith: "demo-only-" } },
    }),
    before,
    "Re-seeding must not duplicate captures",
  );
  const end = new Date(istDay(new Date()) + "T00:00:00+05:30");
  const matches = await db.match.findMany({
    where: {
      id: { startsWith: "demo-week-" },
      slot: { startsAt: { gte: new Date(+end - 7 * 86400000), lt: end } },
    },
    include: {
      slot: true,
      participations: {
        include: {
          attendance: true,
          orders: { include: { payments: { include: { refunds: true } } } },
        },
      },
    },
  });
  assert.equal(matches.length, 42);
  let captured = 0,
    refunded = 0,
    attended = 0;
  for (const match of matches) {
    assert.equal(match.participations.length, match.capacity);
    assert.equal(match.capacity * match.sharePaise, match.slot.pricePaise);
    for (const p of match.participations) {
      assert.equal(p.orders.length, 1);
      assert.equal(p.orders[0].payments.length, 1);
      const payment = p.orders[0].payments[0];
      captured += payment.amountPaise;
      refunded += payment.refunds.reduce((n, r) => n + r.amountPaise, 0);
      if (match.status === "CANCELLED") {
        assert.equal(payment.refunds[0]?.amountPaise, payment.amountPaise);
        assert.equal(p.attendance, null);
      }
      if (p.attendance?.status === "ATTENDED") attended++;
    }
  }
  assert.ok(refunded > 0 && captured > refunded && attended > 0);
  console.log(
    JSON.stringify({
      matches: matches.length,
      capturedPaise: captured,
      refundedPaise: refunded,
      attended,
      idempotent: true,
      fictional: true,
    }),
  );
}
main().finally(() => db.$disconnect());
