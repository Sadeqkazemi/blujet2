export type AgencyTier = 'NORMAL' | 'SILVER' | 'GOLD';
export type AgencyMembershipStatus = 'PENDING' | 'REFERRED' | 'APPROVED' | 'REJECTED';
export type AgencyApiScope = 'FULL' | 'SEARCH_BOOK' | 'SEARCH_ONLY';
export type AgencyApiKeyStatus = 'ACTIVE' | 'SUSPENDED';
export type AgencyInvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export interface AgencyListRow {
  id: string;
  fullName: string;
  managerName: string;
  licenseNo: string;
  city: string;
  tier: AgencyTier;
  isActive: boolean;
  limitIrr: number;
  usedIrr: number;
  remainingIrr: number;
  pendingInvoiceCount: number;
}

export interface AgencyListKpis {
  activeCount: number;
  totalCreditGrantedIrr: number;
  totalUsedIrr: number;
  pendingSettlementCount: number;
}

export interface AgencyListResult {
  agencies: AgencyListRow[];
  kpis: AgencyListKpis;
}

export interface AgencyActivityScore {
  score: number;
  badge: 'GOLD' | 'SILVER' | 'BRONZE';
}

export interface AgencyAuditRow {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  actorRole: string;
}

export interface AgencyCredit {
  limitIrr: number;
  usedIrr: number;
  remainingIrr: number;
}

export interface AgencyDetail {
  id: string;
  fullName: string;
  managerName: string;
  licenseNo: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  tier: AgencyTier;
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  joinedAt: string;
  credit: AgencyCredit;
  stats: { totalSalesIrr: number; ticketsIssued: number; passengers: number };
  activityScore?: AgencyActivityScore;
  recentActivity: AgencyAuditRow[];
}

export interface AgencyMembershipRequest {
  id: string;
  applicantName: string;
  managerName: string;
  licenseNo: string;
  city: string;
  phone: string;
  email: string;
  status: AgencyMembershipStatus;
  referredToId: string | null;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AgencyApiKey {
  id: string;
  agencyId: string;
  keyHash: string;
  scope: AgencyApiScope;
  status: AgencyApiKeyStatus;
  activatedAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  callCount: number;
  rawKey?: string;
}

export interface AgencyInvoice {
  id: string;
  agencyId: string;
  invoiceNo: string;
  issuedById: string;
  issuedAt: string;
  dueAt: string;
  amountIrr: number;
  status: AgencyInvoiceStatus;
  paidAt: string | null;
}

export interface AgencyMessage {
  id: string;
  agencyId: string;
  senderId: string;
  senderIsAgency: boolean;
  body: string;
  createdAt: string;
}
