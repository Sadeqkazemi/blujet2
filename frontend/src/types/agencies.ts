export type AgencyTier = 'NORMAL' | 'SILVER' | 'GOLD';
export type AgencyMembershipStatus = 'PENDING' | 'REFERRED' | 'APPROVED' | 'REJECTED';
export type AgencyApiScope = 'FULL' | 'SEARCH_BOOK' | 'SEARCH_ONLY';
export type AgencyApiKeyStatus = 'ACTIVE' | 'SUSPENDED';
export type AgencyInvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE';
export type AgencyDocumentType = 'LICENSE' | 'CONTRACT' | 'OTHER';
export type AgencyDocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
  commercialExtras?: AgencyCommercialExtras;
}

export interface AgencyFlightSoldRow {
  routeFa: string;
  flightNo: string;
  departAt: string;
  seatCount: number;
  salesIrr: number;
}

export interface AgencyPurchasedService {
  name: string;
  purchasedAt: string;
  expiresAt: string | null;
  statusLabel: string;
  status: 'ACTIVE' | 'EXPIRED';
}

export interface AgencyCommercialExtras {
  flightsSold: AgencyFlightSoldRow[];
  purchasedServices: AgencyPurchasedService[];
  financeSummary: { paidTotalIrr: number; unpaidTotalIrr: number };
  transactions: {
    id: string;
    titleFa: string;
    occurredAt: string;
    signedAmountIrr: number;
    ref: string | null;
  }[];
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

export interface AgencyDocument {
  id: string;
  agencyId: string;
  docType: AgencyDocumentType;
  status: AgencyDocumentStatus;
  createdAt: string;
  file: { fileName: string; sizeBytes: number; mimeType: string };
}

export interface AgencyMessage {
  id: string;
  agencyId: string;
  senderId: string;
  senderIsAgency: boolean;
  body: string;
  createdAt: string;
}
