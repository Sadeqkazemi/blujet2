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

// ── Phase 11 ──────────────────────────────────────────────────────────

export type LedgerType = 'SALE' | 'REFUND' | 'SETTLEMENT' | 'COMMISSION';

export interface RecentTransaction {
  id: string;
  type: LedgerType;
  titleFa: string;
  party: string;
  occurredAt: string;
  signedAmountIrr: number;
}

export interface RecentTransactionsResult {
  rows: RecentTransaction[];
  totalCount: number;
}

export interface RevenueMixChannel {
  channel: 'SYSTEM' | 'CHARTER' | 'AGENCY';
  labelFa: string;
  amountIrr: number;
  pct: number;
}

export interface RevenueMixResult {
  totalIrr: number;
  channels: RevenueMixChannel[];
}

export type SettlementStatus = 'SETTLED' | 'PENDING' | 'OVERDUE';

export interface AgencySettlementRow {
  agencyId: string;
  agencyName: string;
  totalIrr: number;
  paidIrr: number;
  paidPct: number;
  dueAt: string | null;
  overdueDays: number;
  status: SettlementStatus;
  remindInvoiceId: string | null;
}

export interface AgencySettlementsResult {
  rows: AgencySettlementRow[];
  outstandingIrr: number;
}

export interface PassengerReportHit {
  fullName: string;
  maskedNationalId: string | null;
  pnr: string;
  status: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  seatCode: string | null;
  cabin: 'BUSINESS' | 'ECONOMY' | null;
  priceIrr: number;
}

export interface StaffReportsResult {
  staff: { id: string; fullName: string; rank: string | null; isActive: boolean; createdAt: string }[];
  reports: {
    id: string;
    action: string;
    category: string;
    detail: string;
    staffId: string;
    staffName: string;
    at: string;
  }[];
  newEmployeeEvents: { id: string; detail: string; at: string }[];
}
