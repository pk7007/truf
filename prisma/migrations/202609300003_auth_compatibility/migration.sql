ALTER TABLE "TwoFactor" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "RateLimit" ADD COLUMN "key" TEXT;
UPDATE "RateLimit" SET "key"=id;
ALTER TABLE "RateLimit" ALTER COLUMN "key" SET NOT NULL;
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
