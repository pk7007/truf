import { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./access";
import { assertTestPayments } from "./env";
import { CapturedPayment, razorpay } from "./payments";

export async function walletFor(tx: Prisma.TransactionClient, userId: string) {
  return tx.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function postWalletEntry(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    type: "TOP_UP" | "BOOKING" | "REFUND" | "SETTLEMENT" | "ADJUSTMENT";
    amountPaise: number;
    direction: "CREDIT" | "DEBIT";
    referenceType: string;
    referenceId: string;
    description: string;
    idempotencyKey: string;
  },
) {
  const prior = await tx.walletEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (prior) return prior;
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0)
    throw new AppError(400, "Wallet amount is invalid.");
  const wallet = await walletFor(tx, input.userId);
  const next =
    wallet.balancePaise +
    (input.direction === "CREDIT" ? input.amountPaise : -input.amountPaise);
  if (next < 0) throw new AppError(409, "Your wallet balance is too low.");
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balancePaise: next },
  });
  return tx.walletEntry.create({
    data: {
      walletId: wallet.id,
      type: input.type,
      amountPaise: input.amountPaise,
      balanceAfterPaise: next,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function refundWalletParticipation(
  tx: Prisma.TransactionClient,
  participationId: string,
  userId: string,
  reason: string,
) {
  const debit = await tx.walletEntry.findUnique({
    where: { idempotencyKey: "booking:" + participationId },
  });
  if (!debit) return false;
  await postWalletEntry(tx, {
    userId,
    type: "REFUND",
    amountPaise: debit.amountPaise,
    direction: "CREDIT",
    referenceType: "PARTICIPATION",
    referenceId: participationId,
    description: reason,
    idempotencyKey: "refund:" + participationId,
  });
  return true;
}

export async function createWalletTopUp(user: User, amountPaise: number) {
  assertTestPayments();
  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise < 10000 ||
    amountPaise > 500000
  )
    throw new AppError(400, "Choose a top-up between ₹100 and ₹5,000.");
  const topUp = await db.walletTopUp.create({
    data: { userId: user.id, amountPaise },
  });
  try {
    const provider = await razorpay<{ id: string }>("orders", {
      amount: amountPaise,
      currency: "INR",
      receipt: topUp.id,
      notes: { truf_wallet_top_up: topUp.id },
    });
    await db.walletTopUp.update({
      where: { id: topUp.id },
      data: { providerOrderId: provider.id, status: "CREATED" },
    });
    return {
      orderId: provider.id,
      amount: amountPaise,
      key: process.env.RAZORPAY_KEY_ID,
      currency: "INR",
      purpose: "wallet",
    };
  } catch (error) {
    await db.walletTopUp.update({
      where: { id: topUp.id },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

export async function captureWalletTopUp(payment: CapturedPayment) {
  if (payment.status !== "captured" || payment.currency !== "INR")
    throw new AppError(400, "Top-up is not captured in INR.");
  return db.$transaction(
    async (tx) => {
      const topUp = await tx.walletTopUp.findUnique({
        where: { providerOrderId: payment.order_id },
      });
      if (!topUp || topUp.amountPaise !== payment.amount)
        throw new AppError(400, "Top-up does not match an order.");
      if (topUp.status === "CAPTURED") return topUp;
      if (topUp.providerPaymentId && topUp.providerPaymentId !== payment.id)
        throw new AppError(409, "Top-up was already paid.");
      await postWalletEntry(tx, {
        userId: topUp.userId,
        type: "TOP_UP",
        amountPaise: topUp.amountPaise,
        direction: "CREDIT",
        referenceType: "TOP_UP",
        referenceId: topUp.id,
        description: "Wallet top-up",
        idempotencyKey: "top-up:" + topUp.id,
      });
      return tx.walletTopUp.update({
        where: { id: topUp.id },
        data: {
          status: "CAPTURED",
          providerPaymentId: payment.id,
          feePaise: payment.fee || 0,
          capturedAt: new Date(),
        },
      });
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}
