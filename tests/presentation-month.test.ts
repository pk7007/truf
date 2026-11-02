import { describe, it, expect } from "vitest";
import { db } from "../src/server/db";
import { seedPresentationMonth } from "../scripts/demo-month-v2";
import { analytics } from "../src/server/analytics";
import { approveHold, walletCheckout, withdraw } from "../src/server/booking";
const suite = process.env.INTEGRATION_TEST === "1" ? describe : describe.skip;
suite("presentation month fixtures", () => {
  it("creates an idempotent month with reconciled wallets and scoped reports", async () => {
    const batch = "hosted-demo-20261015";
    for (const role of ["player", "owner", "admin"])
      await db.user.create({
        data: {
          id: `${batch}-${role}`,
          name: `Demo ${role}`,
          email: `${role}@presentation.truf.example`,
          role: role === "admin" ? "ADMIN" : "PLAYER",
        },
      });
    await db.organization.create({
      data: {
        id: `${batch}-org`,
        name: "Demo",
        status: "APPROVED",
        memberships: { create: { userId: `${batch}-owner`, role: "OWNER" } },
      },
    });
    const dry = await seedPresentationMonth(db);
    expect(dry.applied).toBe(false);
    expect(
      await db.match.count({
        where: { id: { startsWith: `${batch}-month-v2` } },
      }),
    ).toBe(0);
    const result = await seedPresentationMonth(db, "2026-11-02", true);
    expect(result.applied).toBe(true);
    const entryCount = await db.walletEntry.count();
    const again = await seedPresentationMonth(db, "2026-11-02", true);
    expect(again.applied).toBe(false);
    expect(await db.walletEntry.count()).toBe(entryCount);
    expect(
      await db.match.count({
        where: { id: { startsWith: `${batch}-month-v2` } },
      }),
    ).toBe(69);
    const wallets = await db.wallet.findMany({
      where: { userId: { startsWith: batch } },
      include: { entries: true },
    });
    for (const wallet of wallets)
      expect(wallet.balancePaise).toBe(
        wallet.entries.reduce(
          (sum, e) =>
            sum + (e.type === "BOOKING" ? -e.amountPaise : e.amountPaise),
          0,
        ),
      );
    const admin = await db.user.findUniqueOrThrow({
      where: { id: `${batch}-admin` },
    });
    const owner = await db.user.findUniqueOrThrow({
      where: { id: `${batch}-owner` },
    });
    const adminReport = await analytics(
      admin,
      new URLSearchParams("view=admin&from=2026-10-04&to=2026-11-02"),
    );
    const ownerReport = await analytics(
      owner,
      new URLSearchParams("view=owner&from=2026-10-04&to=2026-11-02"),
    );
    expect(adminReport.summary.bookings).toBe(60);
    expect(ownerReport.venues).toHaveLength(2);
    expect(adminReport.summary.capturedPaise).toBe(0);
    expect(adminReport.summary.walletBookingsPaise).toBeGreaterThan(
      ownerReport.summary.walletBookingsPaise,
    );
    const chart = adminReport.charts.find((c) => c.id === "wallet-cash")!;
    expect(
      chart.rows.reduce(
        (sum, row) => sum + Number(row.WalletBookings) * 100,
        0,
      ),
    ).toBe(adminReport.summary.walletBookingsPaise);
    expect(
      await db.job.count({ where: { key: { contains: "month-v2" } } }),
    ).toBe(0);
    const player = await db.user.findUniqueOrThrow({
      where: { id: `${batch}-player` },
    });
    const game = `${batch}-month-v2-match-60`;
    await expect(walletCheckout(player, game)).rejects.toThrow(
      "Joining is closed",
    );
    const start = (await db.slot.findUniqueOrThrow({ where: { id: game } }))
      .startsAt;
    await approveHold(owner, game, new Date(+start - 3600000));
    const before = await db.wallet.findUniqueOrThrow({
      where: { userId: player.id },
    });
    await walletCheckout(player, game);
    const after = await db.wallet.findUniqueOrThrow({
      where: { userId: player.id },
    });
    expect(after.balancePaise).toBe(before.balancePaise - 15000);
    await withdraw(player, game);
    expect(
      (await db.wallet.findUniqueOrThrow({ where: { userId: player.id } }))
        .balancePaise,
    ).toBe(before.balancePaise);
  }, 120000);
});
