-- CreateEnum
CREATE TYPE "EmployeeReferralScope" AS ENUM ('MANAGERS_ONLY', 'ALL_STAFF');

-- CreateEnum
CREATE TYPE "ExternalServiceMethod" AS ENUM ('GET', 'POST');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "dept" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rank" TEXT,
ADD COLUMN     "referralScope" "EmployeeReferralScope";

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "sectionLabelFa" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelFa" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_permissions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_services" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "uptimePct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_service_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" "ExternalServiceMethod" NOT NULL DEFAULT 'POST',
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "apiKeyEncrypted" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_service_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_events" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "resetById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_policy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "minLength" INTEGER NOT NULL DEFAULT 10,
    "expiryDays" INTEGER NOT NULL DEFAULT 90,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "requireNumber" BOOLEAN NOT NULL DEFAULT true,
    "requireSymbol" BOOLEAN NOT NULL DEFAULT true,
    "blockReuse" BOOLEAN NOT NULL DEFAULT true,
    "staffTwoFactorMandatory" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "status" "BackupStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_dept_key_key" ON "permissions"("dept", "key");

-- CreateIndex
CREATE UNIQUE INDEX "employee_permissions_employeeId_permissionId_key" ON "employee_permissions"("employeeId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "internal_services_key_key" ON "internal_services"("key");

-- CreateIndex
CREATE UNIQUE INDEX "external_service_configs_key_key" ON "external_service_configs"("key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_events" ADD CONSTRAINT "password_reset_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_events" ADD CONSTRAINT "password_reset_events_resetById_fkey" FOREIGN KEY ("resetById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_policy" ADD CONSTRAINT "security_policy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_records" ADD CONSTRAINT "backup_records_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
