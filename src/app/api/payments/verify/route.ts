import { z } from "zod";
import { currentUser, sameOrigin, AppError } from "@/server/access";
import { db } from "@/server/db";
import { verifySignature, razorpay, CapturedPayment } from "@/server/payments";
import { capture } from "@/server/booking";
import { captureWalletTopUp } from "@/server/wallet";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    const input = z
      .object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      })
      .parse(await request.json());
    const order = await db.paymentOrder.findFirst({
      where: {
        providerOrderId: input.razorpay_order_id,
        participation: { userId: user.id },
      },
    });
    const topUp = order
      ? null
      : await db.walletTopUp.findFirst({
          where: {
            providerOrderId: input.razorpay_order_id,
            userId: user.id,
          },
        });
    if (!order && !topUp) throw new AppError(404, "Order unavailable.");
    if (
      !verifySignature(
        input.razorpay_order_id + "|" + input.razorpay_payment_id,
        input.razorpay_signature,
        process.env.RAZORPAY_KEY_SECRET || "",
      )
    )
      throw new AppError(400, "Invalid payment signature.");
    const payment = await razorpay<CapturedPayment>(
      "payments/" + encodeURIComponent(input.razorpay_payment_id),
    );
    if (payment.order_id !== (order?.providerOrderId || topUp?.providerOrderId))
      throw new AppError(400, "Order mismatch.");
    if (topUp) await captureWalletTopUp(payment);
    else await capture(payment);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Payment verification pending. We will reconcile with the provider.",
      },
      { status: e instanceof AppError ? e.status : 500 },
    );
  }
}
