/**
 * ⚠️ TEMP / DEV ONLY — no real backend exists for this feature yet.
 *
 * Stand-in adapter for «وب‌سرویس‌ها / دسترسی API آژانس‌ها» (IT Manager's
 * agency API access management). Every exported function here mirrors a
 * documented future endpoint — see docs/features/it-api-access-management.md
 * for the real request/response contracts, validation, RBAC and
 * secret-handling rules this must satisfy once implemented server-side.
 *
 * To keep this preview honest with CLAUDE.md's "no fabricated business
 * data" rule, agency identity and allowed-route/flight catalogs are read
 * from the REAL backend (`fetchAgencies`, `fetchReservationFlights` — both
 * already reachable by IT_MANAGER). Only the genuinely new records that
 * have no backend at all yet (access requests, credentials, usage/security/
 * audit data) are generated in-memory here, and are never persisted —
 * reloading the page resets them. No mock-backed action in this file is
 * operational; nothing here writes to the real database.
 */
import { fetchAgencies } from './agencies';
import { fetchReservationFlights } from './reservation';
import type {
  AccessConfig,
  AgencyApiCredential,
  AgencyApiCredentialIssued,
  ApiAccessRequest,
  ApiAccessRequestFilters,
  ApiAccessRequestStatus,
  ApiAuditLogEntry,
  ApiCredentialStatus,
  ApiEnvironment,
  ApiFlightOption,
  ApiRequestLogEntry,
  ApiRouteOption,
  ApiScopeOption,
  ApiSecurityEvent,
  ApiUsageFilters,
  ApiUsageSummary,
} from '../types/it-webservice-access';

export const SCOPE_CATALOG: ApiScopeOption[] = [
  { key: 'SEARCH', labelFa: 'جستجوی پرواز و نرخ', descFa: 'مشاهدهٔ نتایج جستجو و نرخ‌های موجود' },
  { key: 'BOOK', labelFa: 'رزرو (HOLD)', descFa: 'ایجاد رزرو موقت روی صندلی‌های موجود' },
  { key: 'TICKET_ISSUE', labelFa: 'صدور بلیط', descFa: 'تبدیل رزرو پرداخت‌شده به بلیط صادرشده' },
  { key: 'CANCEL_REFUND', labelFa: 'ابطال و استرداد', descFa: 'لغو رزرو و ثبت درخواست استرداد' },
  { key: 'PNR_MANAGE', labelFa: 'مدیریت PNR', descFa: 'مشاهده و تغییر جزئیات یک PNR صادرشده' },
  { key: 'REPORTING', labelFa: 'گزارش فروش آژانس', descFa: 'دریافت گزارش تراکنش‌های همان آژانس' },
];

let agencyCache: { id: string; nameFa: string }[] | null = null;

async function loadAgencyOptions(): Promise<{ id: string; nameFa: string }[]> {
  if (agencyCache) return agencyCache;
  const result = await fetchAgencies({});
  agencyCache = result.agencies.map((a) => ({ id: a.id, nameFa: a.fullName }));
  return agencyCache;
}

let routeCache: ApiRouteOption[] | null = null;
let flightCache: ApiFlightOption[] | null = null;

async function loadRouteAndFlightOptions(): Promise<{ routes: ApiRouteOption[]; flights: ApiFlightOption[] }> {
  if (routeCache && flightCache) return { routes: routeCache, flights: flightCache };
  const rows = await fetchReservationFlights();
  const routeMap = new Map<string, string>();
  const flights: ApiFlightOption[] = [];
  for (const row of rows) {
    const key = row.route ?? (row.originCode && row.destCode ? `${row.originCode}-${row.destCode}` : null);
    if (key && !routeMap.has(key)) {
      const label = row.originCityFa && row.destCityFa ? `${row.originCityFa} ← ${row.destCityFa} (${key})` : key;
      routeMap.set(key, label);
    }
    flights.push({ id: row.flightInstanceId, labelFa: `${row.flightNo}${key ? ` · ${key}` : ''}` });
  }
  routeCache = Array.from(routeMap.entries()).map(([key, labelFa]) => ({ key, labelFa }));
  flightCache = flights;
  return { routes: routeCache, flights: flightCache };
}

export async function fetchRouteOptions(): Promise<ApiRouteOption[]> {
  return (await loadRouteAndFlightOptions()).routes;
}

export async function fetchFlightOptions(): Promise<ApiFlightOption[]> {
  return (await loadRouteAndFlightOptions()).flights;
}

function defaultConfig(scopes: ApiAccessRequest['requestedScopes'], routes: string[]): AccessConfig {
  return {
    scopes,
    allowedRoutes: routes,
    allowedFlightIds: [],
    rateLimitPerMinute: 60,
    allowedCidrs: [],
    expiresAt: null,
  };
}

function maskKey(raw: string): string {
  return `${raw.slice(0, 8)}${'•'.repeat(10)}${raw.slice(-4)}`;
}

function randomKey(env: ApiEnvironment): string {
  const prefix = env === 'PRODUCTION' ? 'sk_live_' : 'sk_test_';
  const body = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${prefix}${body}`.slice(0, 28);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isoDaysAgo(days: number): string {
  return isoDaysFromNow(-days);
}

let requestsStore: ApiAccessRequest[] | null = null;
let credentialsStore: AgencyApiCredential[] | null = null;
let auditStore: ApiAuditLogEntry[] = [];
let nextId = 1;

function newId(prefix: string): string {
  return `${prefix}_${nextId++}`;
}

async function ensureSeeded(): Promise<void> {
  if (requestsStore && credentialsStore) return;
  const agencies = await loadAgencyOptions();
  const { routes } = await loadRouteAndFlightOptions();
  const routeKeys = routes.slice(0, 3).map((r) => r.key);

  requestsStore = [];
  credentialsStore = [];

  if (agencies.length === 0) return;

  const statusCycle: ApiAccessRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'EXPIRED'];
  agencies.slice(0, Math.min(8, agencies.length)).forEach((agency, idx) => {
    const status = statusCycle[idx % statusCycle.length]!;
    const environment: ApiEnvironment = idx % 2 === 0 ? 'PRODUCTION' : 'SANDBOX';
    const scopes: ApiAccessRequest['requestedScopes'] = idx % 3 === 0 ? ['SEARCH', 'BOOK', 'TICKET_ISSUE'] : ['SEARCH', 'BOOK'];
    requestsStore!.push({
      id: newId('req'),
      agencyId: agency.id,
      agencyNameFa: agency.nameFa,
      environment,
      status,
      requestedScopes: scopes,
      requestedRoutes: routeKeys,
      note: idx % 2 === 0 ? 'درخواست اتصال برای فروش آنلاین از سایت آژانس' : null,
      decisionNote: status === 'REJECTED' ? 'مدارک صلاحیت فنی آژانس تکمیل نیست' : status === 'APPROVED' ? 'تأیید شد — طبق سطح اعتبار آژانس' : null,
      decidedByNameFa: status === 'PENDING' ? null : 'مدیر فناوری اطلاعات',
      decidedAt: status === 'PENDING' ? null : isoDaysAgo(idx + 1),
      createdAt: isoDaysAgo(idx + 3),
      expiresAt: status === 'EXPIRED' ? isoDaysAgo(1) : status === 'APPROVED' ? isoDaysFromNow(180) : null,
    });

    if (status === 'APPROVED' || status === 'SUSPENDED') {
      const raw = randomKey(environment);
      credentialsStore!.push({
        id: newId('cred'),
        agencyId: agency.id,
        agencyNameFa: agency.nameFa,
        environment,
        keyId: `key_${agency.id.slice(0, 6)}_${environment === 'PRODUCTION' ? 'prod' : 'sbx'}`,
        maskedKey: maskKey(raw),
        status: status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
        createdAt: isoDaysAgo(idx + 1),
        lastUsedAt: status === 'APPROVED' ? isoDaysAgo(0) : null,
        config: defaultConfig(scopes, routeKeys),
      });
    }
  });

  auditStore = [
    { id: newId('aud'), actorNameFa: 'مدیر فناوری اطلاعات', action: 'ISSUE_KEY', detailFa: 'صدور کلید Production برای آژانس', agencyNameFa: agencies[0]?.nameFa ?? null, createdAt: isoDaysAgo(1) },
    { id: newId('aud'), actorNameFa: 'مدیر فناوری اطلاعات', action: 'APPROVE_REQUEST', detailFa: 'تأیید درخواست دسترسی API', agencyNameFa: agencies[1]?.nameFa ?? null, createdAt: isoDaysAgo(2) },
  ];
}

function matchesFilters(r: ApiAccessRequest, f: ApiAccessRequestFilters): boolean {
  if (f.q && !r.agencyNameFa.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.agencyId && r.agencyId !== f.agencyId) return false;
  if (f.environment && r.environment !== f.environment) return false;
  if (f.status && r.status !== f.status) return false;
  if (f.route && !r.requestedRoutes.includes(f.route)) return false;
  if (f.dateFrom && r.createdAt < f.dateFrom) return false;
  if (f.dateTo && r.createdAt > f.dateTo) return false;
  return true;
}

export async function fetchApiAccessRequests(filters: ApiAccessRequestFilters = {}): Promise<ApiAccessRequest[]> {
  await ensureSeeded();
  return requestsStore!.filter((r) => matchesFilters(r, filters)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchApiAccessRequestDetail(id: string): Promise<ApiAccessRequest> {
  await ensureSeeded();
  const found = requestsStore!.find((r) => r.id === id);
  if (!found) throw new Error('درخواست یافت نشد.');
  return found;
}

export async function decideApiAccessRequest(
  id: string,
  decision: { approve: boolean; note?: string },
): Promise<ApiAccessRequest> {
  await ensureSeeded();
  const found = requestsStore!.find((r) => r.id === id);
  if (!found) throw new Error('درخواست یافت نشد.');
  if (found.status !== 'PENDING') throw new Error('این درخواست پیش‌تر تصمیم‌گیری شده است.');
  found.status = decision.approve ? 'APPROVED' : 'REJECTED';
  found.decisionNote = decision.note?.trim() || null;
  found.decidedByNameFa = 'مدیر فناوری اطلاعات';
  found.decidedAt = new Date().toISOString();
  auditStore.unshift({
    id: newId('aud'),
    actorNameFa: 'مدیر فناوری اطلاعات',
    action: decision.approve ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
    detailFa: decision.approve ? 'تأیید درخواست دسترسی API' : `رد درخواست — ${decision.note?.trim() || 'بدون توضیح'}`,
    agencyNameFa: found.agencyNameFa,
    createdAt: found.decidedAt,
  });
  return found;
}

export async function fetchAgencyCredentials(query: { agencyId?: string; environment?: ApiEnvironment } = {}): Promise<AgencyApiCredential[]> {
  await ensureSeeded();
  return credentialsStore!
    .filter((c) => (query.agencyId ? c.agencyId === query.agencyId : true))
    .filter((c) => (query.environment ? c.environment === query.environment : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchAgencyOptionsList(): Promise<{ id: string; nameFa: string }[]> {
  return loadAgencyOptions();
}

export async function issueAgencyCredential(
  agencyId: string,
  environment: ApiEnvironment,
  config: AccessConfig,
): Promise<AgencyApiCredentialIssued> {
  await ensureSeeded();
  const agencies = await loadAgencyOptions();
  const agency = agencies.find((a) => a.id === agencyId);
  if (!agency) throw new Error('آژانس یافت نشد.');
  const existing = credentialsStore!.find((c) => c.agencyId === agencyId && c.environment === environment && c.status === 'ACTIVE');
  if (existing) throw new Error(`این آژانس در محیط ${environment === 'PRODUCTION' ? 'Production' : 'Sandbox'} کلید فعال دارد؛ برای صدور مجدد از «چرخش کلید» استفاده کنید.`);
  const raw = randomKey(environment);
  const created: AgencyApiCredential = {
    id: newId('cred'),
    agencyId,
    agencyNameFa: agency.nameFa,
    environment,
    keyId: `key_${agencyId.slice(0, 6)}_${environment === 'PRODUCTION' ? 'prod' : 'sbx'}_${nextId}`,
    maskedKey: maskKey(raw),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    config,
  };
  credentialsStore!.push(created);
  auditStore.unshift({
    id: newId('aud'),
    actorNameFa: 'مدیر فناوری اطلاعات',
    action: 'ISSUE_KEY',
    detailFa: `صدور کلید ${environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}`,
    agencyNameFa: agency.nameFa,
    createdAt: created.createdAt,
  });
  return { ...created, rawKey: raw };
}

function requireCredential(id: string): AgencyApiCredential {
  const found = credentialsStore!.find((c) => c.id === id);
  if (!found) throw new Error('کلید یافت نشد.');
  return found;
}

export async function rotateAgencyCredential(id: string): Promise<AgencyApiCredentialIssued> {
  await ensureSeeded();
  const cred = requireCredential(id);
  const raw = randomKey(cred.environment);
  cred.maskedKey = maskKey(raw);
  cred.createdAt = new Date().toISOString();
  cred.lastUsedAt = null;
  auditStore.unshift({ id: newId('aud'), actorNameFa: 'مدیر فناوری اطلاعات', action: 'ROTATE_KEY', detailFa: 'چرخش کلید API', agencyNameFa: cred.agencyNameFa, createdAt: cred.createdAt });
  return { ...cred, rawKey: raw };
}

function setCredentialStatus(id: string, status: ApiCredentialStatus, action: string, detailFa: string): AgencyApiCredential {
  const cred = requireCredential(id);
  cred.status = status;
  auditStore.unshift({ id: newId('aud'), actorNameFa: 'مدیر فناوری اطلاعات', action, detailFa, agencyNameFa: cred.agencyNameFa, createdAt: new Date().toISOString() });
  return cred;
}

export async function suspendAgencyCredential(id: string): Promise<AgencyApiCredential> {
  await ensureSeeded();
  return setCredentialStatus(id, 'SUSPENDED', 'SUSPEND_KEY', 'تعلیق کلید API');
}

export async function reactivateAgencyCredential(id: string): Promise<AgencyApiCredential> {
  await ensureSeeded();
  return setCredentialStatus(id, 'ACTIVE', 'REACTIVATE_KEY', 'فعال‌سازی مجدد کلید API');
}

export async function revokeAgencyCredential(id: string): Promise<AgencyApiCredential> {
  await ensureSeeded();
  return setCredentialStatus(id, 'REVOKED', 'REVOKE_KEY', 'ابطال دائمی کلید API');
}

export async function updateAccessConfig(id: string, config: AccessConfig): Promise<AgencyApiCredential> {
  await ensureSeeded();
  const cred = requireCredential(id);
  cred.config = config;
  auditStore.unshift({ id: newId('aud'), actorNameFa: 'مدیر فناوری اطلاعات', action: 'UPDATE_CONFIG', detailFa: 'به‌روزرسانی پیکربندی دسترسی', agencyNameFa: cred.agencyNameFa, createdAt: new Date().toISOString() });
  return cred;
}

export async function fetchApiUsageSummary(_filters: ApiUsageFilters = {}): Promise<ApiUsageSummary> {
  await ensureSeeded();
  const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const series = days.map((label, idx) => {
    const success = 120 + idx * 17 + (idx % 2 === 0 ? 40 : 0);
    const failed = 3 + (idx % 3);
    return { bucketLabelFa: label, success, failed, avgResponseMs: 180 + idx * 6 };
  });
  const totalSuccess = series.reduce((s, p) => s + p.success, 0);
  const totalFailed = series.reduce((s, p) => s + p.failed, 0);
  return {
    totalRequests: totalSuccess + totalFailed,
    successCount: totalSuccess,
    failedCount: totalFailed,
    avgResponseMs: Math.round(series.reduce((s, p) => s + p.avgResponseMs, 0) / series.length),
    p95ResponseMs: 410,
    series,
  };
}

export async function fetchApiSecurityEvents(): Promise<ApiSecurityEvent[]> {
  await ensureSeeded();
  const agencies = await loadAgencyOptions();
  const first = agencies[0];
  const second = agencies[1];
  const events: ApiSecurityEvent[] = [];
  if (first) {
    events.push({ id: newId('sec'), agencyId: first.id, agencyNameFa: first.nameFa, environment: 'PRODUCTION', labelFa: 'عبور از سقف نرخ درخواست', severity: 'warn', detailFa: 'بیش از حد مجاز درخواست در یک دقیقه ثبت شد.', createdAt: isoDaysAgo(0) });
  }
  if (second) {
    events.push({ id: newId('sec'), agencyId: second.id, agencyNameFa: second.nameFa, environment: 'PRODUCTION', labelFa: 'تلاش از IP غیرمجاز', severity: 'critical', detailFa: 'درخواست از آدرسی خارج از فهرست IP مجاز رد شد.', createdAt: isoDaysAgo(1) });
  }
  return events;
}

export async function fetchApiAuditLog(): Promise<ApiAuditLogEntry[]> {
  await ensureSeeded();
  return auditStore;
}

export async function fetchSanitizedRequestLog(): Promise<ApiRequestLogEntry[]> {
  await ensureSeeded();
  const agencies = await loadAgencyOptions();
  const endpoints = ['/v1/search', '/v1/book', '/v1/ticket/issue', '/v1/pnr/{pnr}'];
  return agencies.slice(0, 5).map((agency, idx) => ({
    id: newId('log'),
    agencyId: agency.id,
    agencyNameFa: agency.nameFa,
    environment: idx % 2 === 0 ? 'PRODUCTION' : 'SANDBOX',
    endpoint: endpoints[idx % endpoints.length]!,
    method: idx % 4 === 2 ? 'POST' : 'GET',
    statusCode: idx % 5 === 0 ? 429 : 200,
    responseMs: 120 + idx * 30,
    ipMasked: `185.143.xx.${10 + idx}`,
    requestIdHeader: `req-${1000 + idx}`,
    createdAt: isoDaysAgo(idx),
  }));
}
