/**
 * Dev-only helper: creates a bookable THR↔MHD round-trip pair (plus a THR→MHD
 * business-heavy evening flight) in the local sandbox DB so the public
 * search → seat → pay flow can be exercised manually. Idempotent.
 *
 * Run: cd backend && npx tsx scripts/create-demo-flights.ts
 */
import 'dotenv/config';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { TypeORMClient } from '../generated/typeorm/client';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

function tehranDeparture(daysFromNow: number, hourLocal: number, minuteLocal = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  const tehranOffsetMin = 3 * 60 + 30;
  const localMin = hourLocal * 60 + minuteLocal;
  const utcMin = localMin - tehranOffsetMin;
  d.setUTCHours(Math.floor(utcMin / 60), utcMin % 60, 0, 0);
  return d;
}

async function ensureRoute(originCode: string, destCode: string, durationMin: number) {
  return typeorm.route.upsert({
    where: { originCode_destCode: { originCode, destCode } },
    update: { durationMin },
    create: { originCode, destCode, durationMin },
  });
}

async function ensureFlight(flightNo: string, routeId: string) {
  return typeorm.flight.upsert({
    where: { flightNo },
    update: {},
    create: { flightNo, routeId, aircraftType: 'Airbus A320' },
  });
}

async function ensureInstance(
  flightId: string,
  departureAt: Date,
  durationMin: number,
  basePriceIrr: bigint,
) {
  const dayStart = new Date(departureAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
  const existing = await typeorm.flightInstance.findFirst({
    where: { flightId, departureAt: { gte: dayStart, lt: dayEnd } },
  });
  if (existing) {
    console.log(`  instance already exists for ${departureAt.toISOString()} — skipped`);
    return existing;
  }
  return typeorm.flightInstance.create({
    data: {
      flightId,
      departureAt,
      arrivalAt: new Date(departureAt.getTime() + durationMin * 60_000),
      capacity: 180,
      charterSeats: 0,
      status: 'SCHEDULED',
      basePriceIrr,
    },
  });
}

async function main() {
  const durationMin = 90;

  const routeOut = await ensureRoute('THR', 'MHD', durationMin);
  const routeBack = await ensureRoute('MHD', 'THR', durationMin);

  const outFlight = await ensureFlight('BJ-701', routeOut.id);
  const outEvening = await ensureFlight('BJ-703', routeOut.id);
  const backFlight = await ensureFlight('BJ-702', routeBack.id);

  console.log('Creating flight instances…');

  const dep1 = tehranDeparture(1, 8);
  const dep2 = tehranDeparture(1, 18, 30);
  const dep3 = tehranDeparture(4, 17);
  const i1 = await ensureInstance(outFlight.id, dep1, durationMin, 16_000_000n);
  const i2 = await ensureInstance(outEvening.id, dep2, durationMin, 14_500_000n);
  const i3 = await ensureInstance(backFlight.id, dep3, durationMin, 17_500_000n);

  console.log('\nDone:');
  for (const [label, inst, flightNo] of [
    ['رفت صبح', i1, 'BJ-701'],
    ['رفت عصر', i2, 'BJ-703'],
    ['برگشت', i3, 'BJ-702'],
  ] as const) {
    console.log(
      `  ${label}  ${flightNo}  dep=${inst.departureAt.toISOString()}  date=${inst.departureAt
        .toISOString()
        .slice(0, 10)}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => typeorm.$disconnect());
