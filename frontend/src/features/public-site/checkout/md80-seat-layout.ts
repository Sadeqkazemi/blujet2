/**
 * MD-80 cabin chart — source: design-reference-v2/MD-80-seatmap.pdf
 *
 * First Class (rows 3–6): A B | aisle | E F
 * Economy (rows 7–32):    A B | aisle | D E F
 * Rear exit/galley omits 28A/B, 29A/B, 30A/B.
 */

export const MD80_AIRCRAFT_TYPES = new Set(['MD-80', 'MD-88', 'MD80', 'MD88']);

export const MD80_BUSINESS_LEFT = ['A', 'B'] as const;
export const MD80_BUSINESS_RIGHT = ['E', 'F'] as const;
export const MD80_ECONOMY_LEFT = ['A', 'B'] as const;
export const MD80_ECONOMY_RIGHT = ['D', 'E', 'F'] as const;

export const MD80_BUSINESS_ROWS = [3, 4, 5, 6] as const;
export const MD80_ECONOMY_ROW_START = 7;
export const MD80_ECONOMY_ROW_END = 32;

export const MD80_EXCLUDED = new Set([
  '28A',
  '28B',
  '29A',
  '29B',
  '30A',
  '30B',
]);

export type Md80Amenity = 'exit' | 'galley' | 'empty' | null;

/** Left-side amenity when A/B seats are missing (rear of MD-80). */
export function md80LeftAmenity(row: number): Md80Amenity {
  if (row === 28) return 'exit';
  if (row === 29) return 'galley';
  if (row === 30) return 'empty';
  return null;
}

export function isMd80Aircraft(aircraftType: string | undefined): boolean {
  if (!aircraftType) return false;
  const normalized = aircraftType.replace(/\s+/g, '').toUpperCase();
  return (
    MD80_AIRCRAFT_TYPES.has(aircraftType) ||
    MD80_AIRCRAFT_TYPES.has(normalized) ||
    normalized.includes('MD-80') ||
    normalized.includes('MD80') ||
    normalized.includes('MD-88') ||
    normalized.includes('MD88')
  );
}

export function md80Rows(): number[] {
  const rows: number[] = [];
  for (let r = 3; r <= 32; r++) rows.push(r);
  return rows;
}

export function md80ColsForRow(row: number): {
  left: readonly string[];
  right: readonly string[];
  cabin: 'BUSINESS' | 'ECONOMY';
} {
  if (row >= 3 && row <= 6) {
    return {
      left: MD80_BUSINESS_LEFT,
      right: MD80_BUSINESS_RIGHT,
      cabin: 'BUSINESS',
    };
  }
  return {
    left: MD80_ECONOMY_LEFT,
    right: MD80_ECONOMY_RIGHT,
    cabin: 'ECONOMY',
  };
}

/** Full MD-80 inventory (140 seats) — used when API seatmap is empty/mismatched. */
export function buildMd80Seats(
  takenCodes: Iterable<string> = [],
): Array<{
  seatCode: string;
  row: number;
  cabin: 'BUSINESS' | 'ECONOMY';
  status: 'FREE' | 'TAKEN';
}> {
  const taken = new Set(takenCodes);
  const out: Array<{
    seatCode: string;
    row: number;
    cabin: 'BUSINESS' | 'ECONOMY';
    status: 'FREE' | 'TAKEN';
  }> = [];
  for (const row of md80Rows()) {
    const { left, right, cabin } = md80ColsForRow(row);
    for (const letter of [...left, ...right]) {
      const seatCode = `${row}${letter}`;
      if (MD80_EXCLUDED.has(seatCode)) continue;
      out.push({
        seatCode,
        row,
        cabin,
        status: taken.has(seatCode) ? 'TAKEN' : 'FREE',
      });
    }
  }
  return out;
}

/** True when the API payload already uses MD-80 lettering (F present, C absent). */
export function looksLikeMd80SeatPayload(
  seats: Array<{ seatCode: string }>,
): boolean {
  if (seats.length === 0) return false;
  const hasF = seats.some((s) => /F$/.test(s.seatCode));
  const hasC = seats.some((s) => /C$/.test(s.seatCode));
  return hasF && !hasC;
}
