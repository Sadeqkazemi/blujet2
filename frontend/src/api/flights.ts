import { apiGet, apiPatch, apiPost } from './http';
import type {
  AirportEntry,
  FlightDetail,
  FlightRow,
  FlightsOverview,
  PlanResult,
} from '../types/flights';

export function fetchFlightsOverview() {
  return apiGet<FlightsOverview>('/flights/overview');
}

export function fetchAirports() {
  return apiGet<AirportEntry[]>('/flights/airports');
}

export interface CreateFlightPayload {
  originCode: string;
  destCode: string;
  flightNo: string;
  departureAt: string;
  capacity: number;
  basePriceIrr: number;
}

export function createFlight(payload: CreateFlightPayload) {
  return apiPost<FlightRow>('/flights', payload);
}

export function fetchFlightDetail(id: string) {
  return apiGet<FlightDetail>(`/flights/${id}`);
}

export function planFlight(id: string, priceIrr: number, agencySeats: number) {
  return apiPatch<PlanResult>(`/flights/${id}/plan`, { priceIrr, agencySeats });
}

export function runFlightsAiAnalysis() {
  return apiPost<{ analyzed: number; available: boolean }>('/flights/ai-analysis');
}
