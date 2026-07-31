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
  systemIrr: number;
  charterIrr: number;
  agencyIrr: number;
}

export interface KpiTrends {
  revenuePct: number;
  profitPct: number;
  operatingCostPct: number;
  agencyDebtPct: number;
}

export interface KpiResult {
  revenueIrr: number;
  profitIrr: number;
  marginPct: number;
  operatingCostIrr: number;
  agencyDebtIrr: number;
  agencyDebtCount: number;
  trends: KpiTrends;
}

export interface FinanceDashboardStats {
  activeAgencies: number;
  activeAgenciesTrendPct: number;
  passengersThisMonth: number;
  passengersTrendPct: number;
  ticketsSoldThisMonth: number;
  ticketsTrendPct: number;
  revenueThisMonthIrr: number;
  revenueTrendPct: number;
}

export type TransactionStatusTone = 'success' | 'warning' | 'danger';

export interface CompletedFlightsSummary {
  flightCount: number;
  totalSeats: number;
  soldSeats: number;
  unsoldSeats: number;
}
