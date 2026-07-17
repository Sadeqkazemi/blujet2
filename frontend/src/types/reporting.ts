export type SalesGranularity = 'day' | 'month' | 'q3' | 'q6' | 'year' | 'flight';

export interface SalesChartPeriod {
  periodKey: string;
  startDate: string;
  endDate: string;
  systemIrr: number;
  charterIrr: number;
  agencyIrr: number;
}

export interface KpiResult {
  revenueIrr: number;
  profitIrr: number;
  marginPct: number;
  operatingCostIrr: number;
  agencyDebtIrr: number;
  agencyDebtCount: number;
}

export interface CompletedFlightsSummary {
  flightCount: number;
  totalSeats: number;
  soldSeats: number;
  unsoldSeats: number;
}

export interface LowSalesAlert {
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  capacity: number;
  soldSeats: number;
  occupancyPct: number;
}

export interface PeriodQuery {
  granularity: SalesGranularity;
  periodStart?: string;
  date?: string;
  flightNo?: string;
  periodKey?: string;
}
