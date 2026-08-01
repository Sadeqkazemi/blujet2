import type { CabinClass } from '../../../types/public-site';

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

export interface ExtraServiceId {
  id: 'baggage' | 'meal' | 'insurance' | 'cip';
}

export interface ExtraServiceState {
  id: ExtraServiceId['id'];
  selected: boolean;
  priceToman: number;
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

export function defaultExtras(): ExtraServiceState[] {
  return [
    { id: 'baggage', selected: false, priceToman: 890_000 },
    { id: 'meal', selected: false, priceToman: 350_000 },
    { id: 'insurance', selected: false, priceToman: 120_000 },
    { id: 'cip', selected: false, priceToman: 2_500_000 },
  ];
}
