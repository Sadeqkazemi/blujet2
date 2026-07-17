-- AlterTable
ALTER TABLE "passengers" ADD COLUMN     "nationalIdHash" TEXT,
ADD COLUMN     "seatCode" TEXT;

-- CreateTable
CREATE TABLE "aircraft_seat_maps" (
    "id" TEXT NOT NULL,
    "aircraftType" TEXT NOT NULL,
    "businessRowStart" INTEGER NOT NULL,
    "businessRowEnd" INTEGER NOT NULL,
    "businessColsLeft" TEXT[],
    "businessColsRight" TEXT[],
    "economyRowStart" INTEGER NOT NULL,
    "economyRowEnd" INTEGER NOT NULL,
    "economyColsLeft" TEXT[],
    "economyColsRight" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircraft_seat_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_locks" (
    "id" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "seatCode" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "passengerName" TEXT,
    "passengerNationalIdEnc" TEXT,
    "passengerNationalIdHash" TEXT,
    "passengerMobileEnc" TEXT,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_seat_maps_aircraftType_key" ON "aircraft_seat_maps"("aircraftType");

-- CreateIndex
CREATE INDEX "seat_locks_flightInstanceId_idx" ON "seat_locks"("flightInstanceId");

-- CreateIndex
CREATE INDEX "passengers_nationalIdHash_idx" ON "passengers"("nationalIdHash");

-- AddForeignKey
ALTER TABLE "seat_locks" ADD CONSTRAINT "seat_locks_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_locks" ADD CONSTRAINT "seat_locks_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_locks" ADD CONSTRAINT "seat_locks_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: only one ACTIVE (non-released) lock per seat per
-- flight instance may exist at a time, enforced at the DB level (not just
-- app-level check-then-create) — CLAUDE.md's concurrency rule for seat
-- inventory. Released locks (history) are exempt so a seat can be
-- locked/released/relocked repeatedly.
CREATE UNIQUE INDEX "seat_locks_active_seat_unique" ON "seat_locks"("flightInstanceId", "seatCode") WHERE "releasedAt" IS NULL;
