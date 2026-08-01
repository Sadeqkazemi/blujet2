-- AlterTable
ALTER TABLE "aircraft_seat_maps" ADD COLUMN IF NOT EXISTS "excludedSeatCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
