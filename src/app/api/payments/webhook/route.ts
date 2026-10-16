import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { verifySignature, razorpay, CapturedPayment } from "@/server/payments";
import { capture } from "@/server/booking";
import { refreshRefund } from "@/server/refunds";
import { captureWalletTopUp } from "@/server/wallet";
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 100000) return new Response("Too large", { status: 413 });
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (
    !secret ||
    !verifySignature(
      raw,
      request.headers.get("x-razorpay-signature") || "",
      secret,
    )
  )
    return new Response("Invalid signature", { status: 400 });
  try {
    const event = JSON.parse(raw);
    const id =
      request.headers.get("x-razorpay-event-id") ||
      createHash("sha256").update(raw).digest("hex");
    if (await db.webhookEvent.findUnique({ where: { id } }))
      return Response.json({ ok: true });
    if (event.event === "payment.captured") {
      const paymentId = event.payload?.payment?.entity?.id;
      if (typeof paymentId !== "string")
        return new Response("Missing payment", { status: 400 });
      const payment = await razorpay<CapturedPayment>(
        "payments/" + encodeURIComponent(paymentId),
      );
      if (
        await db.walletTopUp.findUnique({
          where: { providerOrderId: payment.order_id },
        })
      )
        await captureWalletTopUp(payment);
      else await capture(payment);
    }
    if (
      ["refund.processed", "refund.failed", "refund.created"].includes(
        event.event,
      )
    ) {
      const refundId = event.payload?.refund?.entity?.id;
      if (typeof refundId !== "string")
        return new Response("Missing refund", { status: 400 });
      await refreshRefund(refundId);
    }
    await db.webhookEvent.upsert({
      where: { id },
      create: { id, type: String(event.event) },
      update: {},
    });
    return Response.json({ ok: true });
  } catch {
    return new Response("Retry required", { status: 500 });
  }
}
