import { apiGet, apiPost } from './http';
import type { LoanApplication, LoanApplicationList } from '../types/loans';

export function createLoanApplication(requestedAmountIrr: string, idempotencyKey: string) {
  return apiPost<LoanApplication>('/me/loan-applications', {
    requestedAmountIrr,
    idempotencyKey,
  });
}

export function fetchMyLoanApplications(page = 1, pageSize = 20) {
  return apiGet<LoanApplicationList>(
    `/me/loan-applications?page=${page}&pageSize=${pageSize}`,
  );
}

export function syncMyLoanApplication(id: string) {
  return apiPost<LoanApplication>(`/me/loan-applications/${id}/sync`);
}

export function fetchAdminLoanApplications(page = 1, pageSize = 20) {
  return apiGet<LoanApplicationList>(
    `/admin/loan-applications?page=${page}&pageSize=${pageSize}`,
  );
}

export function fetchAdminLoanApplication(id: string) {
  return apiGet<LoanApplication>(`/admin/loan-applications/${id}`);
}
