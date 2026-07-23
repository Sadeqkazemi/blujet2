import { apiGet, apiPatch, apiPost } from './http';
import type {
  Airport,
  BookingDetail,
  PayResult,
  RefundRequestView,
  SearchFlightResult,
  SeatMapResult,
  UserProfile,
} from '../types/public-site';

export function fetchAirports() {
  return apiGet<Airport[]>('/search/airports');
}

export function searchFlights(origin: string, dest: string, date: string) {
  const q = new URLSearchParams({ origin, dest, date });
  return apiGet<SearchFlightResult[]>(`/search/flights?${q.toString()}`);
}

export function fetchSeatMap(flightInstanceId: string) {
  return apiGet<SeatMapResult>(`/search/flights/${flightInstanceId}/seatmap`);
}

export interface CreateBookingPassenger {
  fullName: string;
  nationalId?: string;
  mobile?: string;
  seatCode: string;
}

export function createBooking(dto: {
  flightInstanceId: string;
  cabin: 'ECONOMY' | 'BUSINESS';
  passengers: CreateBookingPassenger[];
}) {
  return apiPost<BookingDetail>('/bookings', dto);
}

export function fetchMyBooking(id: string) {
  return apiGet<BookingDetail>(`/bookings/${id}`);
}

export function fetchMyBookings() {
  return apiGet<BookingDetail[]>('/bookings/me');
}

export function fetchBookingByPnr(pnr: string) {
  return apiGet<BookingDetail>(`/bookings/pnr/${pnr}`);
}

export interface PayOptions {
  confirmedPriceIrr?: number;
  promoCode?: string;
  paymentMethod?: 'GATEWAY' | 'WALLET' | 'POINTS';
}

export function payBooking(id: string, options: PayOptions = {}) {
  return apiPost<PayResult>(`/bookings/${id}/pay`, options);
}

export function submitRefund(bookingId: string, iban: string) {
  return apiPost<RefundRequestView>('/my/refunds', { bookingId, iban });
}

export function fetchMyRefunds() {
  return apiGet<RefundRequestView[]>('/my/refunds');
}

export function fetchWallet() {
  return apiGet<{ balanceIrr: number }>('/my/wallet');
}

export function topupWallet(amountIrr: number) {
  return apiPost<{ balanceIrr: number }>('/my/wallet/topup', { amountIrr });
}

export function fetchClubPoints() {
  return apiGet<{ isMember: boolean; level: string | null; balance: number }>('/my/club-points');
}

export function fetchMyProfile() {
  return apiGet<UserProfile>('/my/profile');
}

export function updateMyProfile(dto: {
  fullName?: string;
  nationalId?: string;
  birthDate?: string;
  passportNo?: string;
}) {
  return apiPatch<UserProfile>('/my/profile', dto);
}

export function requestEmailVerify() {
  return apiPost<{ challengeId: string }>('/my/profile/email/verify-request');
}

export function verifyEmail(challengeId: string, code: string) {
  return apiPost<{ verified: true }>('/my/profile/email/verify', { challengeId, code });
}
