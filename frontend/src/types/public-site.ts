export interface Airport {
  id: string;
  code: string;
  cityFa: string;
  tz: string;
}

export type CabinClass = 'ECONOMY' | 'BUSINESS';

export interface SearchCabinOption {
  cabin: CabinClass;
  priceIrr: number;
  seatsLeft: number;
}

export interface SearchFlightResult {
  flightInstanceId: string;
  flightNo: string;
  aircraftType: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  arrivalAt: string;
  cabins: SearchCabinOption[];
}

export type SeatStatus = 'FREE' | 'TAKEN';

export interface SeatMapCell {
  seatCode: string;
  row: number;
  cabin: CabinClass;
  status: SeatStatus;
}

export interface SeatMapResult {
  flightInstanceId: string;
  seats: SeatMapCell[];
}

export type BookingStatus = 'DRAFT' | 'HELD' | 'PAID' | 'TICKETED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

export interface BookingPassengerView {
  fullName: string;
  seatCode: string | null;
}

export interface BookingDetail {
  id: string;
  pnr: string;
  status: BookingStatus;
  cabin: CabinClass;
  priceIrr: number;
  holdExpiresAt: string | null;
  flightInstanceId: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  arrivalAt: string;
  isPriceLocked: boolean;
  passengers: BookingPassengerView[];
}

export type PriceLockStatus = 'ACTIVE' | 'CANCELLED' | 'USED';

export interface PriceLock {
  id: string;
  flightInstanceId: string;
  cabin: CabinClass;
  lockedPriceIrr: number;
  feeIrr: number;
  status: PriceLockStatus;
  expiresAt: string;
  createdAt: string;
  bookingId: string | null;
  flight: {
    flightNo: string;
    originCode: string;
    destCode: string;
    departureAt: string;
  };
}

export interface SavedFlight {
  id: string;
  flightInstanceId: string;
  cabin: CabinClass;
  flightNo: string;
  originCode: string;
  destCode: string;
  originCityFa: string;
  destCityFa: string;
  departureAt: string;
  arrivalAt: string;
  priceIrr: number;
  bookable: boolean;
  createdAt: string;
}

export interface SavedPassenger {
  id: string;
  fullName: string;
  latinName: string;
  nationalId: string | null;
  passportNo: string | null;
  mobile: string | null;
  isChild: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  id: string;
  deviceLabel: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface SavedBankAccount {
  id: string;
  bankName: string;
  bankShort: string;
  brandColor: string;
  cardMasked: string | null;
  sheba: string;
  shebaMasked: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayResultOk {
  priceChanged: false;
  booking: BookingDetail;
}

export interface PayResultPriceChanged {
  priceChanged: true;
  previousPriceIrr: number;
  currentPriceIrr: number;
}

export type PayResult = PayResultOk | PayResultPriceChanged;

export interface RefundRequestView {
  id: string;
  bookingId: string;
  status: 'SUBMITTED' | 'REVIEW' | 'FINANCE' | 'PAID';
  penaltyPct: number;
  penaltyAmountIrr: number;
  refundableIrr: number;
  totalPaidIrr: number;
  createdAt: string;
}

export interface UserProfile {
  fullName: string;
  nationalId: string | null;
  birthDate: string | null;
  passportNo: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  completionPct: number;
}
