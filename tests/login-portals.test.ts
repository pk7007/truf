import { expect, test } from "vitest";
import { isPortal, portalDestination } from "../src/lib/login-portals";
const player = { role: "PLAYER", twoFactorEnabled: false };
test("a selected portal cannot grant owner or administrator access", () => {
  expect(portalDestination("admin", player, false)).toBeNull();
  expect(portalDestination("owner", player, false)).toBeNull();
  expect(portalDestination("owner", player, true)).toBe("/app/owner");
  expect(portalDestination("player", player, false)).toBe("/app/discover");
});
test("administrators must enroll MFA before reaching administration", () => {
  expect(
    portalDestination(
      "admin",
      { role: "ADMIN", twoFactorEnabled: false },
      false,
    ),
  ).toBe("/app/settings");
  expect(
    portalDestination(
      "admin",
      { role: "ADMIN", twoFactorEnabled: true },
      false,
    ),
  ).toBe("/app/admin");
});
test("default destinations use account permissions and portal names are constrained", () => {
  expect(portalDestination(undefined, player, true)).toBe("/app/owner");
  expect(portalDestination(undefined, player, false)).toBe("/app/discover");
  expect(isPortal("https://untrusted.example")).toBe(false);
  expect(isPortal("admin")).toBe(true);
});
