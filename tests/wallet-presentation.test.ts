import { describe, expect, it } from "vitest";
import { walletDirection, walletTypeLabel } from "../src/lib/wallet";

describe("wallet presentation rules", () => {
  it("classifies every money movement with the correct direction", () => {
    expect(walletDirection("BOOKING")).toBe("DEBIT");
    expect(walletDirection("WITHDRAWAL_HOLD")).toBe("DEBIT");
    expect(walletDirection("TOP_UP")).toBe("CREDIT");
    expect(walletDirection("REFUND")).toBe("CREDIT");
    expect(walletDirection("SETTLEMENT")).toBe("CREDIT");
    expect(walletDirection("WITHDRAWAL_RELEASE")).toBe("CREDIT");
  });

  it("uses player-readable transaction labels", () => {
    expect(walletTypeLabel("BOOKING")).toBe("Match payment");
    expect(walletTypeLabel("WITHDRAWAL_HOLD")).toBe("Withdrawal reserved");
    expect(walletTypeLabel("UNKNOWN_EVENT")).toBe("unknown event");
  });
});
