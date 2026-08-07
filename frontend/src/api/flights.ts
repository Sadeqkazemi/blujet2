import { apiGet, apiPatch, apiPost, apiDelete } from './http';
import type {
  AircraftTypeOption,
  AirportEntry,
  AllotmentRow,
  CreateFareRulePayload,
  FareRuleRow,
  FlightDetail,
  FlightRow,
  FlightsOverview,
  PlanResult,
  UpdateFareRulePayload,
} from '../types/flights';

export function fetchFlightsOverview() {
  return apiGet<FlightsOverview>('/flights/overview');
}

export function fetchAirports() {
  return apiGet<AirportEntry[]>('/flights/airports');
}

export function createAirport(payload: { cityFa: string; code: string; tz?: string }) {
  return apiPost<AirportEntry>('/flights/airports', payload);
}

export function deleteAirport(id: string) {
  return apiDelete<{ id: string }>(`/flights/airports/${id}`);
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
  aircraftType?: string;
  charterSeats?: number;
}

export function createFlight(payload: CreateFlightPayload) {
  return apiPost<FlightRow>('/flights', payload);
}

export function fetchFlightDetail(id: string) {
  return apiGet<FlightDetail>(`/flights/${id}`);
}

export function planFlight(
  id: string,
  payload: {
    priceIrr: number;
    agencySeats: number;
    saleStartsAt?: string;
    saleEndsAt?: string;
  },
) {
  return apiPatch<PlanResult>(`/flights/${id}/plan`, payload);
}

export function changeFlightAircraft(
  id: string,
  aircraftType: string,
  stepUp: { stepUpChallengeId: string; stepUpCode: string },
) {
  return apiPatch<{ id: string; aircraftType: string; capacity: number }>(`/flights/${id}/aircraft`, {
    aircraftType,
    ...stepUp,
  });
}

export function runFlightsAiAnalysis() {
  return apiPost<{ analyzed: number; available: boolean }>('/flights/ai-analysis');
}

export function fetchAllotments(instanceId: string) {
  return apiGet<AllotmentRow[]>(`/flights/${instanceId}/allotments`);
}

export function createAllotment(
  instanceId: string,
  dto: {
    agencyId: string;
    seatsAllocated: number;
    type?: 'SOFT' | 'HARD';
    releaseAt?: string;
    contractPriceIrr?: number;
  },
) {
  return apiPost<AllotmentRow>(`/flights/${instanceId}/allotments`, dto);
}

export function deleteAllotment(instanceId: string, allotmentId: string) {
  return apiDelete<{ id: string }>(`/flights/${instanceId}/allotments/${allotmentId}`);
}

export function fetchFareRules(instanceId: string) {
  return apiGet<FareRuleRow[]>(`/flights/${instanceId}/fare-rules`);
}

export function createFareRule(instanceId: string, dto: CreateFareRulePayload) {
  return apiPost<FareRuleRow>(`/flights/${instanceId}/fare-rules`, dto);
}

export function updateFareRule(instanceId: string, ruleId: string, dto: UpdateFareRulePayload) {
  return apiPatch<FareRuleRow>(`/flights/${instanceId}/fare-rules/${ruleId}`, dto);
}

export function deleteFareRule(instanceId: string, ruleId: string) {
  return apiDelete<{ success: boolean }>(`/flights/${instanceId}/fare-rules/${ruleId}`);
}
