-- CreateEnum
CREATE TYPE "AgencyWebserviceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "agency_webservice_requests" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "scope" "AgencyApiScope" NOT NULL,
    "months" INTEGER NOT NULL,
    "priceIrr" INTEGER NOT NULL,
    "note" TEXT,
    "status" "AgencyWebserviceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_webservice_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_webservice_requests_agencyId_status_idx" ON "agency_webservice_requests"("agencyId", "status");

-- AddForeignKey
ALTER TABLE "agency_webservice_requests" ADD CONSTRAINT "agency_webservice_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_webservice_requests" ADD CONSTRAINT "agency_webservice_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
