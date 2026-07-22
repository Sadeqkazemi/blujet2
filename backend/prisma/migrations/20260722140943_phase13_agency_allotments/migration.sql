-- CreateEnum
CREATE TYPE "AllotmentType" AS ENUM ('SOFT', 'HARD');

-- CreateTable
CREATE TABLE "agency_allotments" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "seatsAllocated" INTEGER NOT NULL,
    "type" "AllotmentType" NOT NULL DEFAULT 'HARD',
    "releaseAt" TIMESTAMP(3),
    "contractPriceIrr" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_allotments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "agency_allotments" ADD CONSTRAINT "agency_allotments_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_allotments" ADD CONSTRAINT "agency_allotments_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_allotments" ADD CONSTRAINT "agency_allotments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
