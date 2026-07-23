-- AlterTable
ALTER TABLE "agency_membership_requests" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "agency_membership_requests" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "agency_request_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_request_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_request_otps_phone_idx" ON "agency_request_otps"("phone");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "nationalIdEnc" TEXT;
ALTER TABLE "users" ADD COLUMN "nationalIdHash" TEXT;
ALTER TABLE "users" ADD COLUMN "passportNoEnc" TEXT;
ALTER TABLE "users" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_nationalIdHash_idx" ON "users"("nationalIdHash");
