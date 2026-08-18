import { useCallback, useEffect, useState } from 'react';
import {
  SCOPE_CATALOG,
  fetchAgencyCredentials,
  fetchAgencyOptionsList,
  fetchFlightOptions,
  fetchRouteOptions,
  issueAgencyCredential,
  reactivateAgencyCredential,
  revokeAgencyCredential,
  rotateAgencyCredential,
  suspendAgencyCredential,
  updateAccessConfig,
} from '../../api/it-webservice-access-mock';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import AccessConfigFields, { validateAccessConfig, type AccessConfigFieldErrors } from './AccessConfigFields';
import type {
  AccessConfig,
  AgencyApiCredential,
  AgencyApiCredentialIssued,
  ApiCredentialStatus,
  ApiEnvironment,
  ApiFlightOption,
  ApiRouteOption,
} from '../../types/it-webservice-access';

const STATUS_LABEL: Record<ApiCredentialStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'فعال', className: 'bg-[rgba(16,185,129,.14)] text-[#34d399]' },
  SUSPENDED: { label: 'معلق', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  REVOKED: { label: 'ابطال‌شده', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
  EXPIRED: { label: 'منقضی‌شده', className: 'bg-[rgba(107,123,148,.18)] text-[#9fb0c7]' },
};

function emptyConfig(): AccessConfig {
  return { scopes: [], allowedRoutes: [], allowedFlightIds: [], rateLimitPerMinute: 60, allowedCidrs: [], expiresAt: null };
}

interface Props {
  canManage: boolean;
}

export default function CredentialsSection({ canManage }: Props) {
  const [credentials, setCredentials] = useState<AgencyApiCredential[] | null>(null);
  const [agencyOptions, setAgencyOptions] = useState<{ id: string; nameFa: string }[]>([]);
  const [routeOptions, setRouteOptions] = useState<ApiRouteOption[]>([]);
  const [flightOptions, setFlightOptions] = useState<ApiFlightOption[]>([]);
  const [envFilter, setEnvFilter] = useState<ApiEnvironment | ''>('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueAgencyId, setIssueAgencyId] = useState('');
  const [issueEnv, setIssueEnv] = useState<ApiEnvironment>('SANDBOX');
  const [issueConfig, setIssueConfig] = useState<AccessConfig>(emptyConfig());
  const [issueErrors, setIssueErrors] = useState<AccessConfigFieldErrors>({});
  const [issueApiError, setIssueApiError] = useState<string | null>(null);
  const [issueBusy, setIssueBusy] = useState(false);

  const [configTarget, setConfigTarget] = useState<AgencyApiCredential | null>(null);
  const [configDraft, setConfigDraft] = useState<AccessConfig>(emptyConfig());
  const [configErrors, setConfigErrors] = useState<AccessConfigFieldErrors>({});
  const [configApiError, setConfigApiError] = useState<string | null>(null);

  const [revealSecret, setRevealSecret] = useState<AgencyApiCredentialIssued | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{ credential: AgencyApiCredential; action: 'suspend' | 'reactivate' | 'revoke' | 'rotate' } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [creds, agencies, routes, flights] = await Promise.all([
        fetchAgencyCredentials({ agencyId: agencyFilter || undefined, environment: envFilter || undefined }),
        fetchAgencyOptionsList(),
        fetchRouteOptions(),
        fetchFlightOptions(),
      ]);
      setCredentials(creds);
      setAgencyOptions(agencies);
      setRouteOptions(routes);
      setFlightOptions(flights);
    } catch {
      setError('سرویس مدیریت کلیدهای API در دسترس نیست. دوباره تلاش کنید.');
    }
  }, [agencyFilter, envFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openIssue() {
    setIssueAgencyId(agencyOptions[0]?.id ?? '');
    setIssueEnv('SANDBOX');
    setIssueConfig(emptyConfig());
    setIssueErrors({});
    setIssueApiError(null);
    setIssueOpen(true);
  }

  async function submitIssue() {
    if (!issueAgencyId) {
      setIssueApiError('یک آژانس انتخاب کنید.');
      return;
    }
    const errs = validateAccessConfig(issueConfig);
    setIssueErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setIssueBusy(true);
    setIssueApiError(null);
    try {
      const issued = await issueAgencyCredential(issueAgencyId, issueEnv, issueConfig);
      setIssueOpen(false);
      setRevealSecret(issued);
      setCopyDone(false);
      await load();
    } catch (e) {
      setIssueApiError(e instanceof Error ? e.message : 'خطا در صدور کلید.');
    } finally {
      setIssueBusy(false);
    }
  }

  function openConfig(cred: AgencyApiCredential) {
    setConfigTarget(cred);
    setConfigDraft(cred.config);
    setConfigErrors({});
    setConfigApiError(null);
  }

  async function submitConfig() {
    if (!configTarget) return;
    const errs = validateAccessConfig(configDraft);
    setConfigErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await updateAccessConfig(configTarget.id, configDraft);
      setNotice('پیکربندی دسترسی ذخیره شد ✓');
      setConfigTarget(null);
      await load();
    } catch (e) {
      setConfigApiError(e instanceof Error ? e.message : 'خطا در ذخیرهٔ پیکربندی.');
    }
  }

  async function runStatusAction() {
    if (!statusConfirm) return;
    setStatusBusy(true);
    try {
      const { credential, action } = statusConfirm;
      if (action === 'suspend') {
        await suspendAgencyCredential(credential.id);
        setNotice(`کلید آژانس «${credential.agencyNameFa}» معلق شد.`);
      } else if (action === 'reactivate') {
        await reactivateAgencyCredential(credential.id);
        setNotice(`کلید آژانس «${credential.agencyNameFa}» فعال شد.`);
      } else if (action === 'revoke') {
        await revokeAgencyCredential(credential.id);
        setNotice(`کلید آژانس «${credential.agencyNameFa}» به‌طور دائم ابطال شد.`);
      } else {
        const issued = await rotateAgencyCredential(credential.id);
        setRevealSecret(issued);
        setCopyDone(false);
      }
      setStatusConfirm(null);
      await load();
    } catch {
      setError('خطا در اجرای عملیات روی کلید.');
    } finally {
      setStatusBusy(false);
    }
  }

  if (!canManage) {
    return (
      <p role="alert" className="rounded-xl border border-[#28344c] bg-[#141d2e] p-6 text-center text-xs text-[#f87171]">
        دسترسی شما برای مدیریت کلیدهای API آژانس‌ها کافی نیست.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs text-[#f87171]">{error}</p>}
      {notice && <p className="rounded-lg bg-[rgba(16,185,129,.12)] p-3 text-xs text-[#34d399]">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} aria-label="فیلتر آژانس" className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none">
            <option value="">همهٔ آژانس‌ها</option>
            {agencyOptions.map((a) => <option key={a.id} value={a.id}>{a.nameFa}</option>)}
          </select>
          <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value as ApiEnvironment | '')} aria-label="فیلتر محیط" className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none">
            <option value="">همهٔ محیط‌ها</option>
            <option value="SANDBOX">Sandbox</option>
            <option value="PRODUCTION">Production</option>
          </select>
        </div>
        <button onClick={openIssue} disabled={agencyOptions.length === 0} className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          صدور کلید جدید
        </button>
      </div>

      {credentials === null ? (
        <p className="py-8 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
      ) : credentials.length === 0 ? (
        <p className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] py-10 text-center text-xs text-[#6b7b94]">
          {agencyOptions.length === 0 ? 'آژانسی برای صدور کلید ثبت نشده است.' : 'کلید API فعالی برای این فیلترها یافت نشد.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {credentials.map((c) => (
            <div key={c.id} data-testid="api-credential-card" className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#e7ecf3]">{c.agencyNameFa}</div>
                  <div className="mt-0.5 font-num text-[10px] text-[#6b7b94]">{c.keyId}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-[#18223a] px-2 py-0.5 text-[10px] font-bold text-[#9fb0c7]">
                    {c.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_LABEL[c.status].className}`}>{STATUS_LABEL[c.status].label}</span>
                </div>
              </div>
              <div className="font-num mb-2 truncate rounded-md bg-[#0f1623] px-2 py-1.5 text-[11px] text-[#9fb0c7]" dir="ltr">{c.maskedKey}</div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-[10.5px] text-[#6b7b94]">
                <span>صدور: <span className="font-num text-[#cdd6e3]">{formatJalaliDateTime(c.createdAt)}</span></span>
                <span>آخرین استفاده: <span className="font-num text-[#cdd6e3]">{c.lastUsedAt ? formatJalaliDateTime(c.lastUsedAt) : '—'}</span></span>
                <span>انقضا: <span className="font-num text-[#cdd6e3]">{c.config.expiresAt ? formatJalaliDateTime(c.config.expiresAt) : 'نامحدود'}</span></span>
                <span>سقف نرخ: <span className="font-num text-[#cdd6e3]">{faDigits(c.config.rateLimitPerMinute)}/دقیقه</span></span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => openConfig(c)} className="rounded-lg border border-[#1f2a3d] px-2.5 py-1 text-[10.5px] font-bold text-[#3b82f6]">پیکربندی دسترسی</button>
                {c.status !== 'REVOKED' && (
                  <button onClick={() => setStatusConfirm({ credential: c, action: 'rotate' })} className="rounded-lg border border-[#1f2a3d] px-2.5 py-1 text-[10.5px] font-bold text-[#60a5fa]">چرخش کلید</button>
                )}
                {c.status === 'ACTIVE' && (
                  <button onClick={() => setStatusConfirm({ credential: c, action: 'suspend' })} className="rounded-lg border border-[#1f2a3d] px-2.5 py-1 text-[10.5px] font-bold text-[#f59e0b]">تعلیق</button>
                )}
                {c.status === 'SUSPENDED' && (
                  <button onClick={() => setStatusConfirm({ credential: c, action: 'reactivate' })} className="rounded-lg border border-[#1f2a3d] px-2.5 py-1 text-[10.5px] font-bold text-[#34d399]">فعال‌سازی مجدد</button>
                )}
                {c.status !== 'REVOKED' && (
                  <button onClick={() => setStatusConfirm({ credential: c, action: 'revoke' })} className="rounded-lg border border-[#f87171]/40 px-2.5 py-1 text-[10.5px] font-bold text-[#f87171]">ابطال</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {issueOpen && (
        <Modal variant="dark" title="صدور کلید API جدید" onClose={() => setIssueOpen(false)}>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="issue-agency" className="mb-1 block text-xs font-bold text-[#e7ecf3]">آژانس</label>
              <select id="issue-agency" value={issueAgencyId} onChange={(e) => setIssueAgencyId(e.target.value)} className="w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none">
                {agencyOptions.map((a) => <option key={a.id} value={a.id}>{a.nameFa}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="issue-env" className="mb-1 block text-xs font-bold text-[#e7ecf3]">محیط</label>
              <select id="issue-env" value={issueEnv} onChange={(e) => setIssueEnv(e.target.value as ApiEnvironment)} className="w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-3 text-xs text-[#e7ecf3] outline-none">
                <option value="SANDBOX">Sandbox</option>
                <option value="PRODUCTION">Production</option>
              </select>
            </div>
          </div>
          <AccessConfigFields
            idPrefix="issue"
            value={issueConfig}
            onChange={setIssueConfig}
            scopeOptions={SCOPE_CATALOG}
            routeOptions={routeOptions}
            flightOptions={flightOptions}
            errors={issueErrors}
          />
          {issueApiError && <p role="alert" className="mt-3 text-xs text-[#f87171]">{issueApiError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setIssueOpen(false)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">انصراف</button>
            <button onClick={() => void submitIssue()} disabled={issueBusy} className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              {issueBusy ? 'در حال صدور…' : 'صدور کلید'}
            </button>
          </div>
        </Modal>
      )}

      {configTarget && (
        <Modal variant="dark" title={`پیکربندی دسترسی — ${configTarget.agencyNameFa}`} onClose={() => setConfigTarget(null)}>
          <AccessConfigFields
            idPrefix="edit-config"
            value={configDraft}
            onChange={setConfigDraft}
            scopeOptions={SCOPE_CATALOG}
            routeOptions={routeOptions}
            flightOptions={flightOptions}
            errors={configErrors}
          />
          {configApiError && <p role="alert" className="mt-3 text-xs text-[#f87171]">{configApiError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setConfigTarget(null)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">انصراف</button>
            <button onClick={() => void submitConfig()} className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white">ذخیره پیکربندی</button>
          </div>
        </Modal>
      )}

      {revealSecret && (
        <Modal variant="dark" title="کلید API صادر شد" onClose={() => setRevealSecret(null)}>
          <p className="mb-3 text-xs leading-6 text-[#9fb0c7]">
            این کلید فقط همین یک‌بار به‌صورت کامل نمایش داده می‌شود؛ پس از بستن این پنجره، دیگر قابل بازیابی نیست و
            فقط نسخهٔ ماسک‌شده در فهرست باقی می‌ماند. آن را از طریق کانال امن در اختیار آژانس «{revealSecret.agencyNameFa}» قرار دهید.
          </p>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-[#3b82f6]/40 bg-[#3b82f6]/10 p-3">
            <span className="font-num select-all text-sm font-black text-[#60a5fa]" dir="ltr">{revealSecret.rawKey}</span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(revealSecret.rawKey).catch(() => undefined);
                setCopyDone(true);
              }}
              className="shrink-0 rounded-lg bg-[#18223a] px-3 py-1.5 text-[10.5px] font-bold text-[#e7ecf3]"
            >
              {copyDone ? 'کپی شد ✓' : 'کپی'}
            </button>
          </div>
          <button onClick={() => setRevealSecret(null)} className="w-full rounded-lg bg-[#3b82f6] px-4 py-2.5 text-xs font-bold text-white">متوجه شدم</button>
        </Modal>
      )}

      {statusConfirm && (
        <Modal
          variant="dark"
          title={
            statusConfirm.action === 'suspend' ? 'تعلیق کلید API'
            : statusConfirm.action === 'reactivate' ? 'فعال‌سازی مجدد کلید API'
            : statusConfirm.action === 'revoke' ? 'ابطال دائمی کلید API'
            : 'چرخش کلید API'
          }
          onClose={() => setStatusConfirm(null)}
        >
          <p className="mb-4 text-xs leading-6 text-[#9fb0c7]">
            {statusConfirm.action === 'suspend' && `دسترسی آژانس «${statusConfirm.credential.agencyNameFa}» تا فعال‌سازی مجدد قطع می‌شود.`}
            {statusConfirm.action === 'reactivate' && `دسترسی آژانس «${statusConfirm.credential.agencyNameFa}» دوباره برقرار می‌شود.`}
            {statusConfirm.action === 'revoke' && `این کلید برای همیشه باطل می‌شود و قابل بازگشت نیست. آژانس «${statusConfirm.credential.agencyNameFa}» باید کلید جدیدی درخواست کند.`}
            {statusConfirm.action === 'rotate' && `کلید فعلی آژانس «${statusConfirm.credential.agencyNameFa}» بی‌اثر شده و یک کلید جدید صادر می‌شود.`}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setStatusConfirm(null)} disabled={statusBusy} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">انصراف</button>
            <button
              onClick={() => void runStatusAction()}
              disabled={statusBusy}
              className={`rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-60 ${statusConfirm.action === 'revoke' ? 'bg-danger' : 'bg-[#3b82f6]'}`}
            >
              {statusBusy ? 'در حال اجرا…' : 'تأیید'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
