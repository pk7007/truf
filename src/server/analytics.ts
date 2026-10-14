import { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { ownerScope, AppError } from "./access";
import { istDay, streak, weekStart } from "@/lib/rules";
import { localMode } from "./local-mode";
export type ChartData = {
  id: string;
  title: string;
  kind: "line" | "bar" | "stacked" | "horizontal" | "heatmap";
  basis: string;
  series: string[];
  rows: Record<string, string | number>[];
  href: string;
};
export async function analytics(user: User, params: URLSearchParams) {
  const view = params.get("view") || "player",
    isPlayer = view === "player";
  if (!["player", "owner", "admin"].includes(view))
    throw new AppError(400, "Invalid report view.");
  const orgs = isPlayer ? [] : await ownerScope(user);
  const interval = params.get("interval") || "day";
  if (!["day", "week", "month"].includes(interval))
    throw new AppError(400, "Invalid reporting interval.");
  if (view === "admin" && user.role !== "ADMIN")
    throw new AppError(403, "Administrator access required.");
  const today = istDay(new Date()),
    from = params.get("from") || istDay(new Date(Date.now() - 29 * 86400000)),
    to = params.get("to") || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    throw new AppError(400, "Invalid report dates.");
  const start = new Date(from + "T00:00:00+05:30"),
    end = new Date(new Date(to + "T00:00:00+05:30").getTime() + 86400000);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    istDay(start) !== from ||
    istDay(new Date(+end - 86400000)) !== to ||
    end <= start ||
    +end - +start > 366 * 86400000
  )
    throw new AppError(400, "Select a range of 1–366 days.");
  const venueId = params.get("venue") || undefined,
    sport = params.get("sport") || undefined;
  const venueFilter: Prisma.VenueWhereInput = {
    ...(orgs ? { organizationId: { in: orgs } } : {}),
    ...(venueId ? { id: venueId } : {}),
  };
  const venues = isPlayer
    ? []
    : await db.venue.findMany({
        where: orgs ? { organizationId: { in: orgs } } : {},
        select: { id: true, name: true },
      });
  if (venueId && !isPlayer && !venues.some((v) => v.id === venueId))
    throw new AppError(404, "Venue not found.");
  const scope: Prisma.MatchWhereInput = isPlayer
    ? {
        participations: { some: { userId: user.id } },
        ...(sport ? { slot: { area: { sport } } } : {}),
      }
    : { slot: { area: { venue: venueFilter, ...(sport ? { sport } : {}) } } };
  const matches = await db.match.findMany({
    where: scope,
    include: {
      slot: { include: { area: { include: { venue: true } } } },
      participations: { include: { attendance: true } },
      events: true,
    },
  });
  const matchIds = matches.map((m) => m.id);
  const payments = await db.payment.findMany({
    where: {
      order: {
        participation: {
          matchId: { in: matchIds },
          ...(isPlayer ? { userId: user.id } : {}),
        },
      },
    },
    include: { refunds: true, transfer: true },
  });
  const inRange = (d: Date) => d >= start && d < end;
  const buckets: Record<string, Record<string, string | number>> = {};
  for (let at = +start; at < +end; at += 86400000) {
    const day = istDay(new Date(at));
    buckets[day] = {
      date: day,
      Created: 0,
      Confirmed: 0,
      Captured: 0,
      Refunded: 0,
      Registered: 0,
      Attended: 0,
      Minutes: 0,
    };
  }
  for (const m of matches) {
    if (inRange(m.createdAt))
      buckets[istDay(m.createdAt)].Created =
        Number(buckets[istDay(m.createdAt)].Created) + 1;
    if (m.confirmedAt && inRange(m.confirmedAt))
      buckets[istDay(m.confirmedAt)].Confirmed =
        Number(buckets[istDay(m.confirmedAt)].Confirmed) + 1;
  }
  for (const p of payments) {
    if (inRange(p.capturedAt))
      buckets[istDay(p.capturedAt)].Captured =
        Number(buckets[istDay(p.capturedAt)].Captured) + p.amountPaise / 100;
    for (const r of p.refunds)
      if (r.completedAt && inRange(r.completedAt))
        buckets[istDay(r.completedAt)].Refunded =
          Number(buckets[istDay(r.completedAt)].Refunded) + r.amountPaise / 100;
  }
  const played = matches.flatMap((m) =>
    m.participations
      .filter(
        (p) =>
          (!isPlayer || p.userId === user.id) &&
          p.attendance?.status === "ATTENDED",
      )
      .map((p) => ({
        userId: p.userId,
        date: m.slot.startsAt,
        minutes: (+m.slot.endsAt - +m.slot.startsAt) / 60000,
        sport: m.slot.area.sport,
        title: m.title,
        matchId: m.id,
      })),
  );
  for (const p of played.filter((p) => inRange(p.date))) {
    const b = buckets[istDay(p.date)];
    b.Attended = Number(b.Attended) + 1;
    b.Minutes = Number(b.Minutes) + p.minutes;
  }
  const chart = (
    id: string,
    title: string,
    kind: ChartData["kind"],
    basis: string,
    series: string[],
    rows: ChartData["rows"],
    href = isPlayer ? "/app/matches" : "/app/owner-bookings",
  ): ChartData => ({
    id,
    title,
    kind,
    basis,
    series,
    rows:
      interval !== "day" &&
      ["bookings", "cash", "growth", "status"].includes(id)
        ? Object.values(
            rows.reduce<Record<string, Record<string, string | number>>>(
              (acc, row) => {
                const label =
                  interval === "week"
                    ? new Date(weekStart(String(row.date)))
                        .toISOString()
                        .slice(0, 10)
                    : String(row.date).slice(0, 7) + "-01";
                acc[label] ??= { date: label };
                for (const key of series)
                  acc[label][key] =
                    Number(acc[label][key] || 0) + Number(row[key] || 0);
                return acc;
              },
              {},
            ),
          )
        : rows,
    href:
      href +
      (href.includes("?") ? "&" : "?") +
      "basis=" +
      id +
      "&interval=" +
      interval +
      "&from=" +
      from +
      "&to=" +
      to +
      (venueId ? "&venue=" + encodeURIComponent(venueId) : "") +
      (sport ? "&sport=" + encodeURIComponent(sport) : ""),
  });
  const daily = Object.values(buckets),
    scheduled = matches.filter((m) => inRange(m.slot.startsAt));
  const charts: ChartData[] = [];
  if (isPlayer) {
    charts.push(
      chart(
        "activity",
        "Playing days",
        "heatmap",
        "Attended game date · IST",
        ["Attended"],
        daily,
      ),
      chart(
        "time",
        "Weekly playing time",
        "bar",
        "Attended game date · Monday–Sunday IST · minutes",
        ["Minutes"],
        Object.values(
          daily.reduce<Record<string, { date: string; Minutes: number }>>(
            (weeks, row) => {
              const week = new Date(weekStart(String(row.date)))
                .toISOString()
                .slice(0, 10);
              weeks[week] ??= { date: week, Minutes: 0 };
              weeks[week].Minutes += Number(row.Minutes);
              return weeks;
            },
            {},
          ),
        ),
      ),
      chart(
        "sports",
        "Games by sport",
        "horizontal",
        "Attended game date",
        ["Games"],
        ["Football", "Cricket", "Badminton"].map((s) => ({
          date: s,
          Games: played.filter((p) => p.sport === s && inRange(p.date)).length,
        })),
      ),
    );
  } else {
    charts.push(
      chart(
        "bookings",
        "Booking trend",
        "line",
        "Creation and confirmation date · IST",
        ["Created", "Confirmed"],
        daily,
      ),
      chart(
        "cash",
        "Collections and refunds",
        "bar",
        "Capture and completed-refund date · INR",
        ["Captured", "Refunded"],
        daily,
        "/app/payments?scope=" + view,
      ),
    );
    if (view === "admin") {
      const statuses = [
        "REQUESTED",
        "RECRUITING",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ];
      charts.push(
        chart(
          "status",
          "Booking status",
          "stacked",
          "Current status, grouped by scheduled game date",
          statuses,
          Object.keys(buckets).map((date) => ({
            date,
            ...Object.fromEntries(
              statuses.map((status) => [
                status,
                scheduled.filter(
                  (m) =>
                    istDay(m.slot.startsAt) === date && m.status === status,
                ).length,
              ]),
            ),
          })),
        ),
      );
      charts.push(
        chart(
          "venues",
          "Venue performance",
          "horizontal",
          "Scheduled game date · confirmed/completed",
          ["Bookings"],
          venues.map((v) => ({
            date: v.name,
            Bookings: scheduled.filter(
              (m) =>
                m.slot.area.venueId === v.id &&
                ["CONFIRMED", "COMPLETED"].includes(m.status),
            ).length,
          })),
        ),
      );
      const users = await db.user.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { createdAt: true },
      });
      for (const u of users)
        buckets[istDay(u.createdAt)].Registered =
          Number(buckets[istDay(u.createdAt)].Registered) + 1;
      for (const day of Object.keys(buckets))
        buckets[day].Attended = new Set(
          played.filter((p) => istDay(p.date) === day).map((p) => p.userId),
        ).size;
      charts.push(
        chart(
          "growth",
          "Player growth and activity",
          "line",
          "Global registration date; filtered distinct attendees per game day",
          ["Registered", "Attended"],
          Object.values(buckets),
        ),
      );
    } else {
      const slots = await db.slot.findMany({
        where: {
          startsAt: { gte: start, lt: end },
          blocked: false,
          area: { venue: venueFilter, ...(sport ? { sport } : {}) },
        },
        include: { booking: true },
      });
      const cells: Record<
        string,
        { date: string; Booked: number; Published: number; Utilization: number }
      > = {};
      for (const s of slots) {
        const local = new Date(+s.startsAt + 19800000),
          name =
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              local.getUTCDay()
            ] +
            " " +
            String(local.getUTCHours()).padStart(2, "0") +
            ":00";
        const cell = (cells[name] ??= {
          date: name,
          Booked: 0,
          Published: 0,
          Utilization: 0,
        });
        const minutes = (+s.endsAt - +s.startsAt) / 60000;
        cell.Published += minutes;
        if (s.booking && ["CONFIRMED", "COMPLETED"].includes(s.booking.status))
          cell.Booked += minutes;
        cell.Utilization = Math.round((cell.Booked / cell.Published) * 100);
      }
      const hours = [
        ...new Set(Object.keys(cells).map((k) => k.split(" ")[1])),
      ].sort();
      const heatRows = hours.flatMap((hour) =>
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
          (day) =>
            cells[day + " " + hour] || {
              date: day + " " + hour,
              Booked: 0,
              Published: 0,
              Utilization: "N/A",
            },
        ),
      );
      charts.push(
        chart(
          "utilization",
          "Slot utilization",
          "heatmap",
          "Confirmed/completed minutes ÷ published minutes; closures excluded",
          ["Utilization"],
          heatRows,
        ),
        chart(
          "demand",
          "Sport demand",
          "horizontal",
          "Scheduled game date · confirmed/completed",
          ["Bookings"],
          ["Football", "Cricket", "Badminton"].map((s) => ({
            date: s,
            Bookings: scheduled.filter(
              (m) =>
                m.slot.area.sport === s &&
                ["CONFIRMED", "COMPLETED"].includes(m.status),
            ).length,
          })),
        ),
        chart(
          "attendance",
          "Attendance",
          "stacked",
          "Completed game date; unmarked is unknown",
          ["Attended", "NoShow", "Unmarked"],
          Object.values(
            scheduled
              .filter((m) => m.status === "COMPLETED")
              .map((m) => ({
                date: istDay(m.slot.startsAt),
                Attended: m.participations.filter(
                  (p) =>
                    p.status === "PAID" && p.attendance?.status === "ATTENDED",
                ).length,
                NoShow: m.participations.filter(
                  (p) =>
                    p.status === "PAID" && p.attendance?.status === "NO_SHOW",
                ).length,
                Unmarked: m.participations.filter(
                  (p) => p.status === "PAID" && !p.attendance,
                ).length,
              }))
              .reduce<
                Record<
                  string,
                  {
                    date: string;
                    Attended: number;
                    NoShow: number;
                    Unmarked: number;
                  }
                >
              >((days, row) => {
                const day = (days[row.date] ??= {
                  date: row.date,
                  Attended: 0,
                  NoShow: 0,
                  Unmarked: 0,
                });
                day.Attended += row.Attended;
                day.NoShow += row.NoShow;
                day.Unmarked += row.Unmarked;
                return days;
              }, {}),
          ).sort((a, b) => a.date.localeCompare(b.date)),
        ),
      );
    }
  }
  const captured = payments
      .filter((p) => inRange(p.capturedAt))
      .reduce((n, p) => n + p.amountPaise, 0),
    refunded = payments
      .flatMap((p) => p.refunds)
      .filter((r) => r.completedAt && inRange(r.completedAt))
      .reduce((n, r) => n + r.amountPaise, 0);
  const claims = isPlayer
    ? await db.rewardClaim.findMany({ where: { userId: user.id } })
    : [];
  const allAttendance = isPlayer
    ? await db.attendance.findMany({
        where: { status: "ATTENDED", participation: { userId: user.id } },
        include: {
          participation: { include: { match: { include: { slot: true } } } },
        },
      })
    : [];
  return {
    view,
    from,
    to,
    generatedAt: new Date().toISOString(),
    venues,
    charts,
    demo: localMode(),
    summary: {
      bookings: scheduled.length,
      capturedPaise: captured,
      refundedPaise: refunded,
      netPaise: captured - refunded,
      providerFeesPaise: payments
        .filter((p) => inRange(p.capturedAt))
        .reduce((n, p) => n + p.feePaise, 0),
      platformFeesPaise: 0,
      settledPaise: payments
        .filter((p) => p.transfer?.settledAt && inRange(p.transfer.settledAt))
        .reduce((n, p) => n + p.transfer!.amountPaise, 0),
    },
    progress: isPlayer
      ? {
          games: allAttendance.length,
          points: allAttendance.reduce((sum, a) => sum + a.points, 0),
          ...streak(
            allAttendance.map((a) => a.participation.match.slot.startsAt),
          ),
          history: played,
          claims: claims.map((c) => c.badge),
        }
      : null,
  };
}
