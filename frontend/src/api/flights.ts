import { apiGet, apiPatch, apiPost, apiDelete, apiRequest } from "./http";
import type {
  AircraftTypeOption,
  AirportEntry,
  AllotmentRow,
  CreateFareRulePayload,
  CreateFlightDefinitionPayload,
  FareRuleRow,
  FlightDefinitionDetail,
  FlightDetail,
  FlightRow,
  FlightsOverview,
  PlanResult,
  UpdateFareRulePayload,
  UpdateFlightDefinitionPayload,
} from "../types/flights";

export function fetchFlightsOverview() {
  return apiGet<FlightsOverview>("/flights/overview");
}

export function fetchAirports() {
  return apiGet<AirportEntry[]>("/flights/airports");
}

export function createAirport(payload: {
  cityFa: string;
  code: string;
  airportNameFa?: string;
  tz?: string;
}) {
  return apiPost<AirportEntry>("/flights/airports", payload);
}

export function deleteAirport(id: string) {
  return apiDelete<{ id: string }>(`/flights/airports/${id}`);
}

export function fetchAircraftTypes() {
  return apiGet<AircraftTypeOption[]>("/flights/aircraft-types");
}

export interface CreateFlightPayload extends CreateFlightDefinitionPayload {}

export function createFlight(payload: CreateFlightPayload) {
  return apiPost<FlightRow>("/flights", payload);
}

/** Expected: GET /flights/:id/definition — full editable flight definition. */
export function fetchFlightDefinition(id: string) {
  return apiGet<FlightDefinitionDetail>(`/flights/${id}/definition`);
}

/** Expected: PUT /flights/:id/definition — create/update specs (may open CEO revision). */
export function updateFlightDefinition(
  id: string,
  payload: UpdateFlightDefinitionPayload,
) {
  return apiRequest<FlightDefinitionDetail>(`/flights/${id}/definition`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function fetchFlightDetail(id: string) {
  return apiGet<FlightDetail>(`/flights/${id}`);
}

export function planFlight(
  id: string,
  payload: {
    priceIrr: string | number;
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
  return apiPost<{ analyzed: number; available: boolean }>(
    "/flights/ai-analysis",
  );
}

export function fetchAllotments(instanceId: string) {
  return apiGet<AllotmentRow[]>(`/flights/${instanceId}/allotments`);
}

export function createAllotment(
  instanceId: string,
  dto: {
    agencyId: string;
    seatsAllocated: number;
    type?: "SOFT" | "HARD";
    releaseAt?: string;
    contractPriceIrr?: string | number;
  },
) {
  return apiPost<AllotmentRow>(`/flights/${instanceId}/allotments`, dto);
}

export function deleteAllotment(instanceId: string, allotmentId: string) {
  return apiDelete<{ id: string }>(
    `/flights/${instanceId}/allotments/${allotmentId}`,
  );
}

/** Unified charter + agency commitments (PR #126 contract). */
export function fetchCommitments(instanceId: string) {
  return apiGet<import("../types/commitments").CommitmentRow[]>(
    `/flights/${instanceId}/commitments`,
  );
}

export function fetchCommitmentsSummary(instanceId: string) {
  return apiGet<import("../types/commitments").CommitmentsSummary>(
    `/flights/${instanceId}/commitments/summary`,
  );
}

export function createCommitment(
  instanceId: string,
  dto: import("../types/commitments").CreateCommitmentPayload,
) {
  return apiPost<import("../types/commitments").CommitmentRow>(
    `/flights/${instanceId}/commitments`,
    dto,
  );
}

export function deleteCommitment(instanceId: string, commitmentId: string) {
  return apiDelete<import("../types/commitments").CommitmentRow>(
    `/flights/${instanceId}/commitments/${commitmentId}`,
  );
}

export function fetchFareRules(instanceId: string) {
  return apiGet<FareRuleRow[]>(`/flights/${instanceId}/fare-rules`);
}

export function createFareRule(instanceId: string, dto: CreateFareRulePayload) {
  return apiPost<FareRuleRow>(`/flights/${instanceId}/fare-rules`, dto);
}

export function updateFareRule(
  instanceId: string,
  ruleId: string,
  dto: UpdateFareRulePayload,
) {
  return apiPatch<FareRuleRow>(
    `/flights/${instanceId}/fare-rules/${ruleId}`,
    dto,
  );
}

export function deleteFareRule(instanceId: string, ruleId: string) {
  return apiDelete<{ success: boolean }>(
    `/flights/${instanceId}/fare-rules/${ruleId}`,
  );
}
