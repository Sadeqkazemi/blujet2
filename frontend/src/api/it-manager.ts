import { apiDelete, apiGet, apiPatch, apiPost } from './http';
import type {
  ActiveSession,
  AuditLogRow,
  BackupRecord,
  BackupSchedule,
  EmployeeDetail,
  EmployeeListRow,
  ExternalService,
  ItDashboardData,
  ItServicesResult,
  PermissionCatalog,
  SecurityPolicy,
  ServiceReportResult,
  SmsLogResult,
} from '../types/it-manager';

export function fetchItDashboard() {
  return apiGet<ItDashboardData>('/it/dashboard');
}

export function fetchPermissionCatalog() {
  return apiGet<PermissionCatalog>('/it/permissions');
}

export function fetchEmployees(query: { dept?: string; q?: string } = {}) {
  const params = new URLSearchParams();
  if (query.dept) params.set('dept', query.dept);
  if (query.q) params.set('q', query.q);
  const qs = params.toString();
  return apiGet<EmployeeListRow[]>(`/it/employees${qs ? `?${qs}` : ''}`);
}

export function fetchEmployee(id: string) {
  return apiGet<EmployeeDetail>(`/it/employees/${id}`);
}

export function createEmployee(dto: {
  fullName: string;
  username: string;
  phone: string;
  password: string;
  dept: string;
  rank?: string;
  referralScope?: 'MANAGERS_ONLY' | 'ALL_STAFF';
  permissionKeys?: string[];
}) {
  return apiPost<EmployeeDetail>('/it/employees', dto);
}

export function setEmployeeStatus(id: string, isActive: boolean) {
  return apiPatch<{ id: string; isActive: boolean }>(`/it/employees/${id}/status`, { isActive });
}

export function setEmployeePermission(id: string, permissionKey: string, grant: boolean) {
  return apiPatch<EmployeeDetail>(`/it/employees/${id}/permissions`, { permissionKey, grant });
}

export function resetEmployeePassword(id: string) {
  return apiPost<{ tempPassword: string }>(`/it/employees/${id}/reset-password`);
}

export function fetchSecurityPolicy() {
  return apiGet<SecurityPolicy>('/it/security/policy');
}

export function updateSecurityPolicy(dto: Partial<SecurityPolicy>) {
  return apiPatch<SecurityPolicy>('/it/security/policy', dto);
}

export function fetchActiveSessions() {
  return apiGet<ActiveSession[]>('/it/security/sessions');
}

export function logoutAllSessions(stepUp: { stepUpChallengeId: string; stepUpCode: string }) {
  return apiPost<{ revokedCount: number }>('/it/security/sessions/logout-all', stepUp);
}

export function fetchItServices() {
  return apiGet<ItServicesResult>('/it/services');
}

export function toggleInternalService(key: string, enabled: boolean) {
  return apiPatch(`/it/services/internal/${key}`, { enabled });
}

export function fetchSmsLog() {
  return apiGet<SmsLogResult>('/it/services/sms-log');
}

export function fetchServiceReport(kind: 'internal' | 'external', id: string, page = 1, limit = 5) {
  return apiGet<ServiceReportResult>(`/it/services/${kind}/${id}/report?page=${page}&limit=${limit}`);
}

export function createExternalService(dto: {
  nameFa: string;
  provider: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  timeoutMs?: number;
  apiKey?: string;
  sandbox?: boolean;
}) {
  return apiPost<ExternalService>('/it/services/external', dto);
}

export function updateExternalService(id: string, dto: Partial<ExternalService> & { apiKey?: string }) {
  return apiPatch<ExternalService>(`/it/services/external/${id}`, dto);
}

export function removeExternalService(id: string) {
  return apiDelete<{ id: string }>(`/it/services/external/${id}`);
}

export function testExternalService(id: string) {
  return apiPost<{ ok: boolean; message: string; service: ExternalService }>(
    `/it/services/external/${id}/test`,
  );
}

export function fetchBackups() {
  return apiGet<BackupRecord[]>('/it/backups');
}

export function createBackup() {
  return apiPost<BackupRecord>('/it/backups');
}

export function fetchBackupSchedule() {
  return apiGet<BackupSchedule>('/it/backups/schedule');
}

export function fetchSystemLogs(query: {
  actor?: string;
  action?: string;
  resource?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (query.actor) params.set('actor', query.actor);
  if (query.action) params.set('action', query.action);
  if (query.resource) params.set('resource', query.resource);
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.page != null) params.set('page', String(query.page));
  if (query.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return apiGet<AuditLogRow[]>(`/audit/logs${qs ? `?${qs}` : ''}`);
}
