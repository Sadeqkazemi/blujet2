-- AlterTable
ALTER TABLE "airports" ADD COLUMN     "minConnectMin" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "fareClassCode" TEXT;

-- AlterTable
ALTER TABLE "flight_instances" ADD COLUMN     "scheduleId" TEXT;

-- AlterTable
ALTER TABLE "passengers" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "rrule" TEXT NOT NULL,
    "depHour" INTEGER NOT NULL,
    "depMinute" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fare_rules" (
    "id" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "cabin" "CabinClass" NOT NULL,
    "classCode" TEXT NOT NULL,
    "priceIrr" INTEGER NOT NULL,
    "seatsAllocated" INTEGER NOT NULL,
    "refundable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fare_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fare_rules_flightInstanceId_cabin_classCode_key" ON "fare_rules"("flightInstanceId", "cabin", "classCode");

-- CreateIndex
CREATE UNIQUE INDEX "flight_instances_scheduleId_departureAt_key" ON "flight_instances"("scheduleId", "departureAt");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "flights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_instances" ADD CONSTRAINT "flight_instances_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_rules" ADD CONSTRAINT "fare_rules_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

