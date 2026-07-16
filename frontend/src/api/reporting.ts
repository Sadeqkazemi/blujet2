import { apiGet } from './http';
import type {
  CompletedFlightsSummary,
  KpiResult,
  LowSalesAlert,
  PeriodQuery,
  SalesChartPeriod,
} from '../types/reporting';

function toQueryString(query: PeriodQuery): string {
  const params = new URLSearchParams();
  params.set('granularity', query.granularity);
  if (query.periodStart) params.set('periodStart', query.periodStart);
  if (query.date) params.set('date', query.date);
  if (query.flightNo) params.set('flightNo', query.flightNo);
  if (query.periodKey) params.set('periodKey', query.periodKey);
  return params.toString();
}

export function fetchSalesChart(query: PeriodQuery) {
  return apiGet<SalesChartPeriod[]>(`/reporting/sales-chart?${toQueryString(query)}`);
}

export function fetchKpis(query: PeriodQuery) {
  return apiGet<KpiResult>(`/reporting/kpis?${toQueryString(query)}`);
}

export function fetchCompletedFlightsSummary(query: PeriodQuery) {
  return apiGet<CompletedFlightsSummary>(`/reporting/completed-flights-summary?${toQueryString(query)}`);
}

export function fetchLowSalesAlerts() {
  return apiGet<LowSalesAlert[]>('/reporting/low-sales-alerts');
}
