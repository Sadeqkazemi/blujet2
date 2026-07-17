-- CreateEnum
CREATE TYPE "CartableCategory" AS ENUM ('ADMIN', 'AGENCY', 'MANAGER');

-- CreateEnum
CREATE TYPE "CartableSourceType" AS ENUM ('MANAGER_MESSAGE', 'MANAGER_REFERRAL', 'AGENCY_REQUEST', 'CHAIR_PERMISSION');

-- CreateEnum
CREATE TYPE "CartableStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ReferralPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('SENT', 'REVIEWING', 'REPORTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ManagerMessageDept" AS ENUM ('FINANCE', 'COMMERCIAL', 'SUPPORT', 'AGENCIES', 'CEO', 'ALL_MANAGERS');

-- CreateEnum
CREATE TYPE "ChairPermissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "cartable_tasks" (
    "id" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "category" "CartableCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "senderId" TEXT,
    "senderLabelFa" TEXT,
    "sourceType" "CartableSourceType",
    "sourceId" TEXT,
    "status" "CartableStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "transferredToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cartable_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_referrals" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "ReferralPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "status" "ReferralStatus" NOT NULL DEFAULT 'SENT',
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_referral_recipients" (
    "referralId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,

    CONSTRAINT "manager_referral_recipients_pkey" PRIMARY KEY ("referralId","recipientId")
);

-- CreateTable
CREATE TABLE "manager_referral_reports" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_referral_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_messages" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toDept" "ManagerMessageDept" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chair_report_permissions" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "ChairPermissionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chair_report_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cartable_tasks_assigneeId_status_idx" ON "cartable_tasks"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "cartable_tasks_sourceType_sourceId_idx" ON "cartable_tasks"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "manager_referrals_fromId_status_idx" ON "manager_referrals"("fromId", "status");

-- CreateIndex
CREATE INDEX "manager_referral_recipients_recipientId_idx" ON "manager_referral_recipients"("recipientId");

-- CreateIndex
CREATE INDEX "manager_referral_reports_referralId_idx" ON "manager_referral_reports"("referralId");

-- CreateIndex
CREATE INDEX "manager_messages_fromId_createdAt_idx" ON "manager_messages"("fromId", "createdAt");

-- CreateIndex
CREATE INDEX "chair_report_permissions_requesterId_status_idx" ON "chair_report_permissions"("requesterId", "status");

-- CreateIndex
CREATE INDEX "stored_files_ownerId_idx" ON "stored_files"("ownerId");

-- AddForeignKey
ALTER TABLE "cartable_tasks" ADD CONSTRAINT "cartable_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartable_tasks" ADD CONSTRAINT "cartable_tasks_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartable_tasks" ADD CONSTRAINT "cartable_tasks_transferredToId_fkey" FOREIGN KEY ("transferredToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_referrals" ADD CONSTRAINT "manager_referrals_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_referral_recipients" ADD CONSTRAINT "manager_referral_recipients_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "manager_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_referral_recipients" ADD CONSTRAINT "manager_referral_recipients_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_referral_reports" ADD CONSTRAINT "manager_referral_reports_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "manager_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_referral_reports" ADD CONSTRAINT "manager_referral_reports_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_messages" ADD CONSTRAINT "manager_messages_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chair_report_permissions" ADD CONSTRAINT "chair_report_permissions_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chair_report_permissions" ADD CONSTRAINT "chair_report_permissions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
