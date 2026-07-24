import { apiGet, apiPatch, apiPost, apiDelete } from './http';
import type {
  AircraftTypeOption,
  AirportEntry,
  AllotmentRow,
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

export function fetchAircraftTypes() {
  return apiGet<AircraftTypeOption[]>('/flights/aircraft-types');
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

export function changeFlightAircraft(
  id: string,
  aircraftType: string,
  stepUp: { stepUpChallengeId: string; stepUpCode: string },
) {
  return apiPatch<{ id: string; aircraftType: string; capacity: number }>(
    `/flights/${id}/aircraft`,
    { aircraftType, ...stepUp },
  );
}

export function runFlightsAiAnalysis() {
  return apiPost<{ analyzed: number; available: boolean }>('/flights/ai-analysis');
}

export function fetchAllotments(instanceId: string) {
  return apiGet<AllotmentRow[]>(`/flights/${instanceId}/allotments`);
}

export function createAllotment(
  instanceId: string,
  dto: { agencyId: string; seatsAllocated: number },
) {
  return apiPost<AllotmentRow>(`/flights/${instanceId}/allotments`, dto);
}

export function deleteAllotment(instanceId: string, allotmentId: string) {
  return apiDelete<{ id: string }>(`/flights/${instanceId}/allotments/${allotmentId}`);
}
