export interface Airport {
  id: string;
  code: string;
  cityFa: string;
  tz: string;
}

export type CabinClass = 'ECONOMY' | 'BUSINESS';

export interface SearchCabinOption {
  cabin: CabinClass;
  // Decimal STRING on the wire (BigInt.prototype.toJSON on the backend).
  priceIrr: string;
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
  connection?: {
    via: string;
    legs: {
      flightInstanceId: string;
      flightNo: string;
      originCode: string;
      destCode: string;
      departureAt: string;
      arrivalAt: string;
    }[];
  };
}

export type SearchAdvisoryRecommendation = 'buy' | 'wait';

export interface SearchAdvisoryResult {
  available: boolean;
  recommendation?: SearchAdvisoryRecommendation;
  reasonFa?: string;
  predictedPriceIrr?: string;
  confidence?: number;
  modelVersion?: string;
  cheapestDayLabel?: string;
  priceIncreaseProbPct?: number;
}

export interface PriceCalendarDay {
  date: string;
  minPriceIrr: string;
  dateLabelFa: string;
  isCenter: boolean;
}

export type PriceAdvisoryRecommendation = 'BUY_NOW' | 'WAIT';

export type PriceAdvisoryResult =
  | { available: false; reason: 'ADVISORY_UNAVAILABLE' }
  | {
      available: true;
      recommendation: PriceAdvisoryRecommendation;
      explanationFa: string;
      modelVersion: string;
      confidence: number;
    };

export type SeatStatus = 'FREE' | 'TAKEN';

export interface SeatMapCell {
  seatCode: string;
  row: number;
  cabin: CabinClass;
  status: SeatStatus;
}

export interface SeatMapCabinLayout {
  colsLeft: string[];
  colsRight: string[];
  aisleAfterIndex: number;
}

export interface SeatMapResult {
  flightInstanceId: string;
  aircraftType?: string;
  cabinLayout?: {
    BUSINESS: SeatMapCabinLayout;
    ECONOMY: SeatMapCabinLayout;
  };
  excludedSeatCodes?: string[];
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
  priceIrr: string;
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
  lockedPriceIrr: string;
  feeIrr: string;
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
  priceIrr: string;
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

export type CustomerReferralStatus = 'SIGNED_UP' | 'BOOKED' | 'REWARDED';

export interface CustomerReferralInvite {
  id: string;
  fullName: string;
  joinedAt: string;
  status: CustomerReferralStatus;
  pointsAwarded: number;
}

export interface CustomerReferralDashboard {
  referralCode: string;
  sharePath: string;
  stats: {
    invitedCount: number;
    pointsEarned: number;
    successfulBookings: number;
  };
  invites: CustomerReferralInvite[];
}

export type CustomerIdentityStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

export interface CustomerIdentityView {
  status: CustomerIdentityStatus;
  isComplete: boolean;
  canSubmit: boolean;
  submittedAt: string | null;
  rejectReason: string | null;
  steps: { key: 'profile' | 'id_card'; done: boolean }[];
  idCardFile: { id: string; fileName: string; sizeBytes: number } | null;
}

export interface PayResultOk {
  priceChanged: false;
  booking: BookingDetail;
}

export interface PayResultPriceChanged {
  priceChanged: true;
  previousPriceIrr: string;
  currentPriceIrr: string;
}

export type PayResult = PayResultOk | PayResultPriceChanged;

export interface RefundRequestView {
  id: string;
  trackingCode: string;
  bookingId: string;
  pnr: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  status: 'SUBMITTED' | 'REVIEW' | 'FINANCE' | 'PAID';
  penaltyPct: number;
  penaltyAmountIrr: string;
  refundableIrr: string;
  totalPaidIrr: string;
  history: { step: string; labelFa: string; at: string }[];
  createdAt: string;
  paidAt: string | null;
}

export interface EligibleRefundBooking {
  bookingId: string;
  pnr: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  totalPaidIrr: string;
  hoursLeft: number;
  penaltyPct: number;
  penaltyAmountIrr: string;
  refundableIrr: string;
  refundable: boolean;
}

export interface CustomerRefundRule {
  minHoursBeforeDeparture: number;
  penaltyPct: number;
  labelFa: string;
  isRefundable: boolean;
}

export interface RefundPreview {
  bookingId: string;
  totalPaidIrr: string;
  hoursLeft: number;
  penaltyPct: number;
  penaltyAmountIrr: string;
  refundableIrr: string;
  refundable: boolean;
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
