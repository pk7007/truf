import { expect, it } from "vitest";
import { reportRange } from "../src/lib/report-range";
it("clips weekly drill-down to selected dates in IST", () => {
  const range = reportRange(
    new URLSearchParams(
      "interval=week&date=2026-09-28&from=2026-10-01&to=2026-10-31",
    ),
  );
  expect(range?.gte.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  expect(range?.lt.toISOString()).toBe("2026-10-04T18:30:00.000Z");
});
it("uses the whole month across a year boundary", () => {
  const range = reportRange(
    new URLSearchParams("interval=month&date=2026-12-01"),
  );
  expect(range?.lt.toISOString()).toBe("2026-12-31T18:30:00.000Z");
});
it("rejects impossible and reversed dates", () => {
  expect(() =>
    reportRange(new URLSearchParams("from=2026-02-30&to=2026-03-01")),
  ).toThrow();
  expect(() =>
    reportRange(new URLSearchParams("from=2026-10-05&to=2026-10-01")),
  ).toThrow();
});
