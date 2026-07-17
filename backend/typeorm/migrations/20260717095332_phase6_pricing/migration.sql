-- CreateEnum
CREATE TYPE "PricingProposalStatus" AS ENUM ('PENDING', 'REGISTERED');

-- CreateTable
CREATE TABLE "fare_pricing_proposals" (
    "id" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "basePriceIrr" INTEGER NOT NULL,
    "competitorPriceIrr" INTEGER NOT NULL,
    "proposedPriceIrr" INTEGER NOT NULL,
    "legalRateIrr" INTEGER,
    "note" TEXT,
    "proposedById" TEXT NOT NULL,
    "status" "PricingProposalStatus" NOT NULL DEFAULT 'PENDING',
    "registeredPriceIrr" INTEGER,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "aiSuggestion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fare_pricing_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fare_pricing_proposals_flightInstanceId_key" ON "fare_pricing_proposals"("flightInstanceId");

-- CreateIndex
CREATE INDEX "fare_pricing_proposals_status_idx" ON "fare_pricing_proposals"("status");

-- AddForeignKey
ALTER TABLE "fare_pricing_proposals" ADD CONSTRAINT "fare_pricing_proposals_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_pricing_proposals" ADD CONSTRAINT "fare_pricing_proposals_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_pricing_proposals" ADD CONSTRAINT "fare_pricing_proposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
