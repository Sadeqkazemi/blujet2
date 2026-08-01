import { dayjs } from '../../../lib/jalali';
import type { SearchFlightResult } from '../../../types/public-site';

/** Design reference route — نتایج پرواز.dc.html only lists flights for THR↔MHD. */
export function isThrMhdRoute(origin: string, dest: string): boolean {
  const o = origin.toUpperCase();
  const d = dest.toUpperCase();
  return (o === 'THR' && d === 'MHD') || (o === 'MHD' && d === 'THR');
}

type DemoRow = {
  id: number;
  flightNo: string;
  dep: string;
  durMin: number;
  stops: number;
  priceToman: number;
  seats: number;
  aircraft: string;
};

/** Subset of the design's static flight table (نتایج پرواز.dc.html lines 1344–1368). */
const DEMO_ROWS: DemoRow[] = [
  { id: 1, flightNo: 'EP-821', dep: '08:30', durMin: 135, stops: 0, priceToman: 3_800_000, seats: 5, aircraft: 'MD-80' },
  { id: 2, flightNo: 'W5-112', dep: '13:10', durMin: 220, stops: 1, priceToman: 4_250_000, seats: 9, aircraft: 'MD-80' },
  { id: 3, flightNo: 'IR-655', dep: '20:00', durMin: 140, stops: 0, priceToman: 4_100_000, seats: 3, aircraft: 'MD-80' },
  { id: 4, flightNo: 'QB-220', dep: '06:15', durMin: 145, stops: 0, priceToman: 3_950_000, seats: 7, aircraft: 'MD-80' },
  { id: 5, flightNo: 'RV-431', dep: '16:45', durMin: 265, stops: 1, priceToman: 3_650_000, seats: 2, aircraft: 'MD-80' },
  { id: 6, flightNo: 'VR-550', dep: '11:00', durMin: 150, stops: 0, priceToman: 4_400_000, seats: 6, aircraft: 'MD-80' },
  { id: 7, flightNo: 'Y9-301', dep: '05:30', durMin: 140, stops: 0, priceToman: 3_720_000, seats: 4, aircraft: 'MD-80' },
  { id: 8, flightNo: 'ZV-402', dep: '07:15', durMin: 145, stops: 0, priceToman: 3_880_000, seats: 8, aircraft: 'MD-80' },
];

function isoAtLocalTime(date: string, hhmm: string, tz: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return dayjs.tz(`${date} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, 'YYYY-MM-DD HH:mm', tz).toISOString();
}

/** Static preview flights for the design's primary route when the API has no inventory yet. */
export function demoFlightsForThrMhd(origin: string, dest: string, date: string): SearchFlightResult[] {
  const originCode = origin.toUpperCase();
  const destCode = dest.toUpperCase();
  const originTz = originCode === 'MHD' ? 'Asia/Tehran' : 'Asia/Tehran';

  return DEMO_ROWS.map((row) => {
    const departureAt = isoAtLocalTime(date, row.dep, originTz);
    const arrivalAt = dayjs(departureAt).add(row.durMin, 'minute').toISOString();
    const priceIrr = String(row.priceToman * 10);

    const base: SearchFlightResult = {
      flightInstanceId: `demo-${row.id}`,
      flightNo: row.flightNo,
      aircraftType: row.aircraft,
      originCode,
      destCode,
      departureAt,
      arrivalAt,
      cabins: [
        { cabin: 'ECONOMY', priceIrr, seatsLeft: row.seats },
        { cabin: 'BUSINESS', priceIrr: String(row.priceToman * 18), seatsLeft: Math.max(1, Math.floor(row.seats / 2)) },
      ],
    };

    if (row.stops > 0) {
      base.connection = {
        via: 'SYZ',
        legs: [
          {
            flightInstanceId: `demo-${row.id}-leg1`,
            flightNo: row.flightNo,
            originCode,
            destCode: 'SYZ',
            departureAt,
            arrivalAt: dayjs(departureAt).add(Math.floor(row.durMin / 2), 'minute').toISOString(),
          },
          {
            flightInstanceId: `demo-${row.id}-leg2`,
            flightNo: row.flightNo,
            originCode: 'SYZ',
            destCode,
            departureAt: dayjs(departureAt).add(Math.floor(row.durMin / 2) + 45, 'minute').toISOString(),
            arrivalAt,
          },
        ],
      };
    }

    return base;
  });
}
