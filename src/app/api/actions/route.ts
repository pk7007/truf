import { transferCompletedPayment } from "@/server/transfers";
import { recordAttendance } from "@/server/attendance";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  currentUser,
  sameOrigin,
  requireOrganization,
  admin,
  AppError,
} from "@/server/access";
import {
  requestMatch,
  approveHold,
  checkout,
  withdraw,
  serial,
  audit,
  closeMatch,
} from "@/server/booking";
import { db } from "@/server/db";
import { SPORTS } from "@/lib/rules";
import { limit } from "@/server/rate-limit";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    await limit(user.id, "actions");
    if (Number(request.headers.get("content-length")) > 20000)
      throw new AppError(413, "Request too large.");
    const raw = await request.json(),
      action = z.string().parse(raw.action),
      id = z.string().optional().parse(raw.id);
    let result: unknown = { ok: true };
    switch (action) {
      case "match":
        result = await requestMatch(
          user,
          z
            .object({
              slotId: z.string(),
              title: z.string().min(3).max(100),
              capacity: z.coerce.number().int(),
              visibility: z.enum(["PUBLIC", "PRIVATE"]),
            })
            .parse(raw),
        );
        break;
      case "approve":
        await approveHold(
          user,
          z.string().parse(id),
          z.coerce.date().parse(raw.deadline),
        );
        break;
      case "checkout":
        result = await checkout(
          user,
          z.string().parse(id),
          z.string().optional().parse(raw.token),
        );
        break;
      case "withdraw":
        await withdraw(user, z.string().parse(id));
        break;
      case "cancel": {
        const m = await db.match.findUniqueOrThrow({
          where: { id: z.string().parse(id) },
          include: {
            slot: { include: { area: { include: { venue: true } } } },
          },
        });
        await requireOrganization(user, m.slot.area.venue.organizationId);
        await serial((tx) => closeMatch(tx, m.id, "CANCELLED", user.id));
        break;
      }
      case "attendance":
        await recordAttendance(
          user,
          z.string().parse(id),
          z.enum(["ATTENDED", "NO_SHOW", "UNMARKED"]).parse(raw.status),
        );
        break;
      case "profile":
        await db.user.update({
          where: { id: user.id },
          data: z
            .object({
              name: z.string().min(2).max(80),
              locality: z.string().max(100),
              sports: z.array(z.enum(SPORTS)).max(3),
            })
            .parse(raw),
        });
        break;
      case "read":
        await db.notification.updateMany({
          where: { id: z.string().parse(id), userId: user.id },
          data: { readAt: new Date() },
        });
        break;
      case "organization": {
        const name = z.string().min(3).max(100).parse(raw.name);
        if ((await db.membership.count({ where: { userId: user.id } })) > 5)
          throw new AppError(400, "Organization limit reached.");
        result = await db.organization.create({
          data: { name, memberships: { create: { userId: user.id } } },
        });
        break;
      }
      case "venue": {
        const input = z
          .object({
            organizationId: z.string(),
            name: z.string().min(3).max(100),
            locality: z.string().min(2).max(100),
            address: z.string().min(5).max(400),
          })
          .parse(raw);
        await requireOrganization(user, input.organizationId);
        result = await db.venue.create({ data: input });
        break;
      }
      case "area": {
        const input = z
          .object({
            venueId: z.string(),
            name: z.string().min(2).max(80),
            sport: z.enum(SPORTS),
          })
          .parse(raw);
        const venue = await db.venue.findUniqueOrThrow({
          where: { id: input.venueId },
        });
        await requireOrganization(user, venue.organizationId);
        result = await db.playingArea.create({ data: input });
        break;
      }
      case "slot": {
        const input = z
          .object({
            areaId: z.string(),
            startsAt: z.coerce.date(),
            pricePaise: z.coerce.number().int().min(100).max(10000000),
          })
          .parse(raw);
        const area = await db.playingArea.findUniqueOrThrow({
          where: { id: input.areaId },
          include: { venue: true },
        });
        await requireOrganization(user, area.venue.organizationId);
        if (input.startsAt <= new Date())
          throw new AppError(400, "Choose a future slot.");
        result = await db.slot.create({
          data: { ...input, endsAt: new Date(+input.startsAt + 3600000) },
        });
        break;
      }
      case "closure":
      case "offline": {
        const slot = await db.slot.findUniqueOrThrow({
          where: { id: z.string().parse(id) },
          include: { area: { include: { venue: true } } },
        });
        await requireOrganization(user, slot.area.venue.organizationId);
        await serial(async (tx) => {
          const s = await tx.slot.findUniqueOrThrow({
            where: { id: slot.id },
            include: { booking: true },
          });
          if (s.booking || s.startsAt <= new Date())
            throw new AppError(409, "Slot already reserved or in the past.");
          if (action === "closure")
            await tx.slot.update({
              where: { id: s.id },
              data: { blocked: z.boolean().parse(raw.blocked) },
            });
          else {
            if (s.blocked) throw new AppError(409, "Slot is closed.");
            await tx.booking.create({
              data: {
                slotId: s.id,
                source: "OFFLINE",
                status: "CONFIRMED",
                note: z.string().max(200).parse(raw.note),
              },
            });
          }
          await audit(tx, user.id, action.toUpperCase(), s.id);
        });
        break;
      }
      case "staff": {
        const input = z
          .object({ organizationId: z.string(), email: z.email() })
          .parse(raw);
        const member = await db.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: input.organizationId,
            },
          },
        });
        if (member?.role !== "OWNER")
          throw new AppError(403, "Only organization owners manage staff.");
        const target = await db.user.findUnique({
          where: { email: input.email },
        });
        if (!target || !target.emailVerified)
          throw new AppError(404, "A verified account is required.");
        await db.membership.upsert({
          where: {
            userId_organizationId: {
              userId: target.id,
              organizationId: input.organizationId,
            },
          },
          create: {
            userId: target.id,
            organizationId: input.organizationId,
            role: "STAFF",
          },
          update: {},
        });
        break;
      }
      case "transfer":
        await admin(user);
        result = await transferCompletedPayment(z.string().parse(id));
        break;
      case "approve-organization":
        await admin(user);
        await db.organization.update({
          where: { id: z.string().parse(id) },
          data: { status: "APPROVED" },
        });
        break;
      case "approve-venue":
        await admin(user);
        await db.venue.update({
          where: { id: z.string().parse(id) },
          data: { approved: true, published: true },
        });
        break;
      case "suspend":
        await admin(user);
        if (id === user.id) throw new AppError(400, "Cannot suspend yourself.");
        await db.user.update({
          where: { id: z.string().parse(id) },
          data: { suspended: z.boolean().parse(raw.suspended) },
        });
        await db.session.deleteMany({ where: { userId: id } });
        break;
      default:
        throw new AppError(400, "Unknown action.");
    }
    await audit(db, user.id, "ACTION_" + action.toUpperCase(), id || user.id);
    return Response.json(result);
  } catch (e) {
    const status =
      e instanceof AppError
        ? e.status
        : e instanceof z.ZodError
          ? 400
          : e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002"
            ? 409
            : 500;
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : e instanceof z.ZodError
              ? "Please check the form fields."
              : e instanceof Error && e.message === "PAYMENTS_NOT_CONFIGURED"
                ? "Test payments are not configured. Add Razorpay test credentials on the server."
                : status === 409
                  ? "This resource has already been reserved."
                  : "Action could not be completed. Please retry.",
      },
      { status },
    );
  }
}
