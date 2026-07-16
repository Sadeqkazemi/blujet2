-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AGENCY', 'EMPLOYEE', 'IT_MANAGER', 'COMMERCIAL_MANAGER', 'FINANCE_MANAGER', 'SENIOR_MANAGER', 'CEO', 'BOARD_CHAIR', 'SITE_ADMIN');

-- CreateEnum
CREATE TYPE "TwoFactorPurpose" AS ENUM ('STAFF_LOGIN_2FA');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AGENCY', 'PRICING', 'FINANCE', 'REFUND', 'STRATEGY', 'SYSTEM', 'CLUB', 'ACCOUNT', 'ACCESS', 'SECURITY', 'RESERVATION');

-- CreateEnum
CREATE TYPE "FlightInstanceStatus" AS ENUM ('SCHEDULED', 'DEPARTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingChannel" AS ENUM ('SYSTEM', 'CHARTER', 'AGENCY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'HELD', 'PAID', 'TICKETED', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('SALE', 'REFUND', 'SETTLEMENT', 'COMMISSION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "email" TEXT,
    "fullName" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TwoFactorPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_access_flags" (
    "panelKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panel_access_flags_pkey" PRIMARY KEY ("panelKey")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "originCode" TEXT NOT NULL,
    "destCode" TEXT NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flights" (
    "id" TEXT NOT NULL,
    "flightNo" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "aircraftType" TEXT NOT NULL,

    CONSTRAINT "flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_instances" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "charterSeats" INTEGER NOT NULL DEFAULT 0,
    "status" "FlightInstanceStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "flight_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "pnr" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "channel" "BookingChannel" NOT NULL,
    "agencyId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "priceIrr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passengers" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalIdEnc" TEXT,
    "mobileEnc" TEXT,

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "signedAmountIrr" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "two_factor_challenges_userId_idx" ON "two_factor_challenges"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_actorRole_category_createdAt_idx" ON "audit_logs"("actorRole", "category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "routes_originCode_destCode_key" ON "routes"("originCode", "destCode");

-- CreateIndex
CREATE UNIQUE INDEX "flights_flightNo_key" ON "flights"("flightNo");

-- CreateIndex
CREATE INDEX "flight_instances_departureAt_idx" ON "flight_instances"("departureAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_pnr_key" ON "bookings"("pnr");

-- CreateIndex
CREATE INDEX "bookings_flightInstanceId_status_idx" ON "bookings"("flightInstanceId", "status");

-- CreateIndex
CREATE INDEX "bookings_channel_idx" ON "bookings"("channel");

-- CreateIndex
CREATE INDEX "ledger_entries_occurredAt_type_idx" ON "ledger_entries"("occurredAt", "type");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_access_flags" ADD CONSTRAINT "panel_access_flags_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flights" ADD CONSTRAINT "flights_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_instances" ADD CONSTRAINT "flight_instances_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "flights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

