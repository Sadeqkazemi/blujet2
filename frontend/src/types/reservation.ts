export type SeatStatus = 'FREE' | 'SOLD' | 'LOCKED';
export type LockClassification = 'FREE' | 'DISCOUNTED' | 'PAYABLE';
export type LockApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

/** Staff-display occupant on a sold/locked seat (national ID always masked). */
export interface SeatOccupant {
  passengerName: string | null;
  maskedNationalId: string | null;
  pnr: string | null;
  statusFa: string;
  departureAt: string;
}

export interface SeatCell {
  seatCode: string;
  status: SeatStatus;
  lockId: string | null;
  /** Present when status is LOCKED — ISO UTC for auto-release countdown. */
  lockExpiresAt?: string | null;
  /** Present when status is LOCKED — FREE ≈ company block; else temp managerial hold. */
  lockClassification?: LockClassification | null;
  /** Present when status is SOLD or LOCKED — passenger / lock display info. */
  occupant?: SeatOccupant | null;
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
  reason?: string;
  classification?: LockClassification;
  discountPct?: number | null;
  approvalStatus?: LockApprovalStatus;
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

export interface ReservationDashboardStats {
  todayBookings: number;
  activePnrs: number;
  seatsSold: number;
  revenueIrr: string;
}
