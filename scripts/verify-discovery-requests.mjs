import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.VERIFY_BASE_URL || "https://truf-red.vercel.app";
const { credentials } = JSON.parse(
  await readFile(".data/HOSTED-DEMO-ACCESS.json", "utf8"),
);
let requests;
for (const role of ["player", "owner"]) {
  const { email, password } = credentials.find(
    (account) => account.role === role,
  );
  const login = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200, `${role} login`);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const headers = { Cookie: cookie, Origin: base };
  try {
    const response = await fetch(
      `${base}/api/data?view=${role === "player" ? "discover" : "owner-bookings"}`,
      { headers },
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    if (role === "player") {
      requests = data.matches.filter(
        (match) =>
          match.id.startsWith("demo-discovery-nov-") &&
          match.status === "REQUESTED" &&
          new Date(match.slot.startsAt) > new Date(),
      );
      assert.ok(
        requests.length > 0,
        "Discover must show upcoming demo requests",
      );
      assert.ok(
        data.slots.some(
          (slot) =>
            slot.id.startsWith("demo-discovery-nov-") &&
            !slot.booking &&
            new Date(slot.startsAt).getTime() > Date.now() + 3600000,
        ),
        "Discover must offer a demo slot for creating a request",
      );
      console.log(
        `PASS: Discover has ${requests.length} upcoming demo requests and requestable demo availability.`,
      );
    } else {
      for (const request of requests) {
        assert.ok(
          data.matches.some(
            (match) => match.id === request.id && match.status === "REQUESTED",
          ),
          "Discover requests must be visible to their venue owner",
        );
      }
      const page = await fetch(`${base}/app/owner-bookings`, {
        headers,
        redirect: "manual",
      });
      assert.equal(
        page.status,
        200,
        "Owner match requests page must be accessible",
      );
      console.log(
        `PASS: Owner portal exposes the same ${requests.length} requests and its request page loads.`,
      );
    }
  } finally {
    await fetch(`${base}/api/auth/sign-out`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
  }
}
