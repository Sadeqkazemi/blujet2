import { apiGet, apiPost } from './http';
import type { PeriodQuery } from '../types/reporting';
import type {
  FinanceSummary,
  FinanceTransaction,
  PassengerReportResult,
  SettlementsResult,
  StaffReportResult,
} from '../types/finance';

function toQueryString(query: PeriodQuery): string {
  const params = new URLSearchParams();
  params.set('granularity', query.granularity);
  if (query.periodStart) params.set('periodStart', query.periodStart);
  if (query.date) params.set('date', query.date);
  if (query.flightNo) params.set('flightNo', query.flightNo);
  if (query.periodKey) params.set('periodKey', query.periodKey);
  return params.toString();
}

export function fetchFinanceSummary(query: PeriodQuery) {
  return apiGet<FinanceSummary>(`/finance/summary?${toQueryString(query)}`);
}

export function fetchFinanceTransactions() {
  return apiGet<FinanceTransaction[]>('/finance/transactions');
}

export function fetchSettlements() {
  return apiGet<SettlementsResult>('/finance/settlements');
}

export function remindSettlement(invoiceId: string) {
  return apiPost<{ reminded: boolean; agencyName: string }>(
    `/finance/settlements/${invoiceId}/remind`,
  );
}

export function fetchPassengerReport(q: string) {
  return apiGet<PassengerReportResult>(
    `/reports/passengers?q=${encodeURIComponent(q)}`,
  );
}

export function fetchStaffReport() {
  return apiGet<StaffReportResult>('/reports/staff');
}
