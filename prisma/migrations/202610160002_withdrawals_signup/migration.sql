ALTER TABLE "User" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'PLAYER';
ALTER TABLE "User" ADD CONSTRAINT "User_accountType_valid" CHECK ("accountType" IN ('PLAYER', 'OWNER'));

CREATE TABLE "WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalletWithdrawal_userId_createdAt_idx" ON "WalletWithdrawal"("userId", "createdAt");
CREATE INDEX "WalletWithdrawal_status_createdAt_idx" ON "WalletWithdrawal"("status", "createdAt");
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_amount_positive" CHECK ("amountPaise" > 0);
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_method_valid" CHECK ("payoutMethod" IN ('BANK', 'UPI'));
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_status_valid" CHECK ("status" IN ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PROCESSING', 'PAID', 'FAILED'));

UPDATE "User" SET "accountType" = 'OWNER' WHERE "id" = 'hosted-demo-20261015-owner';

UPDATE "Wallet" SET "balancePaise" = "balancePaise" + 800000 WHERE "userId" = 'hosted-demo-20261015-owner';
INSERT INTO "WalletEntry" ("id", "walletId", "type", "amountPaise", "balanceAfterPaise", "status", "referenceType", "referenceId", "description", "idempotencyKey", "createdAt")
SELECT 'hosted-demo-owner-settlement', "id", 'SETTLEMENT', 800000, "balancePaise", 'POSTED', 'MATCH', 'hosted-demo-settlement', 'Completed venue bookings · fictional settlement', 'demo-settlement:hosted-demo-20261015-owner', CURRENT_TIMESTAMP - INTERVAL '2 days'
FROM "Wallet" WHERE "userId" = 'hosted-demo-20261015-owner'
ON CONFLICT ("idempotencyKey") DO NOTHING;
