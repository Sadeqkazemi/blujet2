// Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON on
// the backend — a JS number can't safely hold IRR amounts above 2^53).
export interface AgencyCredit {
  limitIrr: string;
  usedIrr: string;
  remainingIrr: string;
}

export interface AgencyDashboard {
  credit: AgencyCredit;
  kpis: {
    salesThisMonthIrr: string;
    ticketsIssuedTotal: number;
    seatsSoldThisMonth: number;
  };
  monthlySales: { month: string; salesIrr: string }[];
}

export interface AgencyLedgerEntry {
  id: string;
  type: 'SALE' | 'REFUND' | 'SETTLEMENT' | 'COMMISSION';
  signedAmountIrr: string;
  occurredAt: string;
}

export type AgencyInvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export interface AgencyInvoice {
  id: string;
  invoiceNo: string;
  issuedAt: string;
  dueAt: string;
  amountIrr: string;
  status: AgencyInvoiceStatus;
  paidAt: string | null;
}

export type AgencyCreditRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AgencyCreditRequest {
  id: string;
  requestedLimitIrr: string;
  note: string | null;
  status: AgencyCreditRequestStatus;
  decidedAt: string | null;
  createdAt: string;
}

export interface AgencySalesTicket {
  pnr: string;
  status: string;
  flightNo: string;
  route: string;
  departureAt: string;
  priceIrr: string;
  passengerCount: number;
}

export interface AgencySalesPerFlight {
  flightNo: string;
  route: string;
  ticketsCount: number;
  salesIrr: string;
}

export interface AgencySalesReport {
  tickets: AgencySalesTicket[];
  perFlight: AgencySalesPerFlight[];
  summary: {
    totalSalesIrr: string;
    ticketsIssued: number;
    avgFareIrr: string;
    refundRatePct: number;
  };
}

export interface AgencyMessage {
  id: string;
  senderId: string;
  senderIsAgency: boolean;
  body: string;
  createdAt: string;
}

export interface AgencyProfile {
  fullName: string;
  managerName: string;
  licenseNo: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  tier: 'NORMAL' | 'SILVER' | 'GOLD';
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  joinedAt: string;
}

export type AgencyDocumentType = 'LICENSE' | 'CONTRACT' | 'OTHER';
export type AgencyDocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AgencyAllotmentRow {
  id: string;
  flightNo: string;
  route: string;
  departureAt: string;
  aircraftType: string;
  seatsAllocated: number;
  seatsUsed: number;
  type: 'SOFT' | 'HARD';
  releaseAt: string | null;
  contractPriceIrr: string | null;
  active: boolean;
}

export interface AgencyDocument {
  id: string;
  docType: AgencyDocumentType;
  status: AgencyDocumentStatus;
  createdAt: string;
  file: { fileName: string; sizeBytes: number; mimeType: string };
}

export type AgencyApiScope = 'FULL' | 'SEARCH_BOOK';
export type AgencyWebserviceRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AgencyWebserviceRequest {
  id: string;
  scope: AgencyApiScope;
  months: 1 | 3 | 12;
  priceIrr: string;
  note: string | null;
  status: AgencyWebserviceRequestStatus;
  decidedAt: string | null;
  createdAt: string;
}

export interface AgencyApiKeySummary {
  id: string;
  scope: AgencyApiScope | 'SEARCH_ONLY';
  status: 'ACTIVE' | 'SUSPENDED';
  activatedAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  callCount: number;
}
