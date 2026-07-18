import { apiGet, apiPost } from './http';
import type {
  Airport,
  BookingDetail,
  PayResult,
  RefundRequestView,
  SearchFlightResult,
  SeatMapResult,
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

export function fetchBookingByPnr(pnr: string) {
  return apiGet<BookingDetail>(`/bookings/pnr/${pnr}`);
}

export function payBooking(id: string, confirmedPriceIrr?: number) {
  return apiPost<PayResult>(`/bookings/${id}/pay`, confirmedPriceIrr ? { confirmedPriceIrr } : {});
}

export function submitRefund(bookingId: string, iban: string) {
  return apiPost<RefundRequestView>('/my/refunds', { bookingId, iban });
}

export function fetchMyRefunds() {
  return apiGet<RefundRequestView[]>('/my/refunds');
}
