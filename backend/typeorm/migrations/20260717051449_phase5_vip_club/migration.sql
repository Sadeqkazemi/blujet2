-- CreateEnum
CREATE TYPE "ClubTier" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "ClubCardStatus" AS ENUM ('NONE', 'REVIEW', 'ISSUED');

-- CreateEnum
CREATE TYPE "ClubCardRequestStatus" AS ENUM ('SUBMITTED', 'REFERRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClubCardAssignee" AS ENUM ('SENIOR', 'CHAIR');

-- CreateTable
CREATE TABLE "club_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "nationalIdEnc" TEXT NOT NULL,
    "nationalIdHash" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" "ClubTier" NOT NULL DEFAULT 'SILVER',
    "cardStatus" "ClubCardStatus" NOT NULL DEFAULT 'NONE',
    "cardNo" TEXT,
    "issuedByLabelFa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_card_requests" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "level" "ClubTier" NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "ClubCardRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assignedTo" "ClubCardAssignee",
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "cardNo" TEXT,
    "history" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_card_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "club_members_userId_key" ON "club_members"("userId");

-- CreateIndex
CREATE INDEX "club_members_nationalIdHash_idx" ON "club_members"("nationalIdHash");

-- CreateIndex
CREATE INDEX "club_members_level_idx" ON "club_members"("level");

-- CreateIndex
CREATE INDEX "club_card_requests_status_idx" ON "club_card_requests"("status");

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_card_requests" ADD CONSTRAINT "club_card_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "club_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_card_requests" ADD CONSTRAINT "club_card_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
