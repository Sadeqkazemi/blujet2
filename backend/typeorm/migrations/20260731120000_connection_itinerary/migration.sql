-- Multi-leg connection booking: shared Itinerary PNR + per-leg Booking rows.

CREATE TABLE "itineraries" (
    "id" TEXT NOT NULL,
    "pnr" TEXT NOT NULL,
    "userId" TEXT,
    "agencyId" TEXT,
    "channel" "BookingChannel" NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "itineraries_pnr_key" ON "itineraries"("pnr");
CREATE INDEX "itineraries_userId_idx" ON "itineraries"("userId");
CREATE INDEX "itineraries_agencyId_idx" ON "itineraries"("agencyId");

ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD COLUMN "itineraryId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "legIndex" INTEGER;

CREATE INDEX "bookings_itineraryId_idx" ON "bookings"("itineraryId");

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
