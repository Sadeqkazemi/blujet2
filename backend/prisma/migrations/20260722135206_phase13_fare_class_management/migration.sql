-- AlterTable
ALTER TABLE "fare_rules" ADD COLUMN     "allowedChannels" "BookingChannel"[] DEFAULT ARRAY[]::"BookingChannel"[],
ADD COLUMN     "baggageAllowanceKg" INTEGER,
ADD COLUMN     "changeable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxIrr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validUntil" TIMESTAMP(3);
