import { apiGet } from './http';
import type { ManagerReportRow } from '../types/audit';

export function fetchManagerReports(filters: {
  category?: string;
  actorRole?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.actorRole) params.set('actorRole', filters.actorRole);
  if (filters.q) params.set('q', filters.q);
  const qs = params.toString();
  return apiGet<ManagerReportRow[]>(`/audit/manager-reports${qs ? `?${qs}` : ''}`);
}
