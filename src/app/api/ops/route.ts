import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
export async function GET(request: Request) {
  const expected = process.env.OPS_TOKEN,
    token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !expected ||
    !token ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const [failed, stale, refunds, orders, heartbeat] = await Promise.all([
      db.job.count({ where: { status: "FAILED" } }),
      db.job.count({
        where: {
          status: "RUNNING",
          lockedAt: { lt: new Date(Date.now() - 600000) },
        },
      }),
      db.refund.count({
        where: {
          status: { not: "PROCESSED" },
          createdAt: { lt: new Date(Date.now() - 86400000) },
        },
      }),
      db.paymentOrder.count({ where: { status: "RECONCILE" } }),
      db.job.findUnique({ where: { key: "worker-heartbeat" } }),
    ]);
    const workerStale = !heartbeat || +heartbeat.runAt < Date.now() - 180000;
    return Response.json(
      {
        failedJobs: failed,
        staleJobs: stale,
        overdueRefunds: refunds,
        reconciliationIssues: orders,
        workerStale,
      },
      {
        status: failed || stale || refunds || orders || workerStale ? 503 : 200,
      },
    );
  } catch {
    return Response.json({ error: "Monitoring unavailable" }, { status: 503 });
  }
}
