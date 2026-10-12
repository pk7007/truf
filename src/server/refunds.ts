import { serial } from "./booking";
import { razorpay } from "./payments";
export type ProviderRefund = {
  id: string;
  payment_id: string;
  currency: string;
  amount: number;
  status: string;
  notes?: { truf_refund?: string };
};
/** Call only with a refund fetched directly from the provider API. */
export async function recordProviderRefund(provider: ProviderRefund) {
  if (!provider || typeof provider.id !== "string" || !provider.id || typeof provider.payment_id !== "string" || !Number.isSafeInteger(provider.amount)) throw Error("Invalid provider refund response.");
  return serial(async (tx) => {
    const refund = await tx.refund.findFirst({
      where: {
        OR: [
          { providerRefundId: provider.id },
          ...(provider.notes?.truf_refund
            ? [{ id: provider.notes.truf_refund }]
            : []),
        ],
      },
      include: { payment: true },
    });
    if (!refund) throw Error("Unknown refund; reconciliation required.");
    if (
      provider.payment_id !== refund.payment.providerPaymentId ||
      provider.amount !== refund.amountPaise ||
      provider.currency !== "INR" ||
      (refund.providerRefundId && refund.providerRefundId !== provider.id)
    )
      throw Error("Refund does not match the original payment.");
    if (!["processed", "pending", "failed"].includes(provider.status))
      throw Error("Unknown provider refund state.");
    if (refund.status === "PROCESSED") return;
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: provider.id,
        status: provider.status.toUpperCase(),
        completedAt: provider.status === "processed" ? new Date() : null,
      },
    });
    if (provider.status === "processed")
      await tx.job.updateMany({
        where: { key: "refund:" + refund.id, status: { not: "RUNNING" } },
        data: { status: "DONE", error: null, lockedAt: null },
      });
  });
}
export async function refreshRefund(providerId: string) {
  const provider = await razorpay<ProviderRefund>(
    "refunds/" + encodeURIComponent(providerId),
  );
  if (provider.id !== providerId) throw Error("Refund identifier mismatch.");
  await recordProviderRefund(provider);
}
