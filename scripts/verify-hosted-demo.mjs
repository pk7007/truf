import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = "https://truf-red.vercel.app";
const { credentials } = JSON.parse(await readFile(".data/HOSTED-DEMO-ACCESS.json", "utf8"));
for (const { role, email, password } of credentials) {
  const login = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), redirect: "manual",
  });
  assert.equal(login.status, 200, `${role} login failed`);
  const cookie = login.headers.getSetCookie().map((x) => x.split(";")[0]).join("; ");
  assert.ok(cookie, "Expected an authenticated session");
  try {
    const headers = { Cookie: cookie, Origin: base };
    const landing = await fetch(`${base}/auth/continue?portal=${role}`, { headers, redirect: "manual" });
    assert.equal(landing.status, 307);
    const expected = role === "admin" ? "/app/admin" : role === "owner" ? "/app/owner" : "/app/discover";
    assert.equal(new URL(landing.headers.get("location"), base).pathname, expected);
    const settings = await fetch(base + "/api/data?view=settings", { headers });
    assert.equal(settings.status, 200);
    const forbidden = await fetch(base + "/api/data?view=admin", { headers });
    assert.equal(forbidden.status, role === "admin" ? 200 : 403);
    if (role === "admin") {
      const records = await forbidden.json();
      assert.ok(records.organizations.every(o => o.id === "hosted-demo-20261015-org"));
      assert.equal(records.users.length, 0);
      const readOnly = await fetch(base + "/api/actions", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "invalid-readonly-probe" }) });
      assert.equal(readOnly.status, 403);
      assert.match((await readOnly.json()).error, /read-only/);
      const dashboard = await fetch(base + "/api/reports?view=admin", { headers });
      assert.equal(dashboard.status, 200);
      assert.ok((await dashboard.json()).venues.every(v => v.id.startsWith("hosted-demo-20261015-month-v1")));
    }
    const report = await fetch(base + "/api/reports?view=owner", { headers });
    assert.equal(report.status, role === "player" ? 403 : 200);
    if (process.env.VERIFY_DEMO_MONTH === "1" && role !== "admin") {
      const history = await fetch(`${base}/api/reports?view=${role}&from=2026-09-16&to=2026-10-15`, { headers });
      assert.equal(history.status, 200);
      const data = await history.json();
      assert.equal(data.demo, true);
      assert.equal(data.summary.bookings, 15);
      assert.equal(data.summary.capturedPaise, 0);
      if (role === "player") {
        assert.equal(data.progress.games, 15);
        assert.equal(data.progress.points, 1500);
        assert.equal(data.progress.history.length, 15);
      }
      console.log(`PASS: ${role} month history, 15 games, zero fabricated collections.`);
    }
    console.log(`PASS: ${role} hosted login, correct destination and access boundaries.`);
  } finally {
    await fetch(base + "/api/auth/sign-out", { method: "POST", headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" }, body: "{}" });
  }
}
