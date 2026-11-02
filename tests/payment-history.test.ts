import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  reportScope: vi.fn(),
  admin: vi.fn(),
  membership: { count: vi.fn() },
  payment: { findMany: vi.fn() },
  participation: { findMany: vi.fn() },
  walletEntry: { findMany: vi.fn() },
}));
vi.mock("../src/server/access", () => ({
  ...mocks,
  AppError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("../src/server/db", () => ({ db: mocks }));
vi.mock("../src/server/booking", () => ({ canReadMatch: vi.fn() }));
vi.mock("../src/server/wallet", () => ({ walletWithdrawalSummary: vi.fn() }));
import { GET } from "../src/app/api/data/route";
const debit = (key: string, date: string, type = "BOOKING") => ({
  id: key,
  idempotencyKey: key,
  type,
  referenceId: "participation",
  amountPaise: 20000,
  createdAt: new Date(date),
  wallet: { userId: "player" },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "player", role: "PLAYER" });
  mocks.membership.count.mockResolvedValue(0);
  mocks.payment.findMany.mockResolvedValue([]);
  mocks.participation.findMany.mockResolvedValue([
    {
      id: "participation",
      userId: "player",
      match: { id: "game", title: "Game" },
    },
  ]);
  mocks.walletEntry.findMany.mockResolvedValue([
    debit("booking:participation", "2026-10-01T10:00:00Z"),
    debit("refund:participation", "2026-10-02T10:00:00Z", "REFUND"),
    debit("booking:participation:1", "2026-10-03T10:00:00Z"),
  ]);
});
it("shows separate booking cycles and attaches refunds only to their original debit", async () => {
  const response = await GET(
    new Request("http://localhost/api/data?view=payments"),
  );
  expect(response.status).toBe(200);
  const rows = await response.json();
  expect(rows).toHaveLength(2);
  expect(rows[0].refunds).toHaveLength(0);
  expect(rows[1].refunds[0].amountPaise).toBe(20000);
  expect(rows[0].source).toBe("TRUF Wallet");
  expect(mocks.participation.findMany.mock.calls[0][0].where.userId).toBe(
    "player",
  );
});
it("includes an earlier booking when its refund falls inside the requested IST dates", async () => {
  const response = await GET(
    new Request(
      "http://localhost/api/data?view=payments&from=2026-10-02&to=2026-10-02",
    ),
  );
  const rows = await response.json();
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe("booking:participation");
});
it("constrains owner wallet history to authorized organizations", async () => {
  mocks.membership.count.mockResolvedValue(1);
  mocks.reportScope.mockResolvedValue(["organization"]);
  const response = await GET(
    new Request("http://localhost/api/data?view=payments&scope=owner"),
  );
  expect(response.status).toBe(200);
  expect(
    mocks.participation.findMany.mock.calls[0][0].where.match.slot.area.venue
      .organizationId.in,
  ).toEqual(["organization"]);
});
it("rejects an owner attempting to use player history scope", async () => {
  mocks.membership.count.mockResolvedValue(1);
  const response = await GET(
    new Request("http://localhost/api/data?view=payments"),
  );
  expect(response.status).toBe(403);
  expect(mocks.walletEntry.findMany).not.toHaveBeenCalled();
});
it("does not display a ledger record belonging to a different participant", async () => {
  mocks.walletEntry.findMany.mockResolvedValue([
    {
      ...debit("booking:participation", "2026-10-01T10:00:00Z"),
      wallet: { userId: "someone-else" },
    },
  ]);
  const response = await GET(
    new Request("http://localhost/api/data?view=payments"),
  );
  expect(await response.json()).toEqual([]);
});
