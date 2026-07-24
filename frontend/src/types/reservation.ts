export type SeatStatus = 'FREE' | 'SOLD' | 'LOCKED';

export interface SeatCell {
  seatCode: string;
  status: SeatStatus;
  lockId: string | null;
}

export interface SeatRow {
  row: number;
  cabin: 'BUSINESS' | 'ECONOMY';
  seats: SeatCell[];
}

export interface SeatMap {
  flightInstanceId: string;
  aircraftType: string;
  rows: SeatRow[];
  cabinLayout: Record<'BUSINESS' | 'ECONOMY', { aisleAfterIndex: number }>;
  capacity: number;
  soldCount: number;
  lockedCount: number;
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

export type BookingStatus = 'DRAFT' | 'HELD' | 'PAID' | 'TICKETED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

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
  priceIrr: number;
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
  priceIrr: number;
  seatsLeft: number;
}

export interface ReservationDashboardStats {
  todayBookings: number;
  activePnrs: number;
  seatsSold: number;
  revenueIrr: number;
}
