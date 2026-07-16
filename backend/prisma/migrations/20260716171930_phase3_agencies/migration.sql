-- CreateEnum
CREATE TYPE "AgencyTier" AS ENUM ('NORMAL', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "AgencyMembershipStatus" AS ENUM ('PENDING', 'REFERRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgencyApiScope" AS ENUM ('FULL', 'SEARCH_BOOK', 'SEARCH_ONLY');

-- CreateEnum
CREATE TYPE "AgencyApiKeyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AgencyInvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "agency_profiles" (
    "userId" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tier" "AgencyTier" NOT NULL DEFAULT 'NORMAL',
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "agency_credit_lines" (
    "agencyId" TEXT NOT NULL,
    "limitIrr" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_credit_lines_pkey" PRIMARY KEY ("agencyId")
);

-- CreateTable
CREATE TABLE "agency_membership_requests" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "documents" JSONB,
    "status" "AgencyMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "referredToId" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_membership_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_api_keys" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scope" "AgencyApiScope" NOT NULL,
    "status" "AgencyApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "callCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agency_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_invoices" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amountIrr" INTEGER NOT NULL,
    "status" "AgencyInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "agency_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_messages" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderIsAgency" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_membership_requests_status_idx" ON "agency_membership_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_api_keys_keyHash_key" ON "agency_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "agency_api_keys_agencyId_idx" ON "agency_api_keys"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "agency_invoices_invoiceNo_key" ON "agency_invoices"("invoiceNo");

-- CreateIndex
CREATE INDEX "agency_invoices_agencyId_status_idx" ON "agency_invoices"("agencyId", "status");

-- CreateIndex
CREATE INDEX "agency_messages_agencyId_createdAt_idx" ON "agency_messages"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_agencyId_idx" ON "bookings"("agencyId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_profiles" ADD CONSTRAINT "agency_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_credit_lines" ADD CONSTRAINT "agency_credit_lines_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_credit_lines" ADD CONSTRAINT "agency_credit_lines_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_membership_requests" ADD CONSTRAINT "agency_membership_requests_referredToId_fkey" FOREIGN KEY ("referredToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_membership_requests" ADD CONSTRAINT "agency_membership_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_api_keys" ADD CONSTRAINT "agency_api_keys_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invoices" ADD CONSTRAINT "agency_invoices_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invoices" ADD CONSTRAINT "agency_invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_messages" ADD CONSTRAINT "agency_messages_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_messages" ADD CONSTRAINT "agency_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
