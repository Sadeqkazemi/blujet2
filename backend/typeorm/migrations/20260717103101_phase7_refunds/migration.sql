-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('SUBMITTED', 'REVIEW', 'FINANCE', 'PAID');

-- CreateTable
CREATE TABLE "refund_penalty_rules" (
    "id" TEXT NOT NULL,
    "minHoursBeforeDeparture" INTEGER NOT NULL,
    "penaltyPct" INTEGER NOT NULL,
    "labelFa" TEXT NOT NULL,

    CONSTRAINT "refund_penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "passengerName" TEXT NOT NULL,
    "nidEnc" TEXT,
    "mobileEnc" TEXT,
    "ibanEnc" TEXT NOT NULL,
    "totalPaidIrr" INTEGER NOT NULL,
    "penaltyPct" INTEGER NOT NULL,
    "penaltyAmountIrr" INTEGER NOT NULL,
    "refundableIrr" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assigneeId" TEXT,
    "processedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "history" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refund_requests_status_idx" ON "refund_requests"("status");

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
