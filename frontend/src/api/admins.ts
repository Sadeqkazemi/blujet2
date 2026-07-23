import { apiGet, apiPatch, apiPost } from './http';
import type {
  AdminCreatableRole,
  AdminRow,
  SettingsResult,
  SystemEventRow,
} from '../types/admins';

export function fetchAdmins() {
  return apiGet<AdminRow[]>('/admins');
}

export function createAdmin(dto: {
  fullName: string;
  email: string;
  username: string;
  role: AdminCreatableRole;
  password: string;
  delivery: 'sms' | 'email';
  stepUpChallengeId: string;
  stepUpCode: string;
}) {
  return apiPost<{ id: string }>('/admins', dto);
}

export function blockAdmin(id: string) {
  return apiPatch<{ id: string; isActive: boolean }>(`/admins/${id}/block`);
}

export function unblockAdmin(id: string) {
  return apiPatch<{ id: string; isActive: boolean }>(`/admins/${id}/unblock`);
}

export function resetAdminPassword(id: string, dto: { password?: string; delivery?: 'sms' | 'email' }) {
  return apiPost<{ tempPassword: string }>(`/admins/${id}/reset-password`, dto);
}

export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return apiPost<{ changed: boolean }>('/auth/change-password', { currentPassword, newPassword });
}

export function fetchSystemEvents() {
  return apiGet<SystemEventRow[]>('/audit/system-events');
}

export function fetchSettings() {
  return apiGet<SettingsResult>('/settings');
}

export function updateSettings(patch: Record<string, unknown>) {
  return apiPatch<SettingsResult>('/settings', { patch });
}

export function updateRefundRules(rules: { id: string; penaltyPct: number }[]) {
  return apiPatch<SettingsResult>('/settings/refund-rules', { rules });
}
