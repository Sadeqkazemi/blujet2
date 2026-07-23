import { apiGet, apiPatch, apiPost } from './http';
import type {
  ContactMessageRow,
  ForwardTarget,
  SupportTicketRow,
  SupportTicketStatus,
} from '../types/support-tickets';

// پشتیبانی — public ticket submission, no login required.
export function submitSupportTicket(dto: {
  requesterName: string;
  requesterPhone: string;
  subject: string;
  body: string;
}) {
  return apiPost<{ id: string; trackingCode: string }>('/support-tickets', dto);
}

export function fetchSupportTickets(filters: { status?: SupportTicketStatus } = {}) {
  const qs = filters.status ? `?status=${filters.status}` : '';
  return apiGet<SupportTicketRow[]>(`/support-tickets${qs}`);
}

export function fetchSupportTicketDetail(id: string) {
  return apiGet<SupportTicketRow>(`/support-tickets/${id}`);
}

export function fetchForwardTargets() {
  return apiGet<ForwardTarget[]>('/support-tickets/forward-targets');
}

export function forwardSupportTicket(id: string, targetUserId: string) {
  return apiPatch<SupportTicketRow>(`/support-tickets/${id}/forward`, { targetUserId });
}

export function updateSupportTicketStatus(id: string, status: SupportTicketStatus) {
  return apiPatch<SupportTicketRow>(`/support-tickets/${id}/status`, { status });
}

export function fetchRecentContactMessages() {
  return apiGet<ContactMessageRow[]>('/contact');
}
