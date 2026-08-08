import { apiGet, apiPatch, apiPost, apiRequest } from './http';
import type {
  AircraftDefinition,
  AircraftDefinitionListItem,
  UpsertAircraftDefinitionPayload,
} from '../types/aircraft';

/**
 * Expected aircraft-definition admin API (not all routes exist yet).
 * Existing today: GET /flights/aircraft-types → { aircraftType, capacity }[]
 * Missing: CRUD detail/seat-map write endpoints — UI calls these and surfaces errors.
 */

export function fetchAircraftDefinitions() {
  return apiGet<AircraftDefinitionListItem[]>('/flights/aircraft-definitions');
}

export function fetchAircraftDefinition(id: string) {
  return apiGet<AircraftDefinition>(`/flights/aircraft-definitions/${id}`);
}

export function createAircraftDefinition(payload: UpsertAircraftDefinitionPayload) {
  return apiPost<AircraftDefinition>('/flights/aircraft-definitions', payload);
}

export function updateAircraftDefinition(
  id: string,
  payload: UpsertAircraftDefinitionPayload,
) {
  return apiRequest<AircraftDefinition>(`/flights/aircraft-definitions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function patchAircraftDefinitionStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  return apiPatch<AircraftDefinition>(`/flights/aircraft-definitions/${id}/status`, {
    status,
  });
}

/** Cabin + seat-map detail for an aircraft type code (used by Add Flight). */
export function fetchAircraftTypeDetail(aircraftType: string) {
  return apiGet<AircraftDefinition>(
    `/flights/aircraft-types/${encodeURIComponent(aircraftType)}`,
  );
}
