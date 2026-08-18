/**
 * Domain types for the IT Manager's internal «پشتیبانی» tab — technical
 * support requests raised by staff, distinct from the customer-facing
 * support-tickets system (backend/src/modules/support-tickets is
 * SITE_ADMIN-only). No backend exists for this feature yet; see
 * frontend/src/api/it-support-mock.ts.
 */

export type ItSupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ItSupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ItSupportMessage {
  id: string;
  authorNameFa: string;
  body: string;
  createdAt: string;
}

export interface ItSupportTicket {
  id: string;
  subject: string;
  requesterNameFa: string;
  requesterDeptFa: string;
  priority: ItSupportTicketPriority;
  status: ItSupportTicketStatus;
  body: string;
  createdAt: string;
  updatedAt: string;
  messages: ItSupportMessage[];
}

export interface ItSupportTicketFilters {
  q?: string;
  status?: ItSupportTicketStatus;
  priority?: ItSupportTicketPriority;
}
