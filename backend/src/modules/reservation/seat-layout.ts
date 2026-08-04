export interface SeatCell {
  seatCode: string;
  row: number;
  cabin: 'BUSINESS' | 'ECONOMY';
}

/** Structural shape shared by the TypeORM-generated `AircraftSeatMap` (still
 * used by unconverted callers) and the TypeORM entity (which correctly
 * models these `text[]` columns as nullable) — accepting either lets this
 * util stay ORM-agnostic during the migration. */
export interface AircraftSeatMapLike {
  businessRowStart: number;
  businessRowEnd: number;
  businessColsLeft: string[] | null;
  businessColsRight: string[] | null;
  economyRowStart: number;
  economyRowEnd: number;
  economyColsLeft: string[] | null;
  economyColsRight: string[] | null;
  excludedSeatCodes?: string[] | null;
}

/** Enumerates every seat code from a data-driven AircraftSeatMap config —
 * CLAUDE.md: "seat map config lives per aircraft type in the DB, not
 * hardcoded." Never a fixed row/column literal in application code. */
export function enumerateSeats(map: AircraftSeatMapLike): SeatCell[] {
  const excluded = new Set(map.excludedSeatCodes ?? []);
  const seats: SeatCell[] = [];
  for (let row = map.businessRowStart; row <= map.businessRowEnd; row++) {
    for (const col of [
      ...(map.businessColsLeft ?? []),
      ...(map.businessColsRight ?? []),
    ]) {
      const seatCode = `${row}${col}`;
      if (excluded.has(seatCode)) continue;
      seats.push({ seatCode, row, cabin: 'BUSINESS' });
    }
  }
  for (let row = map.economyRowStart; row <= map.economyRowEnd; row++) {
    for (const col of [
      ...(map.economyColsLeft ?? []),
      ...(map.economyColsRight ?? []),
    ]) {
      const seatCode = `${row}${col}`;
      if (excluded.has(seatCode)) continue;
      seats.push({ seatCode, row, cabin: 'ECONOMY' });
    }
  }
  return seats;
}

export function isKnownSeat(
  map: AircraftSeatMapLike,
  seatCode: string,
): boolean {
  return enumerateSeats(map).some((s) => s.seatCode === seatCode);
}
