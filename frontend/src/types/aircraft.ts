import type { CabinKind } from '../lib/flight-definition';

/** Standard cabin kinds for aircraft definition UI. */
export type AircraftCabinKind =
  | 'ECONOMY'
  | 'PREMIUM_ECONOMY'
  | 'COMFORT'
  | 'BUSINESS'
  | 'FIRST';

export type AircraftStatus = 'ACTIVE' | 'INACTIVE';

export interface AircraftCabinCapacity {
  cabin: AircraftCabinKind;
  enabled: boolean;
  seats: number;
}

export interface AircraftSeatMapDraft {
  /** Inclusive row range. */
  rowStart: number;
  rowEnd: number;
  /** Letters on the left of the aisle, e.g. A,B */
  colsLeft: string[];
  /** Letters on the right of the aisle, e.g. C,D,E */
  colsRight: string[];
  cabin: AircraftCabinKind;
  /** Seat codes that exist structurally but are blocked (exit, galley, …). */
  disabledSeatCodes: string[];
}

export interface AircraftDefinition {
  id: string;
  name: string;
  code: string;
  status: AircraftStatus;
  totalSeats: number;
  cabins: AircraftCabinCapacity[];
  seatMap: AircraftSeatMapDraft[];
  /** When true, UI must not mutate the hard-coded MD-80 public checkout map. */
  lockedSeatMap?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AircraftDefinitionListItem {
  id: string;
  name: string;
  code: string;
  status: AircraftStatus;
  totalSeats: number;
  cabinSummary: string;
}

export interface UpsertAircraftDefinitionPayload {
  name: string;
  code: string;
  status: AircraftStatus;
  totalSeats: number;
  cabins: AircraftCabinCapacity[];
  seatMap: AircraftSeatMapDraft[];
}

/** Maps aircraft cabin kinds onto flight CabinKind where backend allows. */
export function toFlightCabinKind(cabin: AircraftCabinKind): CabinKind | null {
  if (cabin === 'ECONOMY') return 'ECONOMY';
  if (cabin === 'BUSINESS') return 'BUSINESS';
  if (cabin === 'COMFORT' || cabin === 'PREMIUM_ECONOMY') return 'COMFORT';
  return null;
}

export const AIRCRAFT_CABIN_OPTIONS: { value: AircraftCabinKind; label: string }[] = [
  { value: 'ECONOMY', label: 'اکونومی' },
  { value: 'PREMIUM_ECONOMY', label: 'پریمیوم اکونومی / کامفورت' },
  { value: 'COMFORT', label: 'کامفورت' },
  { value: 'BUSINESS', label: 'بیزنس' },
  { value: 'FIRST', label: 'فرست' },
];
