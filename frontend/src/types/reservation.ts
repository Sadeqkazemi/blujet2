export type SeatStatus = 'FREE' | 'SOLD' | 'LOCKED';

export interface SeatOccupant {
  pnr: string;
  passengerName: string;
  bookingStatus: BookingStatus;
}

export interface SeatCell {
  seatCode: string;
  status: SeatStatus;
  lockId: string | null;
  lockExpiresAt?: string | null;
  lockPassengerName?: string | null;
  occupant?: SeatOccupant | null;
}

export interface SeatRow {
  row: number;
  cabin: 'BUSINESS' | 'ECONOMY';
  seats: SeatCell[];
}

export interface SeatMap {
  flightInstanceId: string;
  flightNo?: string;
  originCode?: string;
  destCode?: string;
  originCityFa?: string;
  destCityFa?: string;
  departureAt?: string;
  aircraftType: string;
  rows: SeatRow[];
  cabinLayout: Record<'BUSINESS' | 'ECONOMY', { aisleAfterIndex: number }>;
  capacity: number;
  soldCount: number;
  lockedCount: number;
  freeCount?: number;
  occupancyPct: number;
}

export interface SeatLockView {
  id: string;
  flightInstanceId: string;
  seatCode: string;
  lockedById: string;
  passengerName: string | null;
  releasedById: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export type BookingStatus =
  | 'DRAFT'
  | 'HELD'
  | 'PAID'
  | 'TICKETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'FLOWN'
  | 'NO_SHOW';

export interface PnrGroup {
  flightInstanceId: string;
  flightNo: string;
  route: string;
  departureAt: string;
  rows: { pnr: string; passenger: string; channel: string; status: BookingStatus }[];
}

export interface PnrDetail {
  pnr: string;
  status: BookingStatus;
  channel: string;
  // Decimal STRING on the wire (BigInt.prototype.toJSON on the backend).
  priceIrr: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  arrivalAt: string;
  flightInstanceId: string;
  passenger: { fullName: string; seatCode: string | null } | null;
}

export interface FlightSearchResult {
  flightInstanceId: string;
  flightNo: string;
  aircraftType: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  arrivalAt: string;
  priceIrr: string;
  seatsLeft: number;
}

export interface ReservationFlightRow {
  flightInstanceId: string;
  flightNo: string;
  aircraftType: string;
  originCode: string;
  destCode: string;
  originCityFa: string;
  destCityFa: string;
  departureAt: string;
  capacity: number;
  soldCount: number;
  lockedCount: number;
  freeCount: number;
}

export interface ReservationDashboardStats {
  todayBookings: number;
  activePnrs: number;
  seatsSold: number;
  revenueIrr: string;
}
