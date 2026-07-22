-- AlterTable
ALTER TABLE "flight_instances" ADD COLUMN     "aircraftRegistration" TEXT,
ADD COLUMN     "aircraftTypeOverride" TEXT,
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "saleStartsAt" TIMESTAMP(3);
