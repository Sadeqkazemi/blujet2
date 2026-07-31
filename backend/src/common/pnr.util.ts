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
