import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './http';
import type {
  Airport,
  BookingDetail,
  CabinClass,
  PayResult,
  PriceLock,
  CustomerRefundRule,
  EligibleRefundBooking,
  RefundPreview,
  RefundRequestView,
  SavedFlight,
  SavedPassenger,
  SavedBankAccount,
  CustomerReferralDashboard,
  CustomerIdentityView,
  ActiveSession,
  SearchFlightResult,
  SeatMapResult,
  UserProfile,
} from '../types/public-site';
import type { ClubCardRequestView, ClubMembershipView } from '../types/club-membership';

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

export function fetchEligibleRefundBookings() {
  return apiGet<EligibleRefundBooking[]>('/my/refunds/eligible-bookings');
}

export function fetchCustomerRefundRules() {
  return apiGet<CustomerRefundRule[]>('/my/refunds/rules');
}

export function previewRefund(bookingId: string) {
  return apiPost<RefundPreview>('/my/refunds/preview', { bookingId });
}

// مدیریت رزرو — anonymous PNR + last-name self-service (no login), a
// separate public surface from the authenticated endpoints above.
export function lookupBookingByPnrAndLastName(pnr: string, lastName: string) {
  return apiPost<BookingDetail>('/manage-booking/lookup', { pnr, lastName });
}

export function submitAnonymousRefund(pnr: string, lastName: string, iban: string) {
  return apiPost<RefundRequestView>('/manage-booking/refund', {
    pnr,
    lastName,
    iban,
  });
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

export function fetchClubMembership() {
  return apiGet<ClubMembershipView>('/my/club/membership');
}

export function submitClubCardRequest() {
  return apiPost<ClubCardRequestView>('/my/club/card-request', {});
}

export function fetchMyPriceLocks() {
  return apiGet<PriceLock[]>('/my/price-locks');
}

export function createPriceLock(flightInstanceId: string, cabin: CabinClass) {
  return apiPost<PriceLock>('/my/price-locks', { flightInstanceId, cabin });
}

export function cancelPriceLock(id: string) {
  return apiDelete<PriceLock>(`/my/price-locks/${id}`);
}

export function fetchSavedFlights() {
  return apiGet<SavedFlight[]>('/my/saved-flights');
}

export function saveFlight(flightInstanceId: string, cabin: CabinClass) {
  return apiPost<SavedFlight>('/my/saved-flights', { flightInstanceId, cabin });
}

export function removeSavedFlight(id: string) {
  return apiDelete<{ removed: boolean }>(`/my/saved-flights/${id}`);
}

export function fetchSavedPassengers() {
  return apiGet<SavedPassenger[]>('/my/saved-passengers');
}

export function createSavedPassenger(dto: {
  fullName: string;
  latinName: string;
  nationalId?: string;
  passportNo?: string;
  mobile?: string;
  isChild?: boolean;
}) {
  return apiPost<SavedPassenger>('/my/saved-passengers', dto);
}

export function updateSavedPassenger(
  id: string,
  dto: {
    fullName?: string;
    latinName?: string;
    nationalId?: string | null;
    passportNo?: string | null;
    mobile?: string | null;
    isChild?: boolean;
  },
) {
  return apiPatch<SavedPassenger>(`/my/saved-passengers/${id}`, dto);
}

export function removeSavedPassenger(id: string) {
  return apiDelete<{ removed: boolean }>(`/my/saved-passengers/${id}`);
}

export function fetchBankAccounts() {
  return apiGet<SavedBankAccount[]>('/my/bank-accounts');
}

export function createBankAccount(dto: { cardNo: string; sheba: string; bankName?: string }) {
  return apiPost<SavedBankAccount>('/my/bank-accounts', dto);
}

export function updateBankAccount(id: string, dto: { isDefault?: boolean }) {
  return apiPatch<SavedBankAccount>(`/my/bank-accounts/${id}`, dto);
}

export function removeBankAccount(id: string) {
  return apiDelete<{ removed: boolean }>(`/my/bank-accounts/${id}`);
}

export function fetchMyReferral() {
  return apiGet<CustomerReferralDashboard>('/my/referral');
}

export function fetchMyIdentity() {
  return apiGet<CustomerIdentityView>('/my/identity');
}

export function uploadIdentityIdCard(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiPostForm<{ id: string; fileName: string; sizeBytes: number }>(
    '/my/identity/id-card',
    form,
  );
}

export function submitIdentityVerification() {
  return apiPost<CustomerIdentityView>('/my/identity/submit');
}

export function fetchMySessions() {
  return apiGet<ActiveSession[]>('/my/sessions');
}

export function revokeMySession(id: string) {
  return apiDelete<{ revoked: boolean }>(`/my/sessions/${id}`);
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

export function fetchPrivacyExport() {
  return apiGet<unknown>('/my/privacy/export');
}

export function deleteMyAccount() {
  return apiDelete<{ deleted: true }>('/my/privacy/account');
}
