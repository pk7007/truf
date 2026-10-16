CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balanceAfterPaise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "feePaise" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CREATING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "WalletEntry_idempotencyKey_key" ON "WalletEntry"("idempotencyKey");
CREATE INDEX "WalletEntry_walletId_createdAt_idx" ON "WalletEntry"("walletId", "createdAt");
CREATE INDEX "WalletEntry_referenceType_referenceId_idx" ON "WalletEntry"("referenceType", "referenceId");
CREATE UNIQUE INDEX "WalletTopUp_providerOrderId_key" ON "WalletTopUp"("providerOrderId");
CREATE UNIQUE INDEX "WalletTopUp_providerPaymentId_key" ON "WalletTopUp"("providerPaymentId");
CREATE INDEX "WalletTopUp_userId_createdAt_idx" ON "WalletTopUp"("userId", "createdAt");
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_nonnegative" CHECK ("balancePaise" >= 0);
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_amount_positive" CHECK ("amountPaise" > 0);
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_amount_positive" CHECK ("amountPaise" > 0);

INSERT INTO "Wallet" ("id", "userId", "currency", "balancePaise", "createdAt", "updatedAt")
SELECT 'hosted-demo-player-wallet', "id", 'INR', 500000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" WHERE "id" = 'hosted-demo-20261015-player'
ON CONFLICT ("userId") DO NOTHING;
INSERT INTO "WalletEntry" ("id", "walletId", "type", "amountPaise", "balanceAfterPaise", "status", "referenceType", "referenceId", "description", "idempotencyKey", "createdAt")
SELECT 'hosted-demo-player-wallet-opening', "id", 'TOP_UP', 500000, 500000, 'POSTED', 'DEMO', 'hosted-demo-20261015', 'Demo opening balance · fictional funds', 'demo-opening:hosted-demo-20261015-player', CURRENT_TIMESTAMP
FROM "Wallet" WHERE "userId" = 'hosted-demo-20261015-player'
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "Wallet" ("id", "userId", "currency", "balancePaise", "createdAt", "updatedAt")
SELECT 'hosted-demo-owner-wallet', "id", 'INR', 1250000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" WHERE "id" = 'hosted-demo-20261015-owner'
ON CONFLICT ("userId") DO NOTHING;
INSERT INTO "WalletEntry" ("id", "walletId", "type", "amountPaise", "balanceAfterPaise", "status", "referenceType", "referenceId", "description", "idempotencyKey", "createdAt")
SELECT 'hosted-demo-owner-wallet-opening', "id", 'TOP_UP', 1250000, 1250000, 'POSTED', 'DEMO', 'hosted-demo-20261015', 'Demo opening balance · fictional funds', 'demo-opening:hosted-demo-20261015-owner', CURRENT_TIMESTAMP
FROM "Wallet" WHERE "userId" = 'hosted-demo-20261015-owner'
ON CONFLICT ("idempotencyKey") DO NOTHING;
