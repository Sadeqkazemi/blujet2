-- CreateTable
CREATE TABLE "saved_flights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "cabin" "CabinClass" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_flights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_flights_userId_createdAt_idx" ON "saved_flights"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "saved_flights_userId_flightInstanceId_cabin_key" ON "saved_flights"("userId", "flightInstanceId", "cabin");

-- AddForeignKey
ALTER TABLE "saved_flights" ADD CONSTRAINT "saved_flights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_flights" ADD CONSTRAINT "saved_flights_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
