export type SalesGranularity = 'day' | 'month' | 'q3' | 'q6' | 'year' | 'flight';

// Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON on
// the backend — a JS number can't safely hold IRR amounts above 2^53).
export interface SalesChartPeriod {
  periodKey: string;
  startDate: string;
  endDate: string;
  systemIrr: string;
  charterIrr: string;
  agencyIrr: string;
}

export interface KpiTrends {
  revenuePct: number;
  profitPct: number;
  operatingCostPct: number;
  agencyDebtPct: number;
}

export interface CommercialOverview {
  activeAgencies: number;
  passengersThisMonth: number;
  pendingAgencyRequests: number;
}

export interface KpiResult {
  revenueIrr: string;
  profitIrr: string;
  marginPct: number;
  operatingCostIrr: string;
  agencyDebtIrr: string;
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
  revenueThisMonthIrr: string;
  revenueTrendPct: number;
}

export interface CompletedFlightsSummary {
  flightCount: number;
  totalSeats: number;
  soldSeats: number;
  unsoldSeats: number;
}

export interface FlightSalesRow {
  flightInstanceId: string;
  flightNo: string;
  originCode: string;
  destCode: string;
  originCityFa: string;
  destCityFa: string;
  departureAt: string;
  systemIrr: string;
  charterIrr: string;
  agencyIrr: string;
  totalIrr: string;
  capacity: number;
  soldSeats: number;
}

export interface FlightSalesResult {
  rows: FlightSalesRow[];
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

export type TransactionStatusTone = 'success' | 'warning' | 'danger';

export interface RecentTransaction {
  id: string;
  type: LedgerType;
  titleFa: string;
  party: string;
  occurredAt: string;
  signedAmountIrr: string;
  statusFa: string;
  statusTone: TransactionStatusTone;
}

export interface RecentTransactionsResult {
  rows: RecentTransaction[];
  totalCount: number;
}

export interface RevenueMixChannel {
  channel: 'SYSTEM' | 'CHARTER' | 'AGENCY';
  labelFa: string;
  amountIrr: string;
  pct: number;
}

export interface RevenueMixResult {
  totalIrr: string;
  channels: RevenueMixChannel[];
}

export type SettlementStatus = 'SETTLED' | 'PENDING' | 'OVERDUE';

export interface AgencySettlementRow {
  agencyId: string;
  agencyName: string;
  totalIrr: string;
  paidIrr: string;
  paidPct: number;
  dueAt: string | null;
  overdueDays: number;
  status: SettlementStatus;
  remindInvoiceId: string | null;
}

export interface AgencySettlementsResult {
  rows: AgencySettlementRow[];
  outstandingIrr: string;
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
  priceIrr: string;
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
