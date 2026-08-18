import { useCallback, useEffect, useState } from 'react';
import {
  fetchAgencyOptionsList,
  fetchApiAuditLog,
  fetchApiSecurityEvents,
  fetchApiUsageSummary,
  fetchSanitizedRequestLog,
} from '../../api/it-webservice-access-mock';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type {
  ApiAuditLogEntry,
  ApiEnvironment,
  ApiRequestLogEntry,
  ApiSecurityEvent,
  ApiUsageSummary,
} from '../../types/it-webservice-access';

const SEVERITY_LABEL: Record<ApiSecurityEvent['severity'], { label: string; className: string }> = {
  info: { label: 'اطلاع‌رسانی', className: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]' },
  warn: { label: 'هشدار', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  critical: { label: 'بحرانی', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
};

export default function MonitoringSection() {
  const [agencyOptions, setAgencyOptions] = useState<{ id: string; nameFa: string }[]>([]);
  const [agencyFilter, setAgencyFilter] = useState('');
  const [envFilter, setEnvFilter] = useState<ApiEnvironment | ''>('');
  const [usage, setUsage] = useState<ApiUsageSummary | null>(null);
  const [events, setEvents] = useState<ApiSecurityEvent[] | null>(null);
  const [audit, setAudit] = useState<ApiAuditLogEntry[] | null>(null);
  const [requestLog, setRequestLog] = useState<ApiRequestLogEntry[] | null>(null);
  const [detail, setDetail] = useState<ApiRequestLogEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [u, ev, aud, reqLog, agencies] = await Promise.all([
        fetchApiUsageSummary({ agencyId: agencyFilter || undefined, environment: envFilter || undefined }),
        fetchApiSecurityEvents(),
        fetchApiAuditLog(),
        fetchSanitizedRequestLog(),
        fetchAgencyOptionsList(),
      ]);
      setUsage(u);
      setEvents(ev);
      setAudit(aud);
      setRequestLog(reqLog);
      setAgencyOptions(agencies);
    } catch {
      setError('سرویس مانیتورینگ API در دسترس نیست. دوباره تلاش کنید.');
    }
  }, [agencyFilter, envFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs text-[#f87171]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} aria-label="فیلتر آژانس مانیتورینگ" className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none">
          <option value="">همهٔ آژانس‌ها</option>
          {agencyOptions.map((a) => <option key={a.id} value={a.id}>{a.nameFa}</option>)}
        </select>
        <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value as ApiEnvironment | '')} aria-label="فیلتر محیط مانیتورینگ" className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none">
          <option value="">همهٔ محیط‌ها</option>
          <option value="SANDBOX">Sandbox</option>
          <option value="PRODUCTION">Production</option>
        </select>
      </div>

      {usage === null ? (
        <p className="py-6 text-center text-xs text-[#6b7b94]">در حال بارگذاری آمار…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-3">
              <div className="font-num text-lg font-black text-white">{faDigits(usage.totalRequests)}</div>
              <div className="mt-0.5 text-[10.5px] text-[#6b7b94]">کل درخواست‌ها</div>
            </div>
            <div className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-3">
              <div className="font-num text-lg font-black text-[#34d399]">{faDigits(usage.successCount)}</div>
              <div className="mt-0.5 text-[10.5px] text-[#6b7b94]">موفق</div>
            </div>
            <div className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-3">
              <div className="font-num text-lg font-black text-[#f87171]">{faDigits(usage.failedCount)}</div>
              <div className="mt-0.5 text-[10.5px] text-[#6b7b94]">ناموفق</div>
            </div>
            <div className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-3">
              <div className="font-num text-lg font-black text-white">{faDigits(usage.avgResponseMs)}ms</div>
              <div className="mt-0.5 text-[10.5px] text-[#6b7b94]">میانگین پاسخ (p95: {faDigits(usage.p95ResponseMs)}ms)</div>
            </div>
          </div>

          <section className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-4">
            <h3 className="mb-3 text-[13px] font-extrabold text-white">روند درخواست‌ها</h3>
            <div className="flex flex-col gap-1.5">
              {usage.series.map((p) => {
                const max = Math.max(...usage.series.map((s) => s.success + s.failed), 1);
                return (
                  <div key={p.bucketLabelFa} className="flex items-center gap-2 text-[10.5px]">
                    <span className="w-14 shrink-0 text-[#9fb0c7]">{p.bucketLabelFa}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1f2a3d]">
                      <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${((p.success + p.failed) / max) * 100}%` }} />
                    </div>
                    <span className="font-num w-24 shrink-0 text-left text-[#6b7b94]">{faDigits(p.success)}✓ / {faDigits(p.failed)}✗</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-4">
        <h3 className="mb-3 text-[13px] font-extrabold text-white">رویدادهای امنیتی</h3>
        {events === null ? (
          <p className="py-4 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
        ) : events.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#6b7b94]">رویداد امنیتی ثبت نشده است.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} data-testid="security-event-row" className="flex items-center gap-2.5 rounded-lg border border-[#1f2a3d] p-2.5 text-xs">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${SEVERITY_LABEL[e.severity].className}`}>{SEVERITY_LABEL[e.severity].label}</span>
                <span className="flex-1 text-[#cdd6e3]">
                  <span className="font-bold text-[#e7ecf3]">{e.labelFa}</span>
                  {e.agencyNameFa && <span className="text-[#6b7b94]"> · {e.agencyNameFa}</span>}
                  <span className="mt-0.5 block text-[10px] text-[#6b7b94]">{e.detailFa}</span>
                </span>
                <span className="font-num shrink-0 text-[10px] text-[#6b7b94]">{formatJalaliDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-4">
        <h3 className="mb-3 text-[13px] font-extrabold text-white">لاگ حسابرسی (Audit Log)</h3>
        {audit === null ? (
          <p className="py-4 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
        ) : audit.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#6b7b94]">رویدادی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-[#1f2a3d]">
            {audit.map((a) => (
              <li key={a.id} data-testid="api-audit-row" className="flex items-center gap-2.5 py-2 text-[11px]">
                <span className="font-bold text-[#cdd6e3]">{a.actorNameFa}</span>
                <span className="text-[#6b7b94]">{a.detailFa}</span>
                {a.agencyNameFa && <span className="text-[#6b7b94]">· {a.agencyNameFa}</span>}
                <span className="font-num mr-auto shrink-0 text-[10px] text-[#6b7b94]">{formatJalaliDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13px] font-extrabold text-white">درخواست‌های اخیر (Sanitized)</h3>
        </div>
        <p className="mb-3 text-[10.5px] text-[#6b7b94]">هرگز توکن، رمز عبور یا اطلاعات هویتی مسافر نمایش داده نمی‌شود.</p>
        {requestLog === null ? (
          <p className="py-4 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
        ) : requestLog.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#6b7b94]">درخواستی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-[#1f2a3d]">
            {requestLog.map((r) => (
              <li key={r.id} data-testid="api-request-log-row" className="flex items-center gap-2.5 py-2 text-[11px]">
                <span className="font-num rounded bg-[#18223a] px-1.5 py-0.5 text-[10px] font-bold text-[#9fb0c7]" dir="ltr">{r.method}</span>
                <span className="font-num text-[#cdd6e3]" dir="ltr">{r.endpoint}</span>
                <span className="text-[#6b7b94]">{r.agencyNameFa}</span>
                <span className={`font-num rounded-full px-2 py-0.5 text-[10px] font-bold ${r.statusCode >= 400 ? 'bg-[rgba(248,113,113,.14)] text-[#f87171]' : 'bg-[rgba(16,185,129,.14)] text-[#34d399]'}`}>{faDigits(r.statusCode)}</span>
                <button onClick={() => setDetail(r)} className="mr-auto shrink-0 text-[10.5px] font-bold text-[#3b82f6]">جزئیات</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <Modal variant="dark" title="جزئیات درخواست (اطلاعات پاک‌سازی‌شده)" onClose={() => setDetail(null)}>
          <dl className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">آژانس</dt><dd className="font-bold text-[#e7ecf3]">{detail.agencyNameFa}</dd></div>
            <div className="rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">محیط</dt><dd className="font-num font-bold text-[#e7ecf3]">{detail.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}</dd></div>
            <div className="rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">Endpoint</dt><dd className="font-num font-bold text-[#e7ecf3]" dir="ltr">{detail.method} {detail.endpoint}</dd></div>
            <div className="rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">کد پاسخ</dt><dd className="font-num font-bold text-[#e7ecf3]">{faDigits(detail.statusCode)}</dd></div>
            <div className="rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">زمان پاسخ</dt><dd className="font-num font-bold text-[#e7ecf3]">{faDigits(detail.responseMs)}ms</dd></div>
            <div className="rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">IP (ماسک‌شده)</dt><dd className="font-num font-bold text-[#e7ecf3]" dir="ltr">{detail.ipMasked}</dd></div>
            <div className="col-span-2 rounded-lg bg-[#18223a] p-2.5"><dt className="text-[10px] text-[#6b7b94]">Request ID</dt><dd className="font-num font-bold text-[#e7ecf3]" dir="ltr">{detail.requestIdHeader}</dd></div>
          </dl>
          <button onClick={() => setDetail(null)} className="mt-4 w-full rounded-lg bg-[#18223a] px-4 py-2.5 text-xs font-bold text-[#cdd6e3]">بستن</button>
        </Modal>
      )}
    </div>
  );
}
