export type AgencyTier = 'NORMAL' | 'SILVER' | 'GOLD';
export type AgencyMembershipStatus = 'PENDING' | 'REFERRED' | 'APPROVED' | 'REJECTED';
export type AgencyMembershipApprovalStage = 'AWAITING_COMMERCIAL' | 'AWAITING_FINANCE' | 'APPROVED' | 'REJECTED';
export type AgencyApiScope = 'FULL' | 'SEARCH_BOOK' | 'SEARCH_ONLY';
export type AgencyApiKeyStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
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
  // Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON
  // on the backend — a JS number can't safely hold IRR amounts above 2^53).
  limitIrr: string;
  usedIrr: string;
  remainingIrr: string;
  pendingInvoiceCount: number;
}

export interface AgencyListKpis {
  activeCount: number;
  totalCreditGrantedIrr: string;
  totalUsedIrr: string;
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
  limitIrr: string;
  usedIrr: string;
  remainingIrr: string;
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
  stats: { totalSalesIrr: string; ticketsIssued: number; passengers: number };
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
  approvalStage: AgencyMembershipApprovalStage;
  referredToId: string | null;
  reviewNote: string | null;
  commercialApprovedById: string | null;
  commercialApprovedAt: string | null;
  financeApprovedById: string | null;
  financeApprovedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AgencyApiKey {
  id: string;
  agencyId: string;
  keyHint: string;
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
  amountIrr: string;
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
