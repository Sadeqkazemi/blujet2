import type { TypeORMClient } from '../../generated/typeorm/client';
import { TEST_AIRPORT_CITY_PREFIXES } from './public-airport-filter';

const testAirportWhere = {
  OR: TEST_AIRPORT_CITY_PREFIXES.map((prefix) => ({
    cityFa: { startsWith: prefix },
  })),
};

/** Removes e2e/dev fixture airports and their orphan routes/flights/instances. */
export async function cleanupTestAirports(typeorm: TypeORMClient): Promise<number> {
  const testAirports = await typeorm.airport.findMany({ where: testAirportWhere });
  if (testAirports.length === 0) return 0;

  const codes = testAirports.map((a) => a.code);
  const routes = await typeorm.route.findMany({
    where: {
      OR: [{ originCode: { in: codes } }, { destCode: { in: codes } }],
    },
  });
  const routeIds = routes.map((r) => r.id);

  if (routeIds.length > 0) {
    const flights = await typeorm.flight.findMany({
      where: { routeId: { in: routeIds } },
    });
    const flightIds = flights.map((f) => f.id);

    if (flightIds.length > 0) {
      const instances = await typeorm.flightInstance.findMany({
        where: { flightId: { in: flightIds } },
        select: { id: true },
      });
      const instanceIds = instances.map((i) => i.id);

      if (instanceIds.length > 0) {
        await typeorm.seatLock.deleteMany({
          where: { flightInstanceId: { in: instanceIds } },
        });
        await typeorm.farePricingProposal.deleteMany({
          where: { flightInstanceId: { in: instanceIds } },
        });
        await typeorm.flightInstance.deleteMany({
          where: { id: { in: instanceIds } },
        });
      }

      await typeorm.flight.deleteMany({ where: { id: { in: flightIds } } });
    }

    await typeorm.route.deleteMany({ where: { id: { in: routeIds } } });
  }

  const result = await typeorm.airport.deleteMany({ where: testAirportWhere });
  return result.count;
}
