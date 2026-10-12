import { Job, Prisma } from "@prisma/client";
import { db } from "./db";
import { closeMatch, serial, event, capture } from "./booking";
import { notify } from "./jobs";
import { razorpay, CapturedPayment } from "./payments";
import { recordProviderRefund, type ProviderRefund } from "./refunds";
export async function processJob(job: Job) {
  const p = job.payload as Record<string, string>;
  if (job.kind === "EXPIRE")
    await serial(async (tx) => {
      const m = await tx.match.findUnique({ where: { id: p.matchId } });
      if (m?.status === "RECRUITING" && m.deadline && m.deadline <= new Date())
        await closeMatch(tx, m.id, "EXPIRED", "worker");
    });
  else if (job.kind === "COMPLETE")
    await serial(async (tx) => {
      const m = await tx.match.findUnique({
        where: { id: p.matchId },
        include: { slot: true },
      });
      if (m?.status === "CONFIRMED" && m.slot.endsAt <= new Date()) {
        await tx.match.update({
          where: { id: m.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await tx.booking.update({
          where: { matchId: m.id },
          data: { status: "COMPLETED" },
        });
        await event(tx, m.id, "COMPLETED");
        await notify(
          tx,
          m.captainId,
          "Game finished",
          "Ask the venue staff to record attendance.",
          "/matches/" + m.id,
        );
      }
    });
  else if (job.kind === "REMINDER") {
    const m = await db.match.findUnique({
      where: { id: p.matchId },
      include: { participations: true },
    });
    if (m?.status === "CONFIRMED")
      for (const member of m.participations.filter((x) => x.status === "PAID"))
        await notify(
          db,
          member.userId,
          "Your game starts soon",
          m.title,
          "/matches/" + m.id,
        );
  } else if (job.kind === "REFUND") {
    const r = await db.refund.findUniqueOrThrow({
      where: { id: p.refundId },
      include: { payment: true },
    });
    if (r.status === "PROCESSED") return;
    let provider: ProviderRefund | undefined;
    if (r.providerRefundId)
      provider = await razorpay<ProviderRefund>(
        "refunds/" + r.providerRefundId,
      );
    else {
      const list = await razorpay<{ items: ProviderRefund[] }>(
        "payments/" + r.payment.providerPaymentId + "/refunds",
      );
      provider = list.items.find((x) => x.notes?.truf_refund === r.id);
      if (!provider) {
        if (r.status === "SUBMITTING")
          throw Error(
            "Refund submission outcome unknown; reconcile with provider before retrying.",
          );
        await db.refund.update({
          where: { id: r.id },
          data: { status: "SUBMITTING" },
        });
        provider = await razorpay<ProviderRefund>(
          "payments/" + r.payment.providerPaymentId + "/refund",
          {
            amount: r.amountPaise,
            notes: { truf_refund: r.id },
            receipt: r.id,
          },
        );
      }
    }
    await recordProviderRefund(provider);
    if (provider.status !== "processed")
      throw Error("Refund is still pending at provider.");
  } else throw Error("Unknown durable job kind");
}
export async function runOneJob() {
  const jobs = await db.$queryRaw<Job[]>(
    Prisma.sql`UPDATE "Job" SET status='RUNNING', "lockedAt"=NOW(), attempts=attempts+1 WHERE id=(SELECT id FROM "Job" WHERE (status='READY' AND "runAt"<=NOW()) OR (status='RUNNING' AND "lockedAt"<NOW()-INTERVAL '10 minutes') ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
  );
  const job = jobs[0];
  if (!job) return false;
  try {
    await processJob(job);
    await db.job.update({
      where: { id: job.id },
      data: { status: "DONE", lockedAt: null, error: null },
    });
  } catch (e) {
    await db.job.update({
      where: { id: job.id },
      data: {
        status: job.attempts >= 12 ? "FAILED" : "READY",
        lockedAt: null,
        runAt: new Date(
          Date.now() + Math.min(3600000, 1000 * 2 ** job.attempts),
        ),
        error: (e instanceof Error ? e.message : "Unknown failure").slice(
          0,
          500,
        ),
      },
    });
  }
  return true;
}
export async function reconcile() {
  await db.job.upsert({
    where: { key: "worker-heartbeat" },
    create: {
      key: "worker-heartbeat",
      kind: "HEARTBEAT",
      payload: {},
      status: "DONE",
    },
    update: { runAt: new Date() },
  });
  await db.rateLimit.deleteMany({
    where: { lastRequest: { lt: BigInt(Date.now() - 86400000) } },
  });
  if (!process.env.RAZORPAY_KEY_ID) return;
  const orders = await db.paymentOrder.findMany({
    where: { status: { in: ["CREATED", "RECONCILE", "CREATING"] } },
    take: 100,
    orderBy: { reconciledAt: { sort: "asc", nulls: "first" } },
  });
  for (const order of orders) {
    try {
      let providerId = order.providerOrderId;
      if (!providerId) {
        const result = await razorpay<{
          items: {
            id: string;
            receipt: string;
            amount: number;
            currency: string;
          }[];
        }>("orders?receipt=" + encodeURIComponent(order.id));
        const found = result.items.find(
          (o) =>
            o.receipt === order.id &&
            o.amount === order.amountPaise &&
            o.currency === "INR",
        );
        if (found) {
          providerId = found.id;
          await db.paymentOrder.update({
            where: { id: order.id },
            data: { providerOrderId: providerId, status: "CREATED" },
          });
        }
      }
      if (providerId) {
        const payments = await razorpay<{ items: CapturedPayment[] }>(
          "orders/" + providerId + "/payments",
        );
        for (const p of payments.items)
          if (p.status === "captured") await capture(p);
      }
    } catch (e) {
      await db.paymentOrder.update({
        where: { id: order.id },
        data: { status: "RECONCILE" },
      });
      console.error(
        "Reconciliation requires retry for order",
        order.id,
        e instanceof Error ? e.message : "unknown",
      );
    } finally {
      await db.paymentOrder.update({
        where: { id: order.id },
        data: { reconciledAt: new Date() },
      });
    }
  }
}
