export interface PermissionCatalogSection {
  sectionKey: string;
  sectionLabelFa: string;
  perms: { key: string; labelFa: string }[];
}

export type PermissionCatalog = Record<string, PermissionCatalogSection[]>;

export interface EmployeeListRow {
  id: string;
  fullName: string;
  username: string;
  dept: string | null;
  rank: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface EmployeeDetail extends EmployeeListRow {
  referralScope: 'MANAGERS_ONLY' | 'ALL_STAFF' | null;
  mustChangePassword: boolean;
  permissions: { key: string; labelFa: string; sectionLabelFa: string }[];
  available: { key: string; labelFa: string }[];
}

export interface SecurityPolicy {
  id: number;
  minLength: number;
  expiryDays: number;
  maxAttempts: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  blockReuse: boolean;
  staffTwoFactorMandatory: boolean;
  updatedAt: string;
}

export interface ActiveSession {
  id: string;
  who: string;
  role: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface InternalService {
  id: string;
  key: string;
  nameFa: string;
  enabled: boolean;
  uptimePct: number;
}

export interface ExternalService {
  id: string;
  key: string;
  nameFa: string;
  provider: string;
  endpoint: string;
  method: 'GET' | 'POST';
  timeoutMs: number;
  sandbox: boolean;
  enabled: boolean;
  hasApiKey: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
}

export interface ItServicesResult {
  internal: InternalService[];
  external: ExternalService[];
}

export interface BackupRecord {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface BackupSchedule {
  databaseBackup: string;
  fileBackup: string;
  retentionDays: number;
  cloudStorage: string;
}

export interface ItDashboardData {
  kpis: {
    activeEmployees: number;
    activeSessions: number;
    servicesUp: number;
    servicesTotal: number;
    lastBackupStatus: string | null;
    lastBackupAt: string | null;
  };
  serviceHealth: { name: string; uptimePct: number | null; enabled: boolean }[];
  resources: {
    memoryUsedPct: number;
    loadAvg1m: number;
    cpuCount: number;
    uptimeSeconds: number;
  };
  recentEvents: { id: string; text: string; category: string; createdAt: string }[];
}

export interface AuditLogRow {
  id: string;
  actorRole: string;
  category: string;
  action: string;
  detail: string;
  createdAt: string;
}
