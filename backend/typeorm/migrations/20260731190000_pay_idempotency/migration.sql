-- CreateTable
CREATE TABLE "pay_idempotency_records" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pay_idempotency_records_idempotencyKey_key" ON "pay_idempotency_records"("idempotencyKey");

-- CreateIndex
CREATE INDEX "pay_idempotency_records_bookingId_idx" ON "pay_idempotency_records"("bookingId");

-- AddForeignKey
ALTER TABLE "pay_idempotency_records" ADD CONSTRAINT "pay_idempotency_records_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_idempotency_records" ADD CONSTRAINT "pay_idempotency_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
