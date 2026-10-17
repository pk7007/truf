export type WalletDirection = "CREDIT" | "DEBIT";

const DEBIT_TYPES = new Set(["BOOKING", "WITHDRAWAL_HOLD"]);

export function walletDirection(type: string): WalletDirection {
  return DEBIT_TYPES.has(type) ? "DEBIT" : "CREDIT";
}

export function walletTypeLabel(type: string) {
  const labels: Record<string, string> = {
    TOP_UP: "Money added",
    BOOKING: "Match payment",
    REFUND: "Refund",
    SETTLEMENT: "Venue earnings",
    WITHDRAWAL_HOLD: "Withdrawal reserved",
    WITHDRAWAL_RELEASE: "Withdrawal returned",
    ADJUSTMENT: "Account adjustment",
  };
  return labels[type] || type.replaceAll("_", " ").toLowerCase();
}
