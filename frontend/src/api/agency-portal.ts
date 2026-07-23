import { apiGet, apiPost, apiPostForm } from './http';
import type {
  AgencyAllotmentRow,
  AgencyApiKeySummary,
  AgencyApiScope,
  AgencyCredit,
  AgencyCreditRequest,
  AgencyDashboard,
  AgencyDocument,
  AgencyDocumentType,
  AgencyInvoice,
  AgencyLedgerEntry,
  AgencyMessage,
  AgencyProfile,
  AgencySalesReport,
  AgencyWebserviceRequest,
} from '../types/agency-portal';

export function fetchDashboard() {
  return apiGet<AgencyDashboard>('/agency-portal/dashboard');
}

export function fetchCredit() {
  return apiGet<AgencyCredit>('/agency-portal/credit');
}

export function fetchLedger() {
  return apiGet<AgencyLedgerEntry[]>('/agency-portal/ledger');
}

export function fetchInvoices() {
  return apiGet<AgencyInvoice[]>('/agency-portal/invoices');
}

export function payInvoice(invoiceId: string) {
  return apiPost<AgencyInvoice>(`/agency-portal/invoices/${invoiceId}/pay`);
}

export function requestCreditIncrease(requestedLimitIrr: number, note?: string) {
  return apiPost<AgencyCreditRequest>('/agency-portal/credit-requests', { requestedLimitIrr, note });
}

export function fetchMyCreditRequests() {
  return apiGet<AgencyCreditRequest[]>('/agency-portal/credit-requests');
}

export function fetchSales() {
  return apiGet<AgencySalesReport>('/agency-portal/sales');
}

export function fetchInbox() {
  return apiGet<AgencyMessage[]>('/agency-portal/inbox');
}

export function postInboxMessage(body: string) {
  return apiPost<AgencyMessage>('/agency-portal/inbox', { body });
}

export function fetchProfile() {
  return apiGet<AgencyProfile>('/agency-portal/profile');
}

export function fetchDocuments() {
  return apiGet<AgencyDocument[]>('/agency-portal/documents');
}

export function uploadDocument(file: File, docType: AgencyDocumentType) {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);
  return apiPostForm<AgencyDocument>('/agency-portal/documents', form);
}

export function fetchAllotments() {
  return apiGet<AgencyAllotmentRow[]>('/agency-portal/allotments');
}

export function requestWebservice(scope: AgencyApiScope, months: 1 | 3 | 12, note?: string) {
  return apiPost<AgencyWebserviceRequest>('/agency-portal/webservice-requests', { scope, months, note });
}

export function fetchMyWebserviceRequests() {
  return apiGet<AgencyWebserviceRequest[]>('/agency-portal/webservice-requests');
}

export function fetchApiKeys() {
  return apiGet<AgencyApiKeySummary[]>('/agency-portal/api-keys');
}
