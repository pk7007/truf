import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ matches: vi.fn(), slots: vi.fn() }));
vi.mock("../src/server/db", () => ({
  db: { match: { findMany: mocks.matches }, slot: { findMany: mocks.slots } },
}));
vi.mock("../src/server/access", () => ({
  currentUser: async () => ({ id: "player", role: "PLAYER" }),
  reportScope: async () => ["owner-org"],
  admin: vi.fn(),
  AppError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("../src/server/booking", () => ({ canReadMatch: vi.fn() }));
import { GET } from "../src/app/api/data/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.matches.mockResolvedValue([]);
  mocks.slots.mockResolvedValue([]);
});
test("attendance drill-down filters completed games by IST date, not their titles", async () => {
  const response = await GET(
    new Request(
      "https://truf.example/api/data?view=owner-bookings&basis=attendance&date=2026-10-14&from=2026-10-01&to=2026-10-31",
    ),
  );
  expect(response.status).toBe(200);
  const where = mocks.matches.mock.calls[0][0].where;
  expect(where.title).toBeUndefined();
  expect(where.status).toBe("COMPLETED");
  expect(where.slot.startsAt.gte.toISOString()).toBe(
    "2026-10-13T18:30:00.000Z",
  );
  expect(where.slot.startsAt.lt.toISOString()).toBe("2026-10-14T18:30:00.000Z");
  expect(where.slot.area.venue.organizationId).toEqual({ in: ["owner-org"] });
});
test("discovery retains its future boundary when a date is selected", async () => {
  const before = Date.now();
  const response = await GET(
    new Request("https://truf.example/api/data?view=discover&date=2026-10-14"),
  );
  expect(response.status).toBe(200);
  const where = mocks.matches.mock.calls[0][0].where;
  expect(+where.slot.startsAt.gt).toBeGreaterThanOrEqual(before);
  expect(where.slot.startsAt.gte.toISOString()).toBe(
    "2026-10-13T18:30:00.000Z",
  );
  expect(where.visibility).toBe("PUBLIC");
  expect(
    +mocks.slots.mock.calls[0][0].where.startsAt.gt,
  ).toBeGreaterThanOrEqual(before + 3600000);
});
test("invalid date filters return 400 before querying records", async () => {
  const response = await GET(
    new Request("https://truf.example/api/data?view=discover&date=2026-02-30"),
  );
  expect(response.status).toBe(400);
  expect(mocks.matches).not.toHaveBeenCalled();
});
