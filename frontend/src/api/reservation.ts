import { apiGet, apiPatch, apiPost } from './http';
import type {
  FlightSearchResult,
  PnrDetail,
  PnrGroup,
  ReservationDashboardStats,
  SeatLockView,
  SeatMap,
} from '../types/reservation';

export function fetchSeatMap(flightInstanceId: string) {
  return apiGet<SeatMap>(`/reservation/seatmap/${flightInstanceId}`);
}

export function lockSeat(
  flightInstanceId: string,
  dto: { seatCode: string; passengerName?: string; passengerNationalId?: string; passengerMobile?: string },
) {
  return apiPost<SeatLockView>(`/reservation/seatmap/${flightInstanceId}/lock`, dto);
}

export function releaseLock(lockId: string) {
  return apiPatch<SeatLockView>(`/reservation/seatmap/locks/${lockId}/release`);
}

export function fetchPnrList(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return apiGet<PnrGroup[]>(`/reservation/pnr${qs}`);
}

export function fetchPnrDetail(pnr: string) {
  return apiGet<PnrDetail>(`/reservation/pnr/${pnr}`);
}

export function changeSeat(pnr: string, seatCode: string) {
  return apiPatch<PnrDetail>(`/reservation/pnr/${pnr}/seat`, { seatCode });
}

export function cancelBooking(pnr: string) {
  return apiPatch<PnrDetail>(`/reservation/pnr/${pnr}/cancel`);
}

export function searchFlights(origin: string, dest: string, date: string) {
  const params = new URLSearchParams({ origin, dest, date });
  return apiGet<FlightSearchResult[]>(`/reservation/search?${params.toString()}`);
}

export function issuePnr(dto: {
  flightInstanceId: string;
  seatCode: string;
  passengerName: string;
  passengerNationalId?: string;
  passengerMobile?: string;
}) {
  return apiPost<PnrDetail>('/reservation/pnr', dto);
}

export function fetchReservationDashboardStats() {
  return apiGet<ReservationDashboardStats>('/reservation/dashboard-stats');
}
