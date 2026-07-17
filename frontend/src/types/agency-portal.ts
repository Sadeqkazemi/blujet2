export interface AgencyCredit {
  limitIrr: number;
  usedIrr: number;
  remainingIrr: number;
}

export interface AgencyDashboard {
  credit: AgencyCredit;
  kpis: {
    salesThisMonthIrr: number;
    ticketsIssuedTotal: number;
    seatsSoldThisMonth: number;
  };
  monthlySales: { month: string; salesIrr: number }[];
}

export interface AgencyLedgerEntry {
  id: string;
  type: 'SALE' | 'REFUND' | 'SETTLEMENT' | 'COMMISSION';
  signedAmountIrr: number;
  occurredAt: string;
}

export type AgencyInvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export interface AgencyInvoice {
  id: string;
  invoiceNo: string;
  issuedAt: string;
  dueAt: string;
  amountIrr: number;
  status: AgencyInvoiceStatus;
  paidAt: string | null;
}

export type AgencyCreditRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AgencyCreditRequest {
  id: string;
  requestedLimitIrr: number;
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
  priceIrr: number;
  passengerCount: number;
}

export interface AgencySalesPerFlight {
  flightNo: string;
  route: string;
  ticketsCount: number;
  salesIrr: number;
}

export interface AgencySalesReport {
  tickets: AgencySalesTicket[];
  perFlight: AgencySalesPerFlight[];
  summary: {
    totalSalesIrr: number;
    ticketsIssued: number;
    avgFareIrr: number;
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

export interface AgencyDocument {
  id: string;
  docType: AgencyDocumentType;
  status: AgencyDocumentStatus;
  createdAt: string;
  file: { fileName: string; sizeBytes: number; mimeType: string };
}
