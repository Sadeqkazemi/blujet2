export type SeatStatus = 'FREE' | 'SOLD' | 'LOCKED';

export interface SeatPassengerInfo {
  fullName: string;
  pnr: string;
  bookingStatus: BookingStatus;
  nationalId: string | null;
  priceIrr: string;
}

export interface SeatCell {
  seatCode: string;
  status: SeatStatus;
  lockId: string | null;
  passenger: SeatPassengerInfo | null;
  lockExpiresAt: string | null;
}

export interface SeatRow {
  row: number;
  cabin: 'BUSINESS' | 'ECONOMY';
  seats: SeatCell[];
}

export interface SeatMap {
  flightInstanceId: string;
  aircraftType: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  originCityFa: string;
  destCityFa: string;
  departureAt: string;
  rows: SeatRow[];
  cabinLayout: Record<'BUSINESS' | 'ECONOMY', { aisleAfterIndex: number }>;
  capacity: number;
  soldCount: number;
  lockedCount: number;
  freeCount: number;
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

export interface ReservationChannelShare {
  key: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

export interface ReservationServiceHealth {
  name: string;
  fa: string;
  ok: boolean;
  latencyMs: number | null;
  statusLabel: string;
}

export interface ReservationDashboardStats {
  todayBookings: number;
  activePnrs: number;
  seatsSold: number;
  revenueIrr: string;
  channels: ReservationChannelShare[];
  services: ReservationServiceHealth[];
  servicesStable: boolean;
}

export interface AgencyApiAccessRow {
  id: string;
  agencyId: string;
  name: string;
  initials: string;
  keyHint: string;
  callCount: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

export type ReservationFlightStatusKey = 'SELLING' | 'NEAR_FULL' | 'FULL';

export interface ReservationFlightRow {
  flightInstanceId: string;
  route: string;
  flightNo: string;
  departureAt: string;
  aircraftType: string;
  sold: number;
  capacity: number;
  occupancyPct: number;
  statusKey: ReservationFlightStatusKey;
}
