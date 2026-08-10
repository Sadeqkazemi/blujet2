import type { CabinCapacity } from './flights';

export interface ScheduleTemplatePayload {
  originAirportId: string;
  destinationAirportId: string;
  flightNoBase: string;
  aircraftDefinitionId: string;
  departureTime: string;
  durationMinutes: number;
  startDate: string;
  endDate: string;
  weekdays: number[];
  agencyPriceIrr: string;
  legalCeilingIrr: string;
}

export interface ScheduleTemplatePreview {
  occurrenceCount: number;
  capacity: number;
  cabinCapacities: CabinCapacity[];
  dates: { localDate: string; departureAt: string; arrivalAt: string }[];
}

export interface ScheduleTemplateRow extends ScheduleTemplatePayload {
  id: string;
  originCode?: string;
  destCode?: string;
  aircraftCode?: string;
  cabinCapacities: CabinCapacity[];
  status: 'ACTIVE' | 'DEACTIVATED';
  instanceCount?: number;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

export interface ScheduleTemplateList {
  items: ScheduleTemplateRow[];
  page: number;
  pageSize: number;
  total: number;
}
