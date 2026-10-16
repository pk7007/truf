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
    type:
      | "TOP_UP"
      | "BOOKING"
      | "REFUND"
      | "SETTLEMENT"
      | "WITHDRAWAL_HOLD"
      | "WITHDRAWAL_RELEASE"
      | "ADJUSTMENT";
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

export async function withdrawableEarnings(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const wallet = await walletFor(tx, userId);
  const [settled, held] = await Promise.all([
    tx.walletEntry.aggregate({
      where: { walletId: wallet.id, type: "SETTLEMENT" },
      _sum: { amountPaise: true },
    }),
    tx.walletWithdrawal.aggregate({
      where: {
        walletId: wallet.id,
        status: { notIn: ["REJECTED", "CANCELLED"] },
      },
      _sum: { amountPaise: true },
    }),
  ]);
  return Math.max(
    0,
    Math.min(
      wallet.balancePaise,
      (settled._sum.amountPaise || 0) - (held._sum.amountPaise || 0),
    ),
  );
}

export async function walletWithdrawalSummary(userId: string) {
  return db.$transaction(async (tx) => ({
    canWithdraw:
      (await tx.membership.count({
        where: {
          userId,
          role: "OWNER",
          organization: { status: "APPROVED" },
        },
      })) > 0,
    withdrawablePaise: await withdrawableEarnings(tx, userId),
  }));
}

export async function requestWalletWithdrawal(
  user: User,
  amountPaise: number,
  payoutMethod: "BANK" | "UPI",
) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 50000)
    throw new AppError(400, "The minimum withdrawal is ₹500.");
  if (amountPaise > 5000000)
    throw new AppError(400, "The maximum withdrawal per request is ₹50,000.");
  return db.$transaction(
    async (tx) => {
      const owner = await tx.membership.count({
        where: {
          userId: user.id,
          role: "OWNER",
          organization: { status: "APPROVED" },
        },
      });
      if (!owner)
        throw new AppError(
          403,
          "Withdrawals are available only for approved turf-owner earnings.",
        );
      const available = await withdrawableEarnings(tx, user.id);
      if (amountPaise > available)
        throw new AppError(
          409,
          "The requested amount exceeds available earnings.",
        );
      const wallet = await walletFor(tx, user.id);
      const withdrawal = await tx.walletWithdrawal.create({
        data: {
          walletId: wallet.id,
          userId: user.id,
          amountPaise,
          payoutMethod,
        },
      });
      await postWalletEntry(tx, {
        userId: user.id,
        type: "WITHDRAWAL_HOLD",
        amountPaise,
        direction: "DEBIT",
        referenceType: "WITHDRAWAL",
        referenceId: withdrawal.id,
        description: `Withdrawal request · ${payoutMethod}`,
        idempotencyKey: "withdrawal-hold:" + withdrawal.id,
      });
      await tx.notification.create({
        data: {
          userId: user.id,
          title: "Withdrawal requested",
          body: "Your earnings are reserved while TRUF reviews the request.",
          href: "/app/wallet",
        },
      });
      return withdrawal;
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}

export async function cancelWalletWithdrawal(user: User, id: string) {
  return db.$transaction(
    async (tx) => {
      const withdrawal = await tx.walletWithdrawal.findFirst({
        where: { id, userId: user.id },
      });
      if (!withdrawal) throw new AppError(404, "Withdrawal request not found.");
      if (withdrawal.status !== "REQUESTED")
        throw new AppError(409, "This withdrawal can no longer be cancelled.");
      await tx.walletWithdrawal.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await postWalletEntry(tx, {
        userId: user.id,
        type: "WITHDRAWAL_RELEASE",
        amountPaise: withdrawal.amountPaise,
        direction: "CREDIT",
        referenceType: "WITHDRAWAL",
        referenceId: withdrawal.id,
        description: "Cancelled withdrawal · funds released",
        idempotencyKey: "withdrawal-release:" + withdrawal.id,
      });
      return { ok: true };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}

export async function reviewWalletWithdrawal(
  reviewer: User,
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  return db.$transaction(
    async (tx) => {
      const withdrawal = await tx.walletWithdrawal.findUnique({
        where: { id },
      });
      if (!withdrawal) throw new AppError(404, "Withdrawal request not found.");
      if (withdrawal.status !== "REQUESTED")
        throw new AppError(409, "This request was already reviewed.");
      await tx.walletWithdrawal.update({
        where: { id },
        data: {
          status: decision,
          note: note?.slice(0, 200) || null,
          reviewedBy: reviewer.id,
          reviewedAt: new Date(),
        },
      });
      if (decision === "REJECTED")
        await postWalletEntry(tx, {
          userId: withdrawal.userId,
          type: "WITHDRAWAL_RELEASE",
          amountPaise: withdrawal.amountPaise,
          direction: "CREDIT",
          referenceType: "WITHDRAWAL",
          referenceId: withdrawal.id,
          description: "Rejected withdrawal · funds released",
          idempotencyKey: "withdrawal-release:" + withdrawal.id,
        });
      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          title: `Withdrawal ${decision.toLowerCase()}`,
          body:
            decision === "APPROVED"
              ? "Approved for payout processing. No cash transfer occurs until a payout provider is connected."
              : "The request was rejected and the reserved earnings returned to your wallet.",
          href: "/app/wallet",
        },
      });
      return { ok: true };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}
