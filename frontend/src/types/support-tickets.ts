export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ANSWERED' | 'CLOSED';
export type SupportTicketDept = 'SITE' | 'AGENCY';

export interface SupportTicketRow {
  id: string;
  trackingCode: string;
  subject: string;
  body: string;
  requesterName: string;
  requesterPhone: string;
  dept: SupportTicketDept;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: SupportTicketStatus;
  forwardedTo: { id: string; fullName: string; role: string } | null;
  history: { step: string; labelFa: string; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ForwardTarget {
  id: string;
  fullName: string;
  role: string;
  roleLabelFa: string;
}

export interface ContactMessageRow {
  id: string;
  name: string;
  phone: string;
  subject: string;
  body: string;
  createdAt: string;
}
