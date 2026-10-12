import "dotenv/config";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
const base = "http://localhost:3000";
async function request(
  path,
  { cookie = "", body, method = body ? "POST" : "GET", origin = base } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = {};
  }
  return {
    status: r.status,
    data,
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}
async function login(email, password = process.env.SEED_PASSWORD) {
  let r;
  for (let attempt = 0; attempt < 4; attempt++) {
    r = await request("/api/auth/sign-in/email", { body: { email, password } });
    if (r.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 12000));
  }
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.cookie);
  return r.cookie;
}
async function mailFor(email, subject) {
  const names = await readdir(".data/mail");
  for (const name of names.sort().reverse()) {
    const item = JSON.parse(await readFile(".data/mail/" + name, "utf8"));
    if (item.to === email && item.subject.includes(subject)) return item;
  }
  throw Error("Expected local email was not written");
}
assert.equal((await request("/api/health")).status, 200);
assert.equal((await request("/api/reports")).status, 401);
const player = await login("player@truf.local"),
  owner = await login("owner@truf.local"),
  other = await login("other@truf.local"),
  admin = await login("admin@truf.local");
assert.equal(
  (await request("/api/data?view=admin", { cookie: player })).status,
  403,
);
assert.ok([401, 403].includes((await request("/api/data?view=admin", { cookie: admin })).status), "MFA must gate admin");
assert.equal(
  (
    await request("/api/actions", {
      cookie: player,
      origin: "https://untrusted.example",
      body: { action: "profile", name: "changed", sports: [], locality: "" },
    })
  ).status,
  403,
);
const report = await request("/api/reports?view=owner", { cookie: owner });
assert.equal(report.status, 200);
assert.equal(report.data.venues.length, 1);
assert.equal(report.data.charts.length, 5);
const otherReport = await request(
  "/api/reports?view=owner&venue=" + report.data.venues[0].id,
  { cookie: other },
);
assert.equal(otherReport.status, 404);
const slots = (
  await request("/api/data?view=discover&sport=Badminton", { cookie: player })
).data.slots;
assert.ok(slots.length);
const created = await request("/api/actions", {
  cookie: player,
  body: {
    action: "match",
    slotId: slots[0].id,
    title: "Local verification match",
    capacity: 2,
    visibility: "PUBLIC",
  },
});
assert.equal(created.status, 200, JSON.stringify(created.data));
const approve = {
  action: "approve",
  id: created.data.id,
  deadline: new Date(Date.now() + 1800000).toISOString(),
};
assert.equal(
  (await request("/api/actions", { cookie: other, body: approve })).status,
  404,
);
assert.equal(
  (await request("/api/actions", { cookie: owner, body: approve })).status,
  200,
);
const detail = await request("/api/data?id=" + created.data.id, {
  cookie: player,
});
assert.equal(detail.data.status, "RECRUITING");
assert.equal(detail.data.invitationHash, undefined);
assert.equal(detail.data.canManage, false);
assert.equal((await request("/api/data?id=" + created.data.id, {cookie:owner})).data.canManage, true);

if (!process.env.RAZORPAY_KEY_ID) {
  const paid = await request("/api/actions", {
    cookie: player,
    body: { action: "checkout", id: created.data.id },
  });
  assert.notEqual(paid.status, 200);
  assert.match(paid.data.error, /not configured/);
}
assert.equal(
  (
    await request("/api/actions", {
      cookie: owner,
      body: { action: "cancel", id: created.data.id },
    })
  ).status,
  200,
);
assert.equal(
  (await request("/api/data?id=" + created.data.id, { cookie: player })).data
    .status,
  "CANCELLED",
);
const email = "local-smoke-" + Date.now() + "@example.test",
  password = "Local-check-" + Date.now() + "-only";
const signup = await request("/api/auth/sign-up/email", {
  body: { email, password, name: "Local email test" },
});
assert.equal(signup.status, 200, JSON.stringify(signup.data));
assert.notEqual(
  (await request("/api/auth/sign-in/email", { body: { email, password } }))
    .status,
  200,
);
const verification = await mailFor(email, "Verify"),
  url = new URL(verification.body.match(/https?:\/\/\S+/)[0]);
assert.equal(url.origin, base);
const verified = await fetch(url, { redirect: "manual" });
assert.ok([200, 302].includes(verified.status));
await login(email, password);
assert.equal(
  (
    await request("/api/auth/request-password-reset", {
      body: { email, redirectTo: base + "/reset-password" },
    })
  ).status,
  200,
);
const reset = await mailFor(email, "Reset"),
  resetURL = new URL(reset.body.match(/https?:\/\/\S+/)[0]);
assert.equal(resetURL.origin, base);
const redirect = await fetch(resetURL, { redirect: "manual" }),
  target = new URL(redirect.headers.get("location"), base),
  token = target.searchParams.get("token");
assert.ok(token);
const newPassword = password + "-reset";
assert.equal(
  (await request("/api/auth/reset-password", { body: { token, newPassword } }))
    .status,
  200,
);
await login(email, newPassword);
console.log(
  "PASS: local HTTP authentication, verification, password recovery, MFA gate, CSRF, owner isolation, booking approval/cancellation, reports and missing-payment-configuration checks.",
);
