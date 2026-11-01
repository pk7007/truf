import { reportRange } from "@/lib/report-range";
import { Prisma } from "@prisma/client";
import { currentUser, reportScope, admin, AppError } from "@/server/access";
import { DEMO_ORGANIZATION, isDemoAdministrator } from "@/lib/demo-access";
import { canReadMatch } from "@/server/booking";
import { db } from "@/server/db";
import { walletWithdrawalSummary } from "@/server/wallet";
import { walletDirection } from "@/lib/wallet";
export async function GET(request: Request) {
  try {
    const user = await currentUser(),
      q = new URL(request.url).searchParams,
      view = q.get("view") || "discover",
      id = q.get("id");
    const approvedOwner =
      user.role !== "ADMIN" &&
      (await db.membership.count({
        where: { userId: user.id, organization: { status: "APPROVED" } },
      })) > 0;
    if (
      !id &&
      ["discover", "matches"].includes(view) &&
      (approvedOwner || user.role === "ADMIN")
    )
      throw new AppError(
        403,
        "This page is available to player accounts only.",
      );
    if (["venues", "owner-bookings"].includes(view) && user.role === "ADMIN")
      throw new AppError(
        403,
        "Use the administrator workspace for venue oversight.",
      );
    if (id) {
      await canReadMatch(user, id, q.get("token") || undefined);
      const match = await db.match.findUniqueOrThrow({
        where: { id },
        include: {
          slot: { include: { area: { include: { venue: true } } } },
          participations: {
            select: {
              id: true,
              userId: true,
              status: true,
              attendance: true,
              user: { select: { name: true } },
            },
          },
          events: { orderBy: { at: "asc" } },
        },
      });
      return Response.json({
        ...match,
        invitationHash: undefined,
        myId: user.id,
        workspace:
          user.role === "ADMIN" ? "admin" : approvedOwner ? "owner" : "player",
        walletBalancePaise:
          (await db.wallet.findUnique({ where: { userId: user.id } }))
            ?.balancePaise || 0,
        canManage:
          (user.role === "ADMIN" && user.twoFactorEnabled) ||
          (await db.membership.count({
            where: {
              userId: user.id,
              organizationId: match.slot.area.venue.organizationId,
              organization: { status: "APPROVED" },
            },
          })) > 0,
      });
    }
    if (view === "wallet") {
      if (q.get("scope") === "admin") {
        if (!isDemoAdministrator(user)) await admin(user);
        const userWhere = isDemoAdministrator(user)
          ? { id: { startsWith: "hosted-demo-20261015-" } }
          : {};
        const wallets = await db.wallet.findMany({
          where: { user: userWhere },
          include: {
            user: { select: { name: true, email: true } },
            entries: { orderBy: { createdAt: "desc" }, take: 100 },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        });
        const entries = wallets.flatMap((wallet) =>
          wallet.entries.map((entry) => ({
            ...entry,
            direction: walletDirection(entry.type),
            userName: wallet.user.name,
            userEmail: wallet.user.email,
          })),
        );
        const withdrawals = await db.walletWithdrawal.findMany({
          where: { user: userWhere },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return Response.json({
          mode: "ADMIN",
          readOnly: isDemoAdministrator(user),
          currency: "INR",
          balancePaise: wallets.reduce(
            (sum, wallet) => sum + wallet.balancePaise,
            0,
          ),
          walletCount: wallets.length,
          creditsPaise: entries
            .filter((entry) => walletDirection(entry.type) === "CREDIT")
            .reduce((sum, entry) => sum + entry.amountPaise, 0),
          debitsPaise: entries
            .filter((entry) => walletDirection(entry.type) === "DEBIT")
            .reduce((sum, entry) => sum + entry.amountPaise, 0),
          entries: entries
            .sort((a, b) => +b.createdAt - +a.createdAt)
            .slice(0, 100),
          withdrawals,
          topUps: [],
          testMode: !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
            ? "UNAVAILABLE"
            : "TEST",
          generatedAt: new Date().toISOString(),
        });
      }
      const wallet = await db.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
        include: {
          entries: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
      const withdrawal = await walletWithdrawalSummary(user.id);
      return Response.json({
        id: wallet.id,
        currency: wallet.currency,
        balancePaise: wallet.balancePaise,
        entries: wallet.entries.map((entry) => ({
          ...entry,
          direction: walletDirection(entry.type),
        })),
        ...withdrawal,
        withdrawals: await db.walletWithdrawal.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        topUps: await db.walletTopUp.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        testMode: !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
          ? "UNAVAILABLE"
          : "TEST",
        generatedAt: new Date().toISOString(),
      });
    }
    if (view === "notifications")
      return Response.json(
        await db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    if (view === "settings")
      return Response.json({
        name: user.name,
        email: user.email,
        role: user.role,
        sports: user.sports,
        locality: user.locality,
        accountType: user.accountType,
        twoFactorEnabled: user.twoFactorEnabled,
        memberships: await db.membership.findMany({
          where: { userId: user.id },
          include: { organization: true },
        }),
      });
    if (view === "admin") {
      if (isDemoAdministrator(user))
        return Response.json({
          organizations: await db.organization.findMany({
            where: { id: DEMO_ORGANIZATION },
            include: {
              venues: true,
              memberships: {
                include: { user: { select: { name: true, email: true } } },
              },
            },
          }),
          jobs: [],
          audit: [],
          users: [],
        });
      await admin(user);
      return Response.json({
        organizations: await db.organization.findMany({
          include: {
            venues: true,
            memberships: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
          take: 100,
        }),
        jobs: await db.job.findMany({
          where: { status: { in: ["FAILED", "RUNNING"] } },
          take: 30,
        }),
        audit: await db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        users: await db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            suspended: true,
            role: true,
          },
          take: 100,
        }),
      });
    }
    const isOwner = view === "venues" || view === "owner-bookings",
      orgs = isOwner ? await reportScope(user) : null;
    if (view === "venues")
      return Response.json(
        await db.venue.findMany({
          where: orgs ? { organizationId: { in: orgs } } : {},
          include: {
            areas: {
              include: {
                slots: {
                  where: { startsAt: { gt: new Date() } },
                  include: { booking: true },
                  orderBy: { startsAt: "asc" },
                  take: 100,
                },
              },
            },
          },
        }),
      );
    if (view === "payments") {
      const scope = q.get("scope");
      if (user.role === "ADMIN" && scope !== "admin")
        throw new AppError(
          403,
          "Administrator payment history requires administrator scope.",
        );
      if (approvedOwner && scope !== "owner")
        throw new AppError(403, "Owner payment history requires owner scope.");
      const range = readRange(q);
      const ids =
        scope === "owner" || scope === "admin" ? await reportScope(user) : null;
      if (scope === "admin" && !isDemoAdministrator(user)) await admin(user);
      const payments = await db.payment.findMany({
        where: {
          ...(range
            ? {
                OR: [
                  { capturedAt: range },
                  { refunds: { some: { completedAt: range } } },
                ],
              }
            : {}),
          AND: [
            {
              order: {
                participation: {
                  match: {
                    slot: {
                      area: {
                        ...(q.get("sport") ? { sport: q.get("sport")! } : {}),
                        ...(q.get("venue") ? { venueId: q.get("venue")! } : {}),
                      },
                    },
                  },
                },
              },
            },
          ],
          order: {
            participation: ids
              ? {
                  match: {
                    slot: {
                      area: { venue: { organizationId: { in: ids } } },
                    },
                  },
                }
              : scope === "admin" || scope === "owner"
                ? {}
                : { userId: user.id },
          },
        },
        include: {
          refunds: true,
          transfer: true,
          order: {
            select: {
              participation: {
                select: { match: { select: { title: true, id: true } } },
              },
            },
          },
        },
        orderBy: { capturedAt: "desc" },
        take: 100,
      });
      if (payments.length || !user.id.startsWith("hosted-demo-20261015-"))
        return Response.json(
          payments.map((payment) => ({ ...payment, source: "Razorpay" })),
        );

      // Hosted presentation accounts use completed fictional matches instead
      // of provider records. This keeps payment history useful without
      // fabricating Razorpay collections in the financial tables.
      const demoMatches = await db.match.findMany({
        where: {
          status: "COMPLETED",
          ...(range ? { completedAt: range } : {}),
          ...(ids
            ? {
                slot: {
                  area: { venue: { organizationId: { in: ids } } },
                },
              }
            : {
                participations: { some: { userId: user.id, status: "PAID" } },
              }),
        },
        select: {
          id: true,
          title: true,
          sharePaise: true,
          completedAt: true,
          confirmedAt: true,
          slot: { select: { pricePaise: true } },
        },
        orderBy: { completedAt: "desc" },
        take: 30,
      });
      return Response.json(
        demoMatches.map((match) => ({
          id: `demo-history-${match.id}`,
          providerPaymentId: `fictional-${match.id}`,
          capturedAt:
            match.confirmedAt || match.completedAt || new Date().toISOString(),
          amountPaise: ids ? match.slot.pricePaise : match.sharePaise,
          feePaise: 0,
          refunds: [],
          transfer: null,
          source: "Demo wallet · fictional",
          order: {
            participation: { match: { id: match.id, title: match.title } },
          },
        })),
      );
    }
    const category = q.get("date"),
      basis = q.get("basis");
    const sport =
        q.get("sport") ||
        (basis === "demand" || basis === "sports" ? category : null),
      locality = q.get("locality"),
      day = category;
    const range = readRange(q);
    const slot: Prisma.SlotWhereInput = {
      ...(view === "discover" ? { startsAt: { gt: new Date() } } : {}),
      ...(day && /^\d{4}-\d{2}-\d{2}$/.test(day)
        ? {
            startsAt: {
              gte: new Date(day + "T00:00:00+05:30"),
              lt: new Date(+new Date(day + "T00:00:00+05:30") + 86400000),
            },
          }
        : {}),
      area: {
        ...(sport ? { sport } : {}),
        venue: {
          ...(orgs ? { organizationId: { in: orgs } } : {}),
          ...(q.get("venue") ? { id: q.get("venue")! } : {}),
          ...(locality
            ? { locality: { contains: locality, mode: "insensitive" } }
            : {}),
          ...(view === "discover"
            ? {
                approved: true,
                published: true,
                organization: { status: "APPROVED" },
              }
            : {}),
        },
      },
    };
    if (range) slot.startsAt = range;
    if (basis === "bookings") delete slot.startsAt;
    // Date/chart filters must never remove discovery's future-only boundary.
    if (view === "discover")
      slot.startsAt = {
        ...(typeof slot.startsAt === "object" ? slot.startsAt : {}),
        gt: new Date(),
      };
    const where: Prisma.MatchWhereInput = {
      slot,
      ...(basis === "bookings" && range
        ? { AND: [{ OR: [{ createdAt: range }, { confirmedAt: range }] }] }
        : {}),
      ...(basis === "attendance" ? { status: "COMPLETED" } : {}),
      ...(["demand", "venues", "utilization"].includes(basis || "")
        ? { status: { in: ["CONFIRMED", "COMPLETED"] } }
        : {}),
      ...(basis === "venues" && category
        ? {
            slot: {
              ...slot,
              area: {
                ...(slot.area as Prisma.PlayingAreaWhereInput),
                venue: {
                  ...(orgs ? { organizationId: { in: orgs } } : {}),
                  name: category,
                },
              },
            },
          }
        : {}),
      ...(view === "discover"
        ? {
            visibility: "PUBLIC",
            status: { in: ["REQUESTED", "RECRUITING", "CONFIRMED"] },
          }
        : isOwner
          ? {}
          : {
              OR: [
                { captainId: user.id },
                { participations: { some: { userId: user.id } } },
              ],
            }),
    };
    const matches = await db.match.findMany({
      where,
      include: {
        slot: { include: { area: { include: { venue: true } } } },
        _count: { select: { participations: { where: { status: "PAID" } } } },
      },
      orderBy: { slot: { startsAt: "asc" } },
      take: 100,
    });
    const slots =
      view === "discover"
        ? await db.slot.findMany({
            where: {
              ...slot,
              blocked: false,
              booking: null,
              startsAt: { gt: new Date(Date.now() + 3600000) },
              ...(range
                ? { startsAt: { ...range, gt: new Date(Date.now() + 3600000) } }
                : {}),
            },
            include: { area: { include: { venue: true } } },
            orderBy: { startsAt: "asc" },
            take: 100,
          })
        : [];
    return Response.json({
      matches: matches
        .filter((m) => {
          if (basis !== "utilization" || !category) return true;
          const d = new Date(+m.slot.startsAt + 19800000);
          return (
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] +
              " " +
              String(d.getUTCHours()).padStart(2, "0") +
              ":00" ===
            category
          );
        })
        .map((m) => ({ ...m, invitationHash: undefined })),
      slots,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError ? e.message : "Records could not be loaded.",
      },
      { status: e instanceof AppError ? e.status : 500 },
    );
  }
}

function readRange(q: URLSearchParams) {
  try {
    return reportRange(q);
  } catch (error) {
    throw new AppError(
      400,
      error instanceof Error ? error.message : "Invalid date range.",
    );
  }
}
