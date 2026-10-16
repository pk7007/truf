import { Prisma, User } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { AppError, requireOrganization } from "./access";
import { validateCapacity } from "@/lib/rules";
import { enqueue, notify } from "./jobs";
import { CapturedPayment, razorpay } from "./payments";
import { assertTestPayments } from "./env";
import { postWalletEntry, refundWalletParticipation } from "./wallet";
export async function serial<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (e) {
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== "P2034" ||
        attempt === 2
      )
        throw e;
    }
  }
  throw new AppError(409, "Please retry.");
}
export async function event(
  tx: Prisma.TransactionClient,
  id: string,
  status: string,
) {
  await tx.statusEvent.create({ data: { matchId: id, status } });
}
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  targetId: string,
  details: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({ data: { actorId, action, targetId, details } });
}
export async function requestMatch(
  user: User,
  input: {
    slotId: string;
    title: string;
    capacity: number;
    visibility: "PUBLIC" | "PRIVATE";
  },
) {
  const token =
    input.visibility === "PRIVATE"
      ? randomBytes(24).toString("hex")
      : undefined;
  const match = await serial(async (tx) => {
    const slot = await tx.slot.findUnique({
      where: { id: input.slotId },
      include: {
        booking: true,
        area: { include: { venue: { include: { organization: true } } } },
      },
    });
    if (
      !slot ||
      slot.blocked ||
      slot.booking ||
      !slot.area.venue.approved ||
      !slot.area.venue.published ||
      slot.area.venue.organization.status !== "APPROVED" ||
      slot.startsAt.getTime() < Date.now() + 3600000
    )
      throw new AppError(409, "Slot unavailable.");
    try {
      validateCapacity(slot.area.sport, input.capacity, slot.pricePaise);
    } catch (error) {
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Invalid team size.",
      );
    }
    const m = await tx.match.create({
      data: {
        slotId: slot.id,
        captainId: user.id,
        title: input.title,
        capacity: input.capacity,
        sharePaise: slot.pricePaise / input.capacity,
        visibility: input.visibility,
        invitationHash: token
          ? createHash("sha256").update(token).digest("hex")
          : null,
      },
    });
    await event(tx, m.id, "REQUESTED");
    await audit(tx, user.id, "MATCH_REQUEST", m.id);
    return m;
  });
  return { ...match, invitationToken: token };
}
export async function approveHold(user: User, id: string, deadline: Date) {
  const found = await db.match.findUniqueOrThrow({
    where: { id },
    include: { slot: { include: { area: { include: { venue: true } } } } },
  });
  await requireOrganization(user, found.slot.area.venue.organizationId);
  return serial(async (tx) => {
    const m = await tx.match.findUniqueOrThrow({
      where: { id },
      include: {
        slot: {
          include: {
            booking: true,
            area: { include: { venue: { include: { organization: true } } } },
          },
        },
      },
    });
    if (
      m.status !== "REQUESTED" ||
      m.slot.booking ||
      m.slot.blocked ||
      !m.slot.area.venue.approved ||
      !m.slot.area.venue.published ||
      m.slot.area.venue.organization.status !== "APPROVED" ||
      deadline.getTime() <= Date.now() ||
      deadline.getTime() > m.slot.startsAt.getTime() - 3600000
    )
      throw new AppError(409, "Hold unavailable or deadline invalid.");
    await tx.booking.create({ data: { slotId: m.slotId, matchId: id } });
    await tx.match.update({
      where: { id },
      data: { status: "RECRUITING", deadline },
    });
    await event(tx, id, "RECRUITING");
    await enqueue(tx, "expire:" + id, "EXPIRE", { matchId: id }, deadline);
    await notify(
      tx,
      m.captainId,
      "Slot hold approved",
      "Players can now commit their shares.",
      "/matches/" + id,
    );
    await audit(tx, user.id, "APPROVE_HOLD", id);
    return { id };
  });
}
export async function canReadMatch(user: User, id: string, token?: string) {
  const m = await db.match.findUnique({
    where: { id },
    include: {
      slot: { include: { area: { include: { venue: true } } } },
      participations: { select: { userId: true } },
    },
  });
  if (!m) throw new AppError(404, "Match not found.");
  if (
    m.visibility === "PUBLIC" ||
    m.captainId === user.id ||
    m.participations.some((p) => p.userId === user.id) ||
    (token &&
      createHash("sha256").update(token).digest("hex") === m.invitationHash)
  )
    return m;
  await requireOrganization(user, m.slot.area.venue.organizationId);
  return m;
}
export async function checkout(user: User, id: string, token?: string) {
  assertTestPayments();
  await canReadMatch(user, id, token);
  const order = await serial(async (tx) => {
    const m = await tx.match.findUniqueOrThrow({
      where: { id },
      include: { slot: true, participations: true, booking: true },
    });
    if (
      !["RECRUITING", "CONFIRMED"].includes(m.status) ||
      !m.booking ||
      m.slot.startsAt <= new Date() ||
      (m.status === "RECRUITING" && (!m.deadline || m.deadline <= new Date()))
    )
      throw new AppError(409, "Joining is closed.");
    const existing = m.participations.find((p) => p.userId === user.id);
    if (
      existing &&
      (["PAID", "WAITING_REPLACEMENT"].includes(existing.status) ||
        (existing.status === "CHECKOUT" &&
          existing.reservedUntil &&
          existing.reservedUntil > new Date()))
    )
      throw new AppError(
        409,
        "You already have a commitment or an active five-minute checkout.",
      );
    const conflict = await tx.participation.findFirst({
      where: {
        userId: user.id,
        OR: [
          { status: { in: ["PAID", "WAITING_REPLACEMENT"] } },
          { status: "CHECKOUT", reservedUntil: { gt: new Date() } },
        ],
        match: {
          status: { in: ["RECRUITING", "CONFIRMED"] },
          slot: {
            startsAt: { lt: m.slot.endsAt },
            endsAt: { gt: m.slot.startsAt },
          },
        },
      },
    });
    if (conflict)
      throw new AppError(409, "You have an overlapping commitment.");
    const waiting = m.participations.find(
      (p) =>
        p.status === "WAITING_REPLACEMENT" &&
        !m.participations.some(
          (x) =>
            x.replacementFor === p.id &&
            x.status === "CHECKOUT" &&
            x.reservedUntil &&
            x.reservedUntil > new Date(),
        ),
    );
    const active = m.participations.filter(
      (p) =>
        ["PAID", "WAITING_REPLACEMENT"].includes(p.status) ||
        (p.status === "CHECKOUT" &&
          p.reservedUntil &&
          p.reservedUntil > new Date()),
    ).length;
    if (
      (active >= m.capacity && !waiting) ||
      (m.status === "CONFIRMED" && !waiting)
    )
      throw new AppError(409, "No place available.");
    const until = new Date(
      Math.min(
        Date.now() + 300000,
        m.status === "RECRUITING"
          ? m.deadline!.getTime()
          : m.slot.startsAt.getTime(),
      ),
    );
    if (waiting)
      await tx.participation.updateMany({
        where: {
          replacementFor: waiting.id,
          status: "CHECKOUT",
          reservedUntil: { lte: new Date() },
        },
        data: { replacementFor: null, status: "EXPIRED" },
      });
    const p = await tx.participation.upsert({
      where: { matchId_userId: { matchId: id, userId: user.id } },
      create: {
        userId: user.id,
        matchId: id,
        reservedUntil: until,
        replacementFor: waiting?.id,
      },
      update: {
        status: "CHECKOUT",
        reservedUntil: until,
        replacementFor: waiting?.id || null,
      },
    });
    const order = await tx.paymentOrder.create({
      data: { participationId: p.id, amountPaise: m.sharePaise },
    });
    await tx.participation.update({
      where: { id: p.id },
      data: { currentOrderId: order.id },
    });
    return order;
  });
  try {
    const provider = await razorpay<{ id: string }>("orders", {
      amount: order.amountPaise,
      currency: "INR",
      receipt: order.id,
    });
    await db.paymentOrder.update({
      where: { id: order.id },
      data: { providerOrderId: provider.id, status: "CREATED" },
    });
    return {
      orderId: provider.id,
      amount: order.amountPaise,
      key: process.env.RAZORPAY_KEY_ID,
      currency: "INR",
    };
  } catch (error) {
    await db.paymentOrder.update({
      where: { id: order.id },
      data: { status: "RECONCILE" },
    });
    throw error;
  }
}
export async function walletCheckout(user: User, id: string, token?: string) {
  await canReadMatch(user, id, token);
  return serial(async (tx) => {
    const m = await tx.match.findUniqueOrThrow({
      where: { id },
      include: { slot: true, participations: true, booking: true },
    });
    if (
      !["RECRUITING", "CONFIRMED"].includes(m.status) ||
      !m.booking ||
      m.slot.startsAt <= new Date() ||
      (m.status === "RECRUITING" && (!m.deadline || m.deadline <= new Date()))
    )
      throw new AppError(409, "Joining is closed.");
    const existing = m.participations.find((p) => p.userId === user.id);
    if (existing && ["PAID", "WAITING_REPLACEMENT"].includes(existing.status))
      throw new AppError(409, "You already paid for this match.");
    const conflict = await tx.participation.findFirst({
      where: {
        userId: user.id,
        status: { in: ["PAID", "WAITING_REPLACEMENT"] },
        match: {
          status: { in: ["RECRUITING", "CONFIRMED"] },
          slot: {
            startsAt: { lt: m.slot.endsAt },
            endsAt: { gt: m.slot.startsAt },
          },
        },
      },
    });
    if (conflict)
      throw new AppError(409, "You have an overlapping commitment.");
    const waiting = m.participations.find(
      (p) =>
        p.status === "WAITING_REPLACEMENT" &&
        !m.participations.some(
          (x) => x.replacementFor === p.id && x.status === "PAID",
        ),
    );
    const active = m.participations.filter((p) =>
      ["PAID", "WAITING_REPLACEMENT"].includes(p.status),
    ).length;
    if (
      (active >= m.capacity && !waiting) ||
      (m.status === "CONFIRMED" && !waiting)
    )
      throw new AppError(409, "No place available.");
    const participation = await tx.participation.upsert({
      where: { matchId_userId: { matchId: id, userId: user.id } },
      create: {
        userId: user.id,
        matchId: id,
        status: "PAID",
        replacementFor: waiting?.id,
      },
      update: {
        status: "PAID",
        reservedUntil: null,
        currentOrderId: null,
        replacementFor: waiting?.id || null,
      },
    });
    await postWalletEntry(tx, {
      userId: user.id,
      type: "BOOKING",
      amountPaise: m.sharePaise,
      direction: "DEBIT",
      referenceType: "PARTICIPATION",
      referenceId: participation.id,
      description: m.title + " · booking share",
      idempotencyKey: "booking:" + participation.id,
    });
    if (waiting) {
      const previous = await tx.participation.findUniqueOrThrow({
        where: { id: waiting.id },
        include: { orders: { include: { payments: true } } },
      });
      await refundWalletParticipation(
        tx,
        previous.id,
        previous.userId,
        "Refund · paid substitute found",
      );
      for (const order of previous.orders)
        for (const payment of order.payments)
          await refundPayment(
            tx,
            payment.id,
            payment.amountPaise,
            "Paid substitute found",
          );
      await tx.participation.update({
        where: { id: previous.id },
        data: { status: "WITHDRAWN" },
      });
    }
    const count = await tx.participation.count({
      where: { matchId: m.id, status: "PAID" },
    });
    if (count === m.capacity && m.status === "RECRUITING") {
      await tx.match.update({
        where: { id: m.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await tx.booking.update({
        where: { matchId: m.id },
        data: { status: "CONFIRMED" },
      });
      await event(tx, m.id, "CONFIRMED");
      await enqueue(
        tx,
        "complete:" + m.id,
        "COMPLETE",
        { matchId: m.id },
        m.slot.endsAt,
      );
      await enqueue(
        tx,
        "remind:" + m.id,
        "REMINDER",
        { matchId: m.id },
        new Date(+m.slot.startsAt - 3600000),
      );
      const members = await tx.participation.findMany({
        where: { matchId: m.id, status: "PAID" },
      });
      for (const member of members)
        await notify(
          tx,
          member.userId,
          "Game confirmed",
          m.title + " is ready to play.",
          "/matches/" + m.id,
        );
    }
    await notify(
      tx,
      user.id,
      "Wallet payment complete",
      "Your place is committed and your wallet receipt is ready.",
      "/app/wallet",
    );
    await audit(tx, user.id, "WALLET_BOOKING", participation.id, {
      matchId: m.id,
      amountPaise: m.sharePaise,
    });
    return { ok: true, participationId: participation.id };
  });
}
export async function refundPayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
  amountPaise: number,
  reason: string,
) {
  const refund = await tx.refund.upsert({
    where: { paymentId },
    create: { paymentId, amountPaise, reason },
    update: {},
  });
  await enqueue(tx, "refund:" + refund.id, "REFUND", { refundId: refund.id });
}
export async function capture(payment: CapturedPayment) {
  if (payment.status !== "captured" || payment.currency !== "INR")
    throw new AppError(400, "Payment is not captured in INR.");
  return serial(async (tx) => {
    if (
      await tx.payment.findUnique({ where: { providerPaymentId: payment.id } })
    )
      return;
    const order = await tx.paymentOrder.findUnique({
      where: { providerOrderId: payment.order_id },
      include: {
        participation: {
          include: { match: { include: { slot: true, booking: true } } },
        },
      },
    });
    if (!order || payment.amount !== order.amountPaise)
      throw new AppError(400, "Payment does not match an order.");
    const paid = await tx.payment.create({
      data: {
        orderId: order.id,
        providerPaymentId: payment.id,
        amountPaise: payment.amount,
        feePaise: payment.fee || 0,
        capturedAt: new Date(),
      },
    });
    const p = order.participation,
      m = p.match;
    if (
      !m.booking ||
      !["RECRUITING", "CONFIRMED"].includes(m.status) ||
      p.currentOrderId !== order.id ||
      p.status !== "CHECKOUT" ||
      !p.reservedUntil ||
      p.reservedUntil <= new Date() ||
      (m.status === "RECRUITING" && (!m.deadline || m.deadline <= new Date()))
    ) {
      await refundPayment(
        tx,
        paid.id,
        paid.amountPaise,
        "Late or unavailable commitment",
      );
      if (p.currentOrderId === order.id && p.status === "CHECKOUT")
        await tx.participation.update({
          where: { id: p.id },
          data: { status: "REFUND_PENDING" },
        });
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });
      return;
    }
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    await tx.participation.update({
      where: { id: p.id },
      data: { status: "PAID", reservedUntil: null },
    });
    if (p.replacementFor) {
      const previous = await tx.participation.findUniqueOrThrow({
        where: { id: p.replacementFor },
        include: { orders: { include: { payments: true } } },
      });
      if (previous.status !== "WAITING_REPLACEMENT")
        throw new AppError(409, "Replacement state changed.");
      await refundWalletParticipation(
        tx,
        previous.id,
        previous.userId,
        "Refund · paid substitute found",
      );
      for (const o of previous.orders)
        for (const q of o.payments)
          await refundPayment(tx, q.id, q.amountPaise, "Paid substitute found");
      await tx.participation.update({
        where: { id: previous.id },
        data: { status: "WITHDRAWN" },
      });
    }
    const count = await tx.participation.count({
      where: { matchId: m.id, status: "PAID" },
    });
    if (count === m.capacity && m.status === "RECRUITING") {
      await tx.match.update({
        where: { id: m.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await tx.booking.update({
        where: { matchId: m.id },
        data: { status: "CONFIRMED" },
      });
      await event(tx, m.id, "CONFIRMED");
      await enqueue(
        tx,
        "complete:" + m.id,
        "COMPLETE",
        { matchId: m.id },
        m.slot.endsAt,
      );
      await enqueue(
        tx,
        "remind:" + m.id,
        "REMINDER",
        { matchId: m.id },
        new Date(+m.slot.startsAt - 3600000),
      );
      const members = await tx.participation.findMany({
        where: { matchId: m.id, status: "PAID" },
      });
      for (const member of members)
        await notify(
          tx,
          member.userId,
          "Game confirmed",
          m.title + " is ready to play.",
          "/matches/" + m.id,
        );
    }
    await notify(
      tx,
      p.userId,
      "Payment received",
      "Your place is committed.",
      "/matches/" + m.id,
    );
  });
}
export async function withdraw(user: User, id: string) {
  return serial(async (tx) => {
    const p = await tx.participation.findUniqueOrThrow({
      where: { matchId_userId: { matchId: id, userId: user.id } },
      include: {
        match: { include: { slot: true } },
        orders: { include: { payments: true } },
      },
    });
    if (p.status !== "PAID" || p.match.slot.startsAt <= new Date())
      throw new AppError(409, "Withdrawal unavailable.");
    if (p.match.status === "CONFIRMED") {
      await tx.participation.update({
        where: { id: p.id },
        data: { status: "WAITING_REPLACEMENT" },
      });
      await notify(
        tx,
        user.id,
        "Replacement requested",
        "Your refund starts when a substitute pays.",
        "/matches/" + id,
      );
    } else if (p.match.status === "RECRUITING") {
      await tx.participation.update({
        where: { id: p.id },
        data: { status: "WITHDRAWN" },
      });
      for (const o of p.orders)
        for (const q of o.payments)
          await refundPayment(
            tx,
            q.id,
            q.amountPaise,
            "Withdrawal before confirmation",
          );
      await refundWalletParticipation(
        tx,
        p.id,
        p.userId,
        "Refund · withdrawal before confirmation",
      );
    } else throw new AppError(409, "Match is closed.");
    await audit(tx, user.id, "WITHDRAW", id);
  });
}
export async function closeMatch(
  tx: Prisma.TransactionClient,
  id: string,
  status: "CANCELLED" | "EXPIRED",
  actorId: string,
) {
  const m = await tx.match.findUniqueOrThrow({
    where: { id },
    include: {
      participations: { include: { orders: { include: { payments: true } } } },
    },
  });
  if (["CANCELLED", "EXPIRED", "COMPLETED"].includes(m.status)) return;
  await tx.match.update({ where: { id }, data: { status } });
  await tx.booking.deleteMany({ where: { matchId: id } });
  for (const p of m.participations) {
    for (const o of p.orders)
      for (const q of o.payments)
        await refundPayment(tx, q.id, q.amountPaise, status);
    await refundWalletParticipation(
      tx,
      p.id,
      p.userId,
      "Refund · match " + status.toLowerCase(),
    );
    await notify(
      tx,
      p.userId,
      "Match " + status.toLowerCase(),
      "Eligible refunds are being processed.",
      "/matches/" + id,
    );
  }
  await tx.participation.updateMany({
    where: { matchId: id },
    data: { status: "CANCELLED", reservedUntil: null },
  });
  await event(tx, id, status);
  await audit(tx, actorId, status, id);
}
