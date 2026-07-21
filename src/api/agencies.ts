import { apiGet, apiPatch, apiPost } from './http';
import type {
  AgencyApiKey,
  AgencyApiScope,
  AgencyCredit,
  AgencyDetail,
  AgencyInvoice,
  AgencyListResult,
  AgencyMembershipRequest,
  AgencyMembershipStatus,
  AgencyMessage,
} from '../types/agencies';

export function fetchAgencies(query: { q?: string; debtorsOnly?: boolean }) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.debtorsOnly) params.set('debtorsOnly', 'true');
  const qs = params.toString();
  return apiGet<AgencyListResult>(`/agencies${qs ? `?${qs}` : ''}`);
}

export function fetchAgencyDetail(id: string) {
  return apiGet<AgencyDetail>(`/agencies/${id}`);
}

export function suspendAgency(id: string, reason: string) {
  return apiPatch<AgencyDetail>(`/agencies/${id}/suspend`, { reason });
}

export function reactivateAgency(id: string) {
  return apiPatch<AgencyDetail>(`/agencies/${id}/reactivate`);
}

export function updateAgencyCredit(id: string, limitIrr: number) {
  return apiPatch<AgencyCredit>(`/agencies/${id}/credit`, { limitIrr });
}

export function settleAgency(id: string) {
  return apiPost<{ settledIrr: number; ledgerEntryId: string }>(`/agencies/${id}/settle`);
}

export function fetchAgencyRequests(status?: AgencyMembershipStatus) {
  return apiGet<AgencyMembershipRequest[]>(`/agencies/requests${status ? `?status=${status}` : ''}`);
}

export function fetchAgencyRequest(id: string) {
  return apiGet<AgencyMembershipRequest & { history: unknown[] }>(`/agencies/requests/${id}`);
}

export function approveAgencyRequest(id: string) {
  return apiPatch<{ agencyId: string }>(`/agencies/requests/${id}/approve`);
}

export function rejectAgencyRequest(id: string, reviewNote?: string) {
  return apiPatch<AgencyMembershipRequest>(`/agencies/requests/${id}/reject`, { reviewNote });
}

export function referAgencyRequest(id: string, referredToId: string, note?: string) {
  return apiPatch<AgencyMembershipRequest>(`/agencies/requests/${id}/refer`, { referredToId, note });
}

export function fetchAgencyApiKeys(id: string) {
  return apiGet<AgencyApiKey[]>(`/agencies/${id}/api-key`);
}

export function issueAgencyApiKey(id: string, scope: AgencyApiScope) {
  return apiPost<AgencyApiKey>(`/agencies/${id}/api-key`, { scope });
}

export function updateAgencyApiKey(
  id: string,
  keyId: string,
  dto: { status?: 'ACTIVE' | 'SUSPENDED'; regenerate?: boolean },
) {
  return apiPatch<AgencyApiKey>(`/agencies/${id}/api-key/${keyId}`, dto);
}

export function fetchAgencyInvoices(id: string) {
  return apiGet<AgencyInvoice[]>(`/agencies/${id}/invoices`);
}

export function issueAgencyInvoice(id: string, amountIrr: number, dueAt: string) {
  return apiPost<AgencyInvoice>(`/agencies/${id}/invoices`, { amountIrr, dueAt });
}

export function payAgencyInvoice(id: string, invoiceId: string) {
  return apiPatch<AgencyInvoice>(`/agencies/${id}/invoices/${invoiceId}/pay`);
}

export function remindAgencyInvoice(id: string, invoiceId: string) {
  return apiPost<{ queued: boolean }>(`/agencies/${id}/invoices/${invoiceId}/remind`);
}

export function fetchAgencyMessages(id: string) {
  return apiGet<AgencyMessage[]>(`/agencies/${id}/messages`);
}

export function postAgencyMessage(id: string, body: string) {
  return apiPost<AgencyMessage>(`/agencies/${id}/messages`, { body });
}

export function notifyAllDebtors() {
  return apiPost<{ notifiedCount: number }>('/agencies/debtors/notify-all');
}
