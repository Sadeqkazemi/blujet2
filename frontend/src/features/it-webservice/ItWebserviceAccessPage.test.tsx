import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ItWebserviceAccessPage from './ItWebserviceAccessPage';
import * as mockApi from '../../api/it-webservice-access-mock';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUserWithRole } from '../../test/mockAuthUser';
import type {
  AgencyApiCredential,
  ApiAccessRequest,
  ApiAuditLogEntry,
  ApiRequestLogEntry,
  ApiSecurityEvent,
  ApiUsageSummary,
} from '../../types/it-webservice-access';

const AGENCIES = [
  { id: 'ag1', nameFa: 'آژانس پارسیان' },
  { id: 'ag2', nameFa: 'آژانس آسمان' },
];

const REQUEST: ApiAccessRequest = {
  id: 'req1',
  agencyId: 'ag1',
  agencyNameFa: 'آژانس پارسیان',
  environment: 'PRODUCTION',
  status: 'PENDING',
  requestedScopes: ['SEARCH', 'BOOK'],
  requestedRoutes: ['THR-MHD'],
  note: 'درخواست اتصال اولیه',
  decisionNote: null,
  decidedByNameFa: null,
  decidedAt: null,
  createdAt: '2026-08-01T08:00:00.000Z',
  expiresAt: null,
};

const CREDENTIAL: AgencyApiCredential = {
  id: 'cred1',
  agencyId: 'ag2',
  agencyNameFa: 'آژانس آسمان',
  environment: 'SANDBOX',
  keyId: 'key_ag2_sbx',
  maskedKey: 'sk_test_••••••••3f9a',
  status: 'ACTIVE',
  createdAt: '2026-07-20T08:00:00.000Z',
  lastUsedAt: null,
  config: { scopes: ['SEARCH'], allowedRoutes: [], allowedFlightIds: [], rateLimitPerMinute: 60, allowedCidrs: [], expiresAt: null },
};

const USAGE: ApiUsageSummary = {
  totalRequests: 100,
  successCount: 90,
  failedCount: 10,
  avgResponseMs: 200,
  p95ResponseMs: 400,
  series: [{ bucketLabelFa: 'شنبه', success: 90, failed: 10, avgResponseMs: 200 }],
};

const SECURITY_EVENTS: ApiSecurityEvent[] = [
  { id: 'sec1', agencyId: 'ag1', agencyNameFa: 'آژانس پارسیان', environment: 'PRODUCTION', labelFa: 'عبور از سقف نرخ درخواست', severity: 'warn', detailFa: 'جزئیات رویداد', createdAt: '2026-08-01T00:00:00.000Z' },
];

const AUDIT: ApiAuditLogEntry[] = [
  { id: 'aud1', actorNameFa: 'مدیر فناوری اطلاعات', action: 'ISSUE_KEY', detailFa: 'صدور کلید Sandbox', agencyNameFa: 'آژانس آسمان', createdAt: '2026-08-01T00:00:00.000Z' },
];

const REQUEST_LOG: ApiRequestLogEntry[] = [
  { id: 'log1', agencyId: 'ag1', agencyNameFa: 'آژانس پارسیان', environment: 'PRODUCTION', endpoint: '/v1/search', method: 'GET', statusCode: 200, responseMs: 150, ipMasked: '185.143.xx.10', requestIdHeader: 'req-1000', createdAt: '2026-08-01T00:00:00.000Z' },
];

function stubAllApis() {
  vi.spyOn(mockApi, 'fetchAgencyOptionsList').mockResolvedValue(AGENCIES);
  vi.spyOn(mockApi, 'fetchRouteOptions').mockResolvedValue([{ key: 'THR-MHD', labelFa: 'تهران ← مشهد (THR-MHD)' }]);
  vi.spyOn(mockApi, 'fetchFlightOptions').mockResolvedValue([]);
  vi.spyOn(mockApi, 'fetchApiAccessRequests').mockResolvedValue([REQUEST]);
  vi.spyOn(mockApi, 'fetchAgencyCredentials').mockResolvedValue([CREDENTIAL]);
  vi.spyOn(mockApi, 'fetchApiUsageSummary').mockResolvedValue(USAGE);
  vi.spyOn(mockApi, 'fetchApiSecurityEvents').mockResolvedValue(SECURITY_EVENTS);
  vi.spyOn(mockApi, 'fetchApiAuditLog').mockResolvedValue(AUDIT);
  vi.spyOn(mockApi, 'fetchSanitizedRequestLog').mockResolvedValue(REQUEST_LOG);
}

describe('ItWebserviceAccessPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a permission-denied message for a non-manager role', async () => {
    vi.spyOn(useAuthModule, 'useOptionalAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUserWithRole('EMPLOYEE'),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    stubAllApis();

    render(<ItWebserviceAccessPage />);
    expect(await screen.findAllByText(/دسترسی شما .* کافی نیست/)).not.toHaveLength(0);
  });

  it('renders pending requests and approves one with a note', async () => {
    stubAllApis();
    const decideSpy = vi.spyOn(mockApi, 'decideApiAccessRequest').mockResolvedValue({ ...REQUEST, status: 'APPROVED' });

    render(<ItWebserviceAccessPage />);
    const row = await screen.findByTestId('api-request-row');
    expect(within(row).getByText('آژانس پارسیان')).toBeInTheDocument();
    expect(within(row).getByText('در انتظار بررسی')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: 'جزئیات' }));
    await user.click(await screen.findByRole('button', { name: 'تأیید درخواست' }));
    await user.type(screen.getByLabelText('توضیح (اختیاری)'), 'تأیید شد پس از بررسی مدارک');
    await user.click(screen.getByRole('button', { name: 'تأیید نهایی پذیرش' }));

    await waitFor(() => expect(decideSpy).toHaveBeenCalledWith('req1', { approve: true, note: 'تأیید شد پس از بررسی مدارک' }));
  });

  it('filters requests by search query and shows the empty state', async () => {
    stubAllApis();
    const listSpy = vi.spyOn(mockApi, 'fetchApiAccessRequests').mockResolvedValue([REQUEST]);

    render(<ItWebserviceAccessPage />);
    expect(await screen.findByTestId('api-request-row')).toBeInTheDocument();

    listSpy.mockResolvedValue([]);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('جستجوی نام آژانس'), 'ناموجود');
    await user.click(screen.getByRole('button', { name: 'جستجو' }));

    expect(await screen.findByText('درخواستی با این فیلترها یافت نشد.')).toBeInTheDocument();
  });

  it('never renders the full API key — only the masked form on the credentials tab', async () => {
    stubAllApis();

    render(<ItWebserviceAccessPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'کلیدهای آژانس‌ها' }));

    expect(await screen.findByText('sk_test_••••••••3f9a')).toBeInTheDocument();
    expect(screen.queryByText(/^sk_test_(?!••)/)).not.toBeInTheDocument();
  });

  it('issues a new key, reveals the raw secret exactly once, and requires at least one scope', async () => {
    stubAllApis();
    const issueSpy = vi.spyOn(mockApi, 'issueAgencyCredential').mockResolvedValue({
      ...CREDENTIAL,
      id: 'cred2',
      rawKey: 'sk_test_RAWSECRET1234',
    });

    render(<ItWebserviceAccessPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'کلیدهای آژانس‌ها' }));
    await user.click(await screen.findByRole('button', { name: 'صدور کلید جدید' }));

    await user.click(screen.getByRole('button', { name: 'صدور کلید' }));
    expect(await screen.findByText('حداقل یک قلمرو دسترسی (Scope) انتخاب کنید.')).toBeInTheDocument();
    expect(issueSpy).not.toHaveBeenCalled();

    await user.click(screen.getByText('جستجوی پرواز و نرخ'));
    await user.click(screen.getByRole('button', { name: 'صدور کلید' }));

    expect(await screen.findByText('sk_test_RAWSECRET1234')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'متوجه شدم' }));
    expect(screen.queryByText('sk_test_RAWSECRET1234')).not.toBeInTheDocument();
  });

  it('asks for confirmation before suspending a key', async () => {
    stubAllApis();
    const suspendSpy = vi.spyOn(mockApi, 'suspendAgencyCredential').mockResolvedValue({ ...CREDENTIAL, status: 'SUSPENDED' });

    render(<ItWebserviceAccessPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'کلیدهای آژانس‌ها' }));
    await user.click(await screen.findByRole('button', { name: 'تعلیق' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/دسترسی آژانس «آژانس آسمان» تا فعال‌سازی مجدد قطع می‌شود/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'تأیید' }));

    await waitFor(() => expect(suspendSpy).toHaveBeenCalledWith('cred1'));
  });

  it('shows monitoring stats, security events, audit log and a sanitized request detail modal', async () => {
    stubAllApis();

    render(<ItWebserviceAccessPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'مانیتورینگ و لاگ‌ها' }));

    expect(await screen.findByText('عبور از سقف نرخ درخواست')).toBeInTheDocument();
    expect(screen.getByText('صدور کلید Sandbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'جزئیات' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('req-1000')).toBeInTheDocument();
    expect(within(dialog).queryByText(/token|password|رمز عبور/i)).not.toBeInTheDocument();
  });

  it('shows an API-unavailable error banner when the requests service fails', async () => {
    stubAllApis();
    vi.spyOn(mockApi, 'fetchApiAccessRequests').mockRejectedValue(new Error('network'));

    render(<ItWebserviceAccessPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('سرویس دسترسی API در دسترس نیست');
  });
});
