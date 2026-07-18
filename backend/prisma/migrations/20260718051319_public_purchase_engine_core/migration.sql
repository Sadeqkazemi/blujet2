-- CreateEnum
CREATE TYPE "CabinClass" AS ENUM ('ECONOMY', 'BUSINESS');

-- AlterEnum
ALTER TYPE "TwoFactorPurpose" ADD VALUE 'CUSTOMER_OTP_LOGIN';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cabin" "CabinClass" NOT NULL DEFAULT 'ECONOMY',
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "cabin_fares" (
    "id" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "cabin" "CabinClass" NOT NULL,
    "priceIrr" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabin_fares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cabin_fares_flightInstanceId_cabin_key" ON "cabin_fares"("flightInstanceId", "cabin");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");

-- AddForeignKey
ALTER TABLE "cabin_fares" ADD CONSTRAINT "cabin_fares_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
