import { apiGet, apiPatch, apiPost } from './http';
import type {
  CartableCategory,
  CartableListResult,
  CartableTask,
  ChairPermission,
  ManagerMessageDept,
  Referral,
  ReferralListResult,
  ReferralPriority,
  ReferralReport,
  SendMessageResult,
  StaffDirectoryEntry,
} from '../types/cartable';

export function fetchCartable(query: { category?: CartableCategory; date?: string } = {}) {
  const params = new URLSearchParams();
  if (query.category) params.set('category', query.category);
  if (query.date) params.set('date', query.date);
  const qs = params.toString();
  return apiGet<CartableListResult>(`/cartable${qs ? `?${qs}` : ''}`);
}

export function approveCartableTask(id: string, note: string) {
  return apiPatch<CartableTask>(`/cartable/${id}/approve`, { note });
}

export function rejectCartableTask(id: string, note: string) {
  return apiPatch<CartableTask>(`/cartable/${id}/reject`, { note });
}

export function transferCartableTask(id: string, toId: string, note: string) {
  return apiPatch<CartableTask>(`/cartable/${id}/transfer`, { toId, note });
}

export function requestChairPermission() {
  return apiPost<ChairPermission>('/cartable/chair-permission');
}

export async function fetchChairPermission(): Promise<ChairPermission | null> {
  const { latest } = await apiGet<{ latest: ChairPermission | null }>('/cartable/chair-permission');
  return latest;
}

export function fetchStaffDirectory() {
  return apiGet<StaffDirectoryEntry[]>('/staff-directory');
}

export function fetchReferrals() {
  return apiGet<ReferralListResult>('/referrals');
}

export function createReferral(dto: {
  title: string;
  body: string;
  recipientIds: string[];
  priority?: ReferralPriority;
  dueAt?: string;
}) {
  return apiPost<Referral>('/referrals', dto);
}

export function fetchReferralDetail(id: string) {
  return apiGet<Referral & { reports: ReferralReport[] }>(`/referrals/${id}`);
}

export function closeReferral(id: string) {
  return apiPatch<Referral>(`/referrals/${id}/close`);
}

export function requestReferralRevision(id: string) {
  return apiPatch<Referral>(`/referrals/${id}/request-revision`);
}

export function remindReferral(id: string) {
  return apiPost<Referral>(`/referrals/${id}/remind`);
}

export function sendManagerMessage(dto: {
  toDept: ManagerMessageDept;
  subject: string;
  body: string;
}) {
  return apiPost<SendMessageResult>('/manager-messages', dto);
}
