-- AlterTable
ALTER TABLE "price_locks" ADD COLUMN     "bookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "price_locks_bookingId_key" ON "price_locks"("bookingId");

-- AddForeignKey
ALTER TABLE "price_locks" ADD CONSTRAINT "price_locks_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
