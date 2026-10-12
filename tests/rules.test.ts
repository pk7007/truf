import { describe, it, expect } from "vitest";
import { streak, istDay, validateCapacity, csv } from "../src/lib/rules";
import { verifySignature } from "../src/server/payments";
describe("pilot rules", () => {
  it("uses IST day across UTC boundaries", () =>
    expect(istDay(new Date("2026-09-27T20:00:00Z"))).toBe("2026-09-28"));
  it("keeps last week active until current week ends", () =>
    expect(
      streak(
        [new Date("2026-09-15"), new Date("2026-09-23")],
        new Date("2026-09-30"),
      ),
    ).toEqual({ current: 2, best: 2 }));
  it("counts duplicate games once per week", () =>
    expect(
      streak(
        [new Date("2026-09-29"), new Date("2026-09-30")],
        new Date("2026-09-30T20:00:00Z"),
      ),
    ).toEqual({ current: 1, best: 1 }));
  it("breaks a missed week", () =>
    expect(
      streak([new Date("2026-09-01")], new Date("2026-09-30")).current,
    ).toBe(0));
  it("rejects invalid teams and fractional paise", () => {
    expect(() => validateCapacity("Football", 3, 120000)).toThrow();
    expect(() => validateCapacity("Badminton", 6, 120000)).toThrow();
    expect(() => validateCapacity("Football", 12, 100000)).toThrow();
    expect(() => validateCapacity("Football", 12, 120000)).not.toThrow();
  });
  it("escapes CSV formula injection and quotes", () => {
    const output = csv([{ name: '=HYPERLINK("bad")', count: 0 }]);
    expect(output).toContain("'=HYPERLINK");
    expect(output).toContain('""bad""');
  });
  it("rejects forged webhook signatures", () =>
    expect(verifySignature("{}", "bad", "secret")).toBe(false));
});
