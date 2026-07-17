-- CreateEnum
CREATE TYPE "AgencyCreditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgencyDocumentType" AS ENUM ('LICENSE', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "AgencyDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "agency_credit_requests" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requestedLimitIrr" INTEGER NOT NULL,
    "note" TEXT,
    "status" "AgencyCreditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_credit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_documents" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "docType" "AgencyDocumentType" NOT NULL,
    "status" "AgencyDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_credit_requests_agencyId_status_idx" ON "agency_credit_requests"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_documents_fileId_key" ON "agency_documents"("fileId");

-- CreateIndex
CREATE INDEX "agency_documents_agencyId_idx" ON "agency_documents"("agencyId");

-- AddForeignKey
ALTER TABLE "agency_credit_requests" ADD CONSTRAINT "agency_credit_requests_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_credit_requests" ADD CONSTRAINT "agency_credit_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_documents" ADD CONSTRAINT "agency_documents_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_documents" ADD CONSTRAINT "agency_documents_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
