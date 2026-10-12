import { db } from "./db";
import { razorpay } from "./payments";
import { serial } from "./booking";
type ProviderTransfer = {
  id: string;
  amount: number;
  status: string;
  recipient_settlement_id?: string;
  notes?: { truf_payment?: string };
};
/** Test-only. Enabling this requires a provider-approved test linked account arrangement. */
export async function transferCompletedPayment(paymentId: string) {
  if (process.env.ROUTE_TEST_APPROVED !== "true")
    throw Error("Route test transfers require explicit provider approval.");
  const p = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      refunds: true,
      transfer: true,
      order: {
        include: {
          participation: {
            include: {
              match: {
                include: {
                  slot: {
                    include: {
                      area: {
                        include: { venue: { include: { organization: true } } },
                      },
                    },
                  },
                  participations: {
                    include: {
                      orders: {
                        include: { payments: { include: { refunds: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const match = p.order.participation.match,
    org = match.slot.area.venue.organization;
  if (
    match.status !== "COMPLETED" ||
    !org.linkedAccountId ||
    p.order.participation.status !== "PAID"
  )
    throw Error("Payment is not eligible for transfer.");
  if (
    match.participations.some((member) =>
      member.orders.some((o) =>
        o.payments.some((pay) =>
          pay.refunds.some((r) => r.status !== "PROCESSED"),
        ),
      ),
    )
  )
    throw Error("Resolve pending refunds before transferring.");
  const amount =
    p.amountPaise - p.refunds.reduce((sum, r) => sum + r.amountPaise, 0);
  if (amount <= 0) return;
  if (!process.env.ROUTE_FEE_BEARER_CONFIRMED)
    throw Error("Confirm fee responsibility during merchant onboarding.");
  let record = await serial(async (tx) =>
    tx.transfer.upsert({
      where: { paymentId: p.id },
      create: { paymentId: p.id, amountPaise: amount },
      update: {},
    }),
  );
  if (record.providerTransferId) return record;
  const existing = await razorpay<{ items: ProviderTransfer[] }>(
    "payments/" + p.providerPaymentId + "/transfers",
  );
  let transfer = existing.items.find((t) => t.notes?.truf_payment === p.id);
  if (!transfer) {
    const lock = await db.transfer.updateMany({
      where: { id: record.id, status: "PENDING" },
      data: { status: "SUBMITTING" },
    });
    if (!lock.count)
      throw Error(
        "Transfer outcome unknown; manual provider reconciliation required.",
      );
    const response = await razorpay<{ items: ProviderTransfer[] }>(
      "payments/" + p.providerPaymentId + "/transfers",
      {
        transfers: [
          {
            account: org.linkedAccountId,
            amount,
            currency: "INR",
            notes: { truf_payment: p.id },
            on_hold: 0,
          },
        ],
      },
    );
    transfer = response.items[0];
  }
  if (!transfer || transfer.amount !== amount)
    throw Error("Transfer response mismatch.");
  record = await db.transfer.update({
    where: { id: record.id },
    data: {
      providerTransferId: transfer.id,
      status: transfer.status.toUpperCase(),
    },
  });
  return record;
}
