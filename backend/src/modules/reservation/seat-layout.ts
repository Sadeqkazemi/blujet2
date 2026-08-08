export interface SeatCell {
  seatCode: string;
  row: number;
  cabin: 'BUSINESS' | 'COMFORT' | 'ECONOMY' | 'FIRST';
}

/** Structural shape shared by seat-map rows — ORM-agnostic. */
export interface AircraftSeatMapLike {
  businessRowStart: number;
  businessRowEnd: number;
  businessColsLeft: string[] | null;
  businessColsRight: string[] | null;
  comfortRowStart?: number | null;
  comfortRowEnd?: number | null;
  comfortColsLeft?: string[] | null;
  comfortColsRight?: string[] | null;
  firstRowStart?: number | null;
  firstRowEnd?: number | null;
  firstColsLeft?: string[] | null;
  firstColsRight?: string[] | null;
  economyRowStart: number;
  economyRowEnd: number;
  economyColsLeft: string[] | null;
  economyColsRight: string[] | null;
  excludedSeatCodes?: string[] | null;
}

function pushCabinRows(
  seats: SeatCell[],
  excluded: Set<string>,
  rowStart: number | null | undefined,
  rowEnd: number | null | undefined,
  colsLeft: string[] | null | undefined,
  colsRight: string[] | null | undefined,
  cabin: SeatCell['cabin'],
) {
  if (
    rowStart == null ||
    rowEnd == null ||
    !Number.isFinite(rowStart) ||
    !Number.isFinite(rowEnd) ||
    rowEnd < rowStart
  ) {
    return;
  }
  const cols = [...(colsLeft ?? []), ...(colsRight ?? [])];
  if (cols.length === 0) return;
  for (let row = rowStart; row <= rowEnd; row++) {
    for (const col of cols) {
      const seatCode = `${row}${col}`;
      if (excluded.has(seatCode)) continue;
      seats.push({ seatCode, row, cabin });
    }
  }
}

/** Enumerates every seat code from a data-driven AircraftSeatMap config. */
export function enumerateSeats(map: AircraftSeatMapLike): SeatCell[] {
  const excluded = new Set(map.excludedSeatCodes ?? []);
  const seats: SeatCell[] = [];
  pushCabinRows(
    seats,
    excluded,
    map.firstRowStart,
    map.firstRowEnd,
    map.firstColsLeft,
    map.firstColsRight,
    'FIRST',
  );
  pushCabinRows(
    seats,
    excluded,
    map.businessRowStart,
    map.businessRowEnd,
    map.businessColsLeft,
    map.businessColsRight,
    'BUSINESS',
  );
  pushCabinRows(
    seats,
    excluded,
    map.comfortRowStart,
    map.comfortRowEnd,
    map.comfortColsLeft,
    map.comfortColsRight,
    'COMFORT',
  );
  pushCabinRows(
    seats,
    excluded,
    map.economyRowStart,
    map.economyRowEnd,
    map.economyColsLeft,
    map.economyColsRight,
    'ECONOMY',
  );
  return seats;
}

export function countSeatsByCabin(
  map: AircraftSeatMapLike,
): Record<'BUSINESS' | 'COMFORT' | 'ECONOMY' | 'FIRST', number> {
  const out = { BUSINESS: 0, COMFORT: 0, ECONOMY: 0, FIRST: 0 };
  for (const seat of enumerateSeats(map)) {
    out[seat.cabin] += 1;
  }
  return out;
}

export function isKnownSeat(
  map: AircraftSeatMapLike,
  seatCode: string,
): boolean {
  return enumerateSeats(map).some((s) => s.seatCode === seatCode);
}
