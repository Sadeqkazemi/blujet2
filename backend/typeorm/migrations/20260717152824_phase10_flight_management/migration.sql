-- AlterTable
ALTER TABLE "flight_instances" ADD COLUMN     "agencySeatsAllocated" INTEGER,
ADD COLUMN     "basePriceIrr" INTEGER;

-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "durationMin" INTEGER NOT NULL DEFAULT 120;

-- CreateTable
CREATE TABLE "airports" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "cityFa" TEXT NOT NULL,
    "tz" TEXT NOT NULL,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "airports_code_key" ON "airports"("code");
