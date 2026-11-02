import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = "https://truf-red.vercel.app";
const { credentials } = JSON.parse(
  await readFile(".data/HOSTED-DEMO-ACCESS.json", "utf8"),
);
for (const { role, email, password } of credentials) {
  const login = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const headers = { Cookie: cookie, Origin: base };
  const get = async (path) => {
    const response = await fetch(base + path, { headers });
    assert.equal(response.status, 200, path);
    return response.json();
  };
  try {
    const report = await get(
      `/api/reports?view=${role}&from=2026-10-04&to=2026-11-02`,
    );
    assert.equal(report.demo, true);
    assert.ok(report.summary.walletBookingsPaise > 0);
    assert.ok(report.summary.walletRefundsPaise > 0);
    const cash = report.charts.find((c) => c.id === "wallet-cash");
    assert.equal(
      cash.rows.reduce((sum, row) => sum + Number(row.WalletBookings) * 100, 0),
      report.summary.walletBookingsPaise,
    );
    const payments = await get(
      `/api/data?view=payments${role === "player" ? "" : "&scope=" + role}&from=2026-10-04&to=2026-11-02`,
    );
    assert.ok(payments.some((p) => p.refunds.length));
    if (role === "admin") {
      const data = await get("/api/data?view=admin");
      assert.equal(data.organizations.length, 3);
      assert.equal(data.readOnly, true);
      const seed = data.audit.find(
        (a) => a.id === "hosted-demo-20261015-month-v2",
      );
      assert.ok(seed, "Seed audit marker missing");
      assert.equal(seed.details.historical, 60);
      assert.equal(seed.details.bookingDebitsPaise, 6240000);
      assert.equal(seed.details.refundsPaise, 860000);
      assert.equal(seed.details.settlementsPaise, 4960000);
      assert.equal(
        (
          await fetch(base + "/app/admin-bookings", {
            headers,
            redirect: "manual",
          })
        ).status,
        200,
      );
      const bookings = await get("/api/data?view=admin-bookings");
      assert.ok(
        bookings.matches.some((m) =>
          m.id.startsWith("hosted-demo-20261015-month-v2"),
        ),
      );
      console.log(
        "PASS: three demo organizations, seed audit, admin booking drill-down, and financial reconciliation.",
      );
    } else if (role === "owner") {
      const records = await get("/api/data?view=owner-bookings");
      assert.ok(
        records.matches.some(
          (m) =>
            m.status === "REQUESTED" &&
            m.id.startsWith("hosted-demo-20261015-month-v2"),
        ),
      );
      assert.ok(
        records.matches.every(
          (m) =>
            m.slot.area.venue.organizationId === "hosted-demo-20261015-org",
        ),
      );
    } else {
      const records = await get("/api/data?view=discover");
      assert.equal(
        records.matches.filter((m) =>
          m.id.startsWith("hosted-demo-20261015-month-v2"),
        ).length,
        9,
      );
      assert.ok(report.progress.games >= 10);
    }
    console.log(
      `PASS: ${role} monthly reports, wallet chart totals, and refund history.`,
    );
  } finally {
    await fetch(base + "/api/auth/sign-out", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
  }
}
