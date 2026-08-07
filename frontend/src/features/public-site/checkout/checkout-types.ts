import type { CabinClass } from '../../../types/public-site';
import type { PublicTravelCost, TravelExtraBillingUnit, TravelExtraCode } from '../../../types/travel-costs';

export interface FlightSnapshot {
  flightInstanceId: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  arrivalAt: string;
  aircraftType?: string;
  priceIrr: string;
}

export interface CheckoutDraft {
  flightInstanceId: string;
  cabin: CabinClass;
  selectedSeats: string[];
  flight: FlightSnapshot;
}

export type DocType = 'NATIONAL_ID' | 'PASSPORT';
export type Gender = '' | 'male' | 'female';

export interface PassengerFormDraft {
  firstNameLatin: string;
  lastNameLatin: string;
  gender: Gender;
  docType: DocType;
  nationalId: string;
  passportNo: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  seatCode: string;
}

export interface ExtraServiceState {
  id: string;
  code: TravelExtraCode;
  titleFa: string;
  titleEn: string | null;
  titleAr: string | null;
  descriptionFa: string | null;
  billingUnit: TravelExtraBillingUnit;
  priceIrr: string;
  selected: boolean;
  quantity: number;
}

export type CheckoutWizardStep = 'pax' | 'extras' | 'review';

export function emptyPassenger(seatCode: string): PassengerFormDraft {
  return {
    firstNameLatin: '',
    lastNameLatin: '',
    gender: '',
    docType: 'NATIONAL_ID',
    nationalId: '',
    passportNo: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    seatCode,
  };
}

export function passengerFullName(p: PassengerFormDraft): string {
  return `${p.firstNameLatin.trim()} ${p.lastNameLatin.trim()}`.trim();
}

export function toExtraState(value: PublicTravelCost): ExtraServiceState {
  return { ...value, selected: false, quantity: 1 };
}

export function extraTitle(extra: ExtraServiceState, locale: 'fa' | 'en' | 'ar'): string {
  if (locale === 'en') return extra.titleEn || extra.titleFa;
  if (locale === 'ar') return extra.titleAr || extra.titleFa;
  return extra.titleFa;
}

export function extraTotalIrr(extra: ExtraServiceState, passengerCount: number): bigint {
  const quantity = extra.billingUnit === 'PER_PASSENGER' ? Math.max(1, passengerCount) : Math.max(1, extra.quantity);
  return BigInt(extra.priceIrr) * BigInt(quantity);
}
