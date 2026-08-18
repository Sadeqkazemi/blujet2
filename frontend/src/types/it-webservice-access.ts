/**
 * Domain types for «وب‌سرویس‌ها / دسترسی API آژانس‌ها» — IT Manager's agency
 * API access management. No backend exists for this feature yet (see
 * docs/features/it-api-access-management.md for the endpoints these types
 * are written against); frontend/src/api/it-webservice-access-mock.ts is a
 * TEMP/DEV-ONLY adapter standing in until that lands.
 */

export type ApiEnvironment = 'SANDBOX' | 'PRODUCTION';

export type ApiAccessRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type ApiScopeKey =
  | 'SEARCH'
  | 'BOOK'
  | 'TICKET_ISSUE'
  | 'CANCEL_REFUND'
  | 'PNR_MANAGE'
  | 'REPORTING';

export type ApiCredentialStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface ApiScopeOption {
  key: ApiScopeKey;
  labelFa: string;
  descFa: string;
}

export interface ApiRouteOption {
  key: string;
  labelFa: string;
}

export interface ApiFlightOption {
  id: string;
  labelFa: string;
}

export interface AccessConfig {
  scopes: ApiScopeKey[];
  /** Empty array = all routes allowed. */
  allowedRoutes: string[];
  /** Only meaningful when a scope like TICKET_ISSUE requires flight-level scoping. */
  allowedFlightIds: string[];
  rateLimitPerMinute: number;
  /** IPv4/IPv6 addresses or CIDR blocks. Empty array = no IP restriction. */
  allowedCidrs: string[];
  expiresAt: string | null;
}

export interface ApiAccessRequest {
  id: string;
  agencyId: string;
  agencyNameFa: string;
  environment: ApiEnvironment;
  status: ApiAccessRequestStatus;
  requestedScopes: ApiScopeKey[];
  requestedRoutes: string[];
  note: string | null;
  decisionNote: string | null;
  decidedByNameFa: string | null;
  decidedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface AgencyApiCredential {
  id: string;
  agencyId: string;
  agencyNameFa: string;
  environment: ApiEnvironment;
  /** Safe-to-display public identifier (not the secret). */
  keyId: string;
  /** Masked form, e.g. "sk_live_••••••••3f9a" — never the full secret. */
  maskedKey: string;
  status: ApiCredentialStatus;
  createdAt: string;
  lastUsedAt: string | null;
  config: AccessConfig;
}

/** Returned ONLY from issue/rotate — the one time the raw secret is visible. */
export interface AgencyApiCredentialIssued extends AgencyApiCredential {
  rawKey: string;
}

export interface ApiUsageStatPoint {
  bucketLabelFa: string;
  success: number;
  failed: number;
  avgResponseMs: number;
}

export interface ApiUsageSummary {
  totalRequests: number;
  successCount: number;
  failedCount: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  series: ApiUsageStatPoint[];
}

export type SecurityEventSeverity = 'info' | 'warn' | 'critical';

export interface ApiSecurityEvent {
  id: string;
  agencyId: string | null;
  agencyNameFa: string | null;
  environment: ApiEnvironment | null;
  labelFa: string;
  severity: SecurityEventSeverity;
  detailFa: string;
  createdAt: string;
}

export interface ApiAuditLogEntry {
  id: string;
  actorNameFa: string;
  action: string;
  detailFa: string;
  agencyNameFa: string | null;
  createdAt: string;
}

/** Sanitized request-level metadata — never tokens, passwords or passenger PII. */
export interface ApiRequestLogEntry {
  id: string;
  agencyId: string;
  agencyNameFa: string;
  environment: ApiEnvironment;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  statusCode: number;
  responseMs: number;
  ipMasked: string;
  requestIdHeader: string;
  createdAt: string;
}

export interface ApiAccessRequestFilters {
  q?: string;
  agencyId?: string;
  environment?: ApiEnvironment;
  status?: ApiAccessRequestStatus;
  route?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ApiUsageFilters {
  agencyId?: string;
  environment?: ApiEnvironment;
  endpoint?: string;
  dateFrom?: string;
  dateTo?: string;
}
