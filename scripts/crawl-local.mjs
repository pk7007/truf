import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.TRUF_URL || "http://localhost:3000";
const access = await readFile(".data/LOCAL-ACCESS.txt", "utf8").catch(() => "");
const password =
  process.env.SEED_PASSWORD || access.match(/Fixture password:\s*(\S+)/)?.[1];
assert.ok(password, "SEED_PASSWORD or .data/LOCAL-ACCESS.txt is required");

async function get(path, cookie = "", redirect = "follow") {
  return fetch(base + path, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect,
  });
}

async function login(email) {
  const response = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `${email} could not sign in`);
  return response.headers
    .getSetCookie()
    .map((item) => item.split(";")[0])
    .join("; ");
}

const publicRoutes = [
  "/",
  "/help",
  "/privacy",
  "/terms",
  "/credits",
  "/login",
  "/login/player",
  "/login/owner",
  "/login/admin",
  "/register",
  "/forgot-password",
  "/robots.txt",
  "/sitemap.xml",
];
for (const path of publicRoutes) {
  const response = await get(path);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
}
assert.equal(
  (await get("/page-that-does-not-exist", "", "manual")).status,
  404,
);
assert.ok(
  [307, 308].includes((await get("/app/discover", "", "manual")).status),
);

const player = await login("player@truf.local");
const owner = await login("owner@truf.local");
const playerRoutes = [
  "/app/discover",
  "/app/matches",
  "/app/progress",
  "/app/wallet",
  "/app/payments",
  "/app/notifications",
  "/app/settings",
];
const ownerRoutes = [
  ...playerRoutes,
  "/app/owner",
  "/app/owner-bookings",
  "/app/venues",
  "/app/payments?scope=owner",
];
for (const [label, cookie, routes] of [
  ["player", player, playerRoutes],
  ["owner", owner, ownerRoutes],
]) {
  for (const path of routes) {
    const response = await get(path, cookie);
    assert.equal(
      response.status,
      200,
      `${label} ${path} returned ${response.status}`,
    );
  }
}

const deniedOwner = await get("/app/owner", player, "manual");
assert.ok([307, 308].includes(deniedOwner.status));
assert.match(deniedOwner.headers.get("location") || "", /access-denied/);
const deniedAdmin = await get("/app/admin", player, "manual");
assert.ok([307, 308].includes(deniedAdmin.status));
assert.match(deniedAdmin.headers.get("location") || "", /access-denied/);

const hrefs = new Set();
for (const path of [
  "/",
  "/help",
  "/privacy",
  "/terms",
  "/credits",
  ...ownerRoutes,
]) {
  const html = await (
    await get(path, path.startsWith("/app/") ? owner : "")
  ).text();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].replaceAll("&amp;", "&");
    if (
      href.startsWith("/") &&
      !href.startsWith("//") &&
      !href.startsWith("/_next/")
    )
      hrefs.add(href);
  }
}
for (const href of hrefs) {
  const response = await get(href, owner);
  assert.ok(
    response.status < 400,
    `linked route ${href} returned ${response.status}`,
  );
}

console.log(
  `TRUF route crawl passed: ${publicRoutes.length + playerRoutes.length + ownerRoutes.length} role checks and ${hrefs.size} internal links.`,
);
