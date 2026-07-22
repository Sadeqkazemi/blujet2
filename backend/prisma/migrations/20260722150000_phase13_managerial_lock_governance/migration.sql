-- CreateEnum
CREATE TYPE "LockClassification" AS ENUM ('FREE', 'DISCOUNTED', 'PAYABLE');

-- CreateEnum
CREATE TYPE "LockApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "seat_locks"
  ADD COLUMN "reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "classification" "LockClassification" NOT NULL DEFAULT 'PAYABLE',
  ADD COLUMN "discountPct" INTEGER,
  ADD COLUMN "requesterRank" "Role" NOT NULL DEFAULT 'IT_MANAGER',
  ADD COLUMN "approvalStatus" "LockApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "bookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "seat_locks_bookingId_key" ON "seat_locks"("bookingId");

-- AddForeignKey
ALTER TABLE "seat_locks" ADD CONSTRAINT "seat_locks_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_locks" ADD CONSTRAINT "seat_locks_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_locks" ADD CONSTRAINT "seat_locks_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
