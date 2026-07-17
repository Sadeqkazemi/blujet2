import type { CompletedFlightsSummary, KpiResult } from './reporting';

export interface FinanceSummary {
  kpis: KpiResult;
  seats: CompletedFlightsSummary;
  donut: { SYSTEM: number; CHARTER: number; AGENCY: number };
}

export type LedgerTxType =
  | 'SALE'
  | 'SETTLEMENT'
  | 'REFUND'
  | 'COMMISSION'
  | 'OPERATING_COST';

export interface FinanceTransaction {
  id: string;
  type: LedgerTxType;
  labelFa: string;
  direction: 'IN' | 'OUT';
  party: string;
  amountIrr: number;
  signedAmountIrr: number;
  occurredAt: string;
}

export interface SettlementRow {
  id: string;
  invoiceNo: string;
  agencyName: string;
  amountIrr: number;
  dueAt: string;
  issuedAt: string;
  status: 'SETTLED' | 'PENDING' | 'OVERDUE';
  overdueDays: number;
  paidPct: number;
}

export interface SettlementsResult {
  rows: SettlementRow[];
  outstandingIrr: number;
}

export interface PassengerReportRow {
  id: string;
  fullName: string;
  seatCode: string | null;
  pnr: string;
  status: string;
  priceIrr: number;
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
}

export interface PassengerReportResult {
  results: PassengerReportRow[];
  quickNames: string[];
}

export interface StaffReportResult {
  employees: { id: string; fullName: string; dept: string | null; rank: string | null }[];
  reports: {
    id: string;
    employeeId: string;
    category: string;
    action: string;
    detail: string;
    at: string;
  }[];
  notices: { id: string; text: string; at: string }[];
}
