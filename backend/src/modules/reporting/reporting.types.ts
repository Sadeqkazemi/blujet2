import type { Irr } from '../../common/money';

export type SalesGranularity =
  'day' | 'month' | 'q3' | 'q6' | 'year' | 'flight';

export interface Bucket {
  key: string;
  start: Date;
  end: Date;
}

export interface SalesChartPeriod {
  periodKey: string;
  startDate: string;
  endDate: string;
  systemIrr: Irr;
  charterIrr: Irr;
  agencyIrr: Irr;
}

export interface KpiResult {
  revenueIrr: Irr;
  profitIrr: Irr;
  marginPct: number;
  operatingCostIrr: Irr;
  agencyDebtIrr: Irr;
  agencyDebtCount: number;
}

export interface CompletedFlightsSummary {
  flightCount: number;
  totalSeats: number;
  soldSeats: number;
  unsoldSeats: number;
}
