import * as crypto from 'node:crypto';

/** Short unique booking code shown on the ticket (CLAUDE.md). */
export function generatePnr(): string {
  return `BJ${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

type PnrLookup = {
  booking: {
    findUnique(args: { where: { pnr: string } }): Promise<unknown | null>;
  };
};

type ItineraryPnrLookup = PnrLookup & {
  itinerary: {
    findUnique(args: { where: { pnr: string } }): Promise<unknown | null>;
  };
};

/** Retries on the extremely unlikely @unique collision. */
export async function generateUniquePnr(
  typeorm: PnrLookup,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pnr = generatePnr();
    const existing = await typeorm.booking.findUnique({ where: { pnr } });
    if (!existing) return pnr;
  }
  throw new Error('Failed to generate a unique PNR');
}

/** Shared itinerary code — also checked against bookings for collision safety. */
export async function generateUniqueItineraryPnr(
  typeorm: ItineraryPnrLookup,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pnr = generatePnr();
    const [bookingHit, itineraryHit] = await Promise.all([
      typeorm.booking.findUnique({ where: { pnr } }),
      typeorm.itinerary.findUnique({ where: { pnr } }),
    ]);
    if (!bookingHit && !itineraryHit) return pnr;
  }
  throw new Error('Failed to generate a unique itinerary PNR');
}

/** Leg suffix keeps Booking.pnr @unique while sharing one customer-facing code. */
export function legPnr(itineraryPnr: string, legIndex: number): string {
  return `${itineraryPnr}L${legIndex + 1}`;
}
