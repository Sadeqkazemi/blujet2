-- CreateEnum
CREATE TYPE "CustomerReferralStatus" AS ENUM ('SIGNED_UP', 'BOOKED', 'REWARDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;

-- CreateTable
CREATE TABLE "customer_referrals" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" "CustomerReferralStatus" NOT NULL DEFAULT 'SIGNED_UP',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "firstBookingId" TEXT,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "customer_referrals_referredUserId_key" ON "customer_referrals"("referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_referrals_firstBookingId_key" ON "customer_referrals"("firstBookingId");

-- CreateIndex
CREATE INDEX "customer_referrals_referrerUserId_createdAt_idx" ON "customer_referrals"("referrerUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_referrals" ADD CONSTRAINT "customer_referrals_firstBookingId_fkey" FOREIGN KEY ("firstBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
