import { expect, test, vi } from "vitest";
vi.mock("../src/server/auth", () => ({ auth: {} }));
vi.mock("../src/server/db", () => ({ db: {} }));
import { admin, reportScope } from "../src/server/access";
import { portalDestination } from "../src/lib/login-portals";
import { DEMO_ORGANIZATION, isDemoAdministrator } from "../src/lib/demo-access";
const demo = {
  id: "hosted-demo-20261015-admin",
  role: "ADMIN",
  twoFactorEnabled: false,
};
test("demo administrator can view only its demo organization without MFA", async () => {
  expect(await reportScope(demo)).toEqual([DEMO_ORGANIZATION]);
  expect(portalDestination("admin", demo, false)).toBe("/app/admin");
  await expect(admin(demo)).rejects.toThrow();
});
test("other administrators still require MFA and similarly named accounts do not qualify", async () => {
  const real = { ...demo, id: "real-admin" };
  await expect(reportScope(real)).rejects.toThrow();
  expect(portalDestination("admin", real, false)).toBe("/app/settings");
  expect(isDemoAdministrator({ ...demo, role: "PLAYER" })).toBe(false);
  expect(isDemoAdministrator({ ...demo, id: demo.id + "-fake" })).toBe(false);
});
