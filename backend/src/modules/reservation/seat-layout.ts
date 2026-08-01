import type { AircraftSeatMap } from '../../../generated/prisma/client';

export interface SeatCell {
  seatCode: string;
  row: number;
  cabin: 'BUSINESS' | 'ECONOMY';
}

/** Enumerates every seat code from a data-driven AircraftSeatMap config —
 * CLAUDE.md: "seat map config lives per aircraft type in the DB, not
 * hardcoded." Never a fixed row/column literal in application code. */
export function enumerateSeats(map: AircraftSeatMap): SeatCell[] {
  const excluded = new Set(map.excludedSeatCodes ?? []);
  const seats: SeatCell[] = [];
  for (let row = map.businessRowStart; row <= map.businessRowEnd; row++) {
    for (const col of [...map.businessColsLeft, ...map.businessColsRight]) {
      const seatCode = `${row}${col}`;
      if (excluded.has(seatCode)) continue;
      seats.push({ seatCode, row, cabin: 'BUSINESS' });
    }
  }
  for (let row = map.economyRowStart; row <= map.economyRowEnd; row++) {
    for (const col of [...map.economyColsLeft, ...map.economyColsRight]) {
      const seatCode = `${row}${col}`;
      if (excluded.has(seatCode)) continue;
      seats.push({ seatCode, row, cabin: 'ECONOMY' });
    }
  }
  return seats;
}

export function isKnownSeat(map: AircraftSeatMap, seatCode: string): boolean {
  return enumerateSeats(map).some((s) => s.seatCode === seatCode);
}
