import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  decideApiAccessRequest,
  fetchAgencyOptionsList,
  fetchApiAccessRequests,
  fetchRouteOptions,
} from '../../api/it-webservice-access-mock';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { ApiAccessRequest, ApiAccessRequestFilters, ApiAccessRequestStatus, ApiRouteOption } from '../../types/it-webservice-access';

const STATUS_LABEL: Record<ApiAccessRequestStatus, { label: string; className: string }> = {
  PENDING: { label: 'در انتظار بررسی', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  APPROVED: { label: 'تأییدشده', className: 'bg-[rgba(16,185,129,.14)] text-[#34d399]' },
  REJECTED: { label: 'ردشده', className: 'bg-[rgba(248,113,113,.14)] text-[#f87171]' },
  SUSPENDED: { label: 'معلق', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  EXPIRED: { label: 'منقضی‌شده', className: 'bg-[rgba(107,123,148,.18)] text-[#9fb0c7]' },
};

const SCOPE_LABEL_FA: Record<string, string> = {
  SEARCH: 'جستجو',
  BOOK: 'رزرو',
  TICKET_ISSUE: 'صدور بلیط',
  CANCEL_REFUND: 'ابطال/استرداد',
  PNR_MANAGE: 'مدیریت PNR',
  REPORTING: 'گزارش فروش',
};

interface Props {
  canManage: boolean;
}

export default function RequestsSection({ canManage }: Props) {
  const [requests, setRequests] = useState<ApiAccessRequest[] | null>(null);
  const [agencyOptions, setAgencyOptions] = useState<{ id: string; nameFa: string }[]>([]);
  const [routeOptions, setRouteOptions] = useState<ApiRouteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState<ApiAccessRequestFilters>({});
  const [qDraft, setQDraft] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<{ approve: boolean; note: string } | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, agencies, routes] = await Promise.all([
        fetchApiAccessRequests(filters),
        fetchAgencyOptionsList(),
        fetchRouteOptions(),
      ]);
      setRequests(data);
      setAgencyOptions(agencies);
      setRouteOptions(routes);
    } catch {
      setError('سرویس دسترسی API در دسترس نیست. دوباره تلاش کنید.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    setFilters((f) => ({ ...f, q: qDraft.trim() || undefined }));
  }

  const pager = usePagination(requests ?? []);
  const detail = useMemo(() => requests?.find((r) => r.id === detailId) ?? null, [requests, detailId]);

  async function submitDecision() {
    if (!detail || !decisionDraft) return;
    setDecisionBusy(true);
    setDecisionError(null);
    try {
      await decideApiAccessRequest(detail.id, { approve: decisionDraft.approve, note: decisionDraft.note });
      setNotice(decisionDraft.approve ? `درخواست آژانس «${detail.agencyNameFa}» تأیید شد ✓` : `درخواست آژانس «${detail.agencyNameFa}» رد شد.`);
      setDecisionDraft(null);
      setDetailId(null);
      await load();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'خطا در ثبت تصمیم.');
    } finally {
      setDecisionBusy(false);
    }
  }

  if (!canManage) {
    return (
      <p role="alert" className="rounded-xl border border-[#28344c] bg-[#141d2e] p-6 text-center text-xs text-[#f87171]">
        دسترسی شما برای مشاهدهٔ درخواست‌های API آژانس‌ها کافی نیست.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs text-[#f87171]">{error}</p>}
      {notice && <p className="rounded-lg bg-[rgba(16,185,129,.12)] p-3 text-xs text-[#34d399]">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-3">
        <input
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          placeholder="جستجوی نام آژانس…"
          aria-label="جستجوی نام آژانس"
          className="min-w-[160px] flex-1 rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
        />
        <button onClick={applySearch} className="rounded-lg bg-[#18223a] px-3 py-2.5 text-[11px] font-bold text-[#cdd6e3]">
          جستجو
        </button>
        <select
          aria-label="فیلتر آژانس"
          value={filters.agencyId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, agencyId: e.target.value || undefined }))}
          className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
        >
          <option value="">همهٔ آژانس‌ها</option>
          {agencyOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.nameFa}</option>
          ))}
        </select>
        <select
          aria-label="فیلتر محیط"
          value={filters.environment ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, environment: (e.target.value || undefined) as ApiAccessRequestFilters['environment'] }))}
          className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
        >
          <option value="">همهٔ محیط‌ها</option>
          <option value="SANDBOX">Sandbox</option>
          <option value="PRODUCTION">Production</option>
        </select>
        <select
          aria-label="فیلتر وضعیت"
          value={filters.status ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as ApiAccessRequestStatus | undefined }))}
          className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
        >
          <option value="">همهٔ وضعیت‌ها</option>
          {(Object.keys(STATUS_LABEL) as ApiAccessRequestStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s].label}</option>
          ))}
        </select>
        <select
          aria-label="فیلتر مسیر"
          value={filters.route ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, route: e.target.value || undefined }))}
          className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
        >
          <option value="">همهٔ مسیرها</option>
          {routeOptions.map((r) => (
            <option key={r.key} value={r.key}>{r.labelFa}</option>
          ))}
        </select>
        <input
          type="date"
          dir="ltr"
          aria-label="از تاریخ"
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
          className="font-num rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
        />
        <input
          type="date"
          dir="ltr"
          aria-label="تا تاریخ"
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
          className="font-num rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#1f2a3d] bg-[#141d2e]">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_1fr] gap-2 border-b border-[#1f2a3d] bg-[#18223a] px-4 py-2.5 text-[10.5px] font-bold text-[#6b7b94]">
          <span>آژانس</span>
          <span>محیط</span>
          <span>وضعیت</span>
          <span>تاریخ ثبت</span>
          <span>اقدامات</span>
        </div>
        {requests === null ? (
          <p className="py-8 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
        ) : pager.pageItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#6b7b94]">درخواستی با این فیلترها یافت نشد.</p>
        ) : (
          <ul className="divide-y divide-[#1f2a3d]">
            {pager.pageItems.map((r) => (
              <li key={r.id} data-testid="api-request-row" className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_1fr] items-center gap-2 px-4 py-3 text-xs">
                <span className="font-bold text-[#e7ecf3]">{r.agencyNameFa}</span>
                <span className="font-num text-[#9fb0c7]">{r.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}</span>
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_LABEL[r.status].className}`}>
                  {STATUS_LABEL[r.status].label}
                </span>
                <span className="font-num text-[#6b7b94]">{formatJalaliDateTime(r.createdAt)}</span>
                <button onClick={() => setDetailId(r.id)} className="w-fit rounded-lg border border-[#1f2a3d] bg-[#18223a] px-2.5 py-1 text-[10.5px] font-bold text-[#cdd6e3]">
                  جزئیات
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} variant="dark" />
      </section>

      {detail && (
        <Modal variant="dark" title={`درخواست دسترسی — ${detail.agencyNameFa}`} onClose={() => { setDetailId(null); setDecisionDraft(null); setDecisionError(null); }}>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-[#18223a] p-2.5">
              <div className="text-[10px] text-[#6b7b94]">محیط</div>
              <div className="font-num font-bold text-[#e7ecf3]">{detail.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}</div>
            </div>
            <div className="rounded-lg bg-[#18223a] p-2.5">
              <div className="text-[10px] text-[#6b7b94]">وضعیت</div>
              <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_LABEL[detail.status].className}`}>{STATUS_LABEL[detail.status].label}</span>
            </div>
          </div>
          <div className="mb-3">
            <div className="mb-1.5 text-[10.5px] font-bold text-[#9fb0c7]">قلمروهای درخواستی</div>
            <div className="flex flex-wrap gap-1.5">
              {detail.requestedScopes.map((s) => (
                <span key={s} className="rounded-full bg-[#18223a] px-2.5 py-1 text-[10.5px] text-[#cdd6e3]">{SCOPE_LABEL_FA[s] ?? s}</span>
              ))}
            </div>
          </div>
          {detail.note && (
            <div className="mb-3 rounded-lg border border-[#1f2a3d] p-2.5 text-[11px] leading-6 text-[#cdd6e3]">{detail.note}</div>
          )}
          {detail.decisionNote && (
            <div className="mb-3 rounded-lg border border-[#28344c] bg-[#18223a] p-2.5 text-[11px] leading-6 text-[#9fb0c7]">
              توضیح تصمیم: {detail.decisionNote}
            </div>
          )}

          {canManage && detail.status === 'PENDING' && !decisionDraft && (
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDecisionDraft({ approve: true, note: '' })} className="flex-1 rounded-lg bg-[#3b82f6] px-4 py-2.5 text-xs font-bold text-white">
                تأیید درخواست
              </button>
              <button onClick={() => setDecisionDraft({ approve: false, note: '' })} className="flex-1 rounded-lg border border-[#f87171]/50 px-4 py-2.5 text-xs font-bold text-[#f87171]">
                رد درخواست
              </button>
            </div>
          )}

          {decisionDraft && (
            <div className="mt-4 rounded-xl border border-dashed border-[#31405d] p-3">
              <div className="mb-2 text-xs font-bold text-[#e7ecf3]">
                {decisionDraft.approve ? 'تأیید درخواست دسترسی' : 'رد درخواست دسترسی'}
              </div>
              <label htmlFor="decision-note" className="mb-1 block text-[10.5px] text-[#9fb0c7]">توضیح (اختیاری)</label>
              <textarea
                id="decision-note"
                value={decisionDraft.note}
                onChange={(e) => setDecisionDraft({ ...decisionDraft, note: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
              />
              {decisionError && <p role="alert" className="mt-1.5 text-[10.5px] text-[#f87171]">{decisionError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setDecisionDraft(null)} disabled={decisionBusy} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">
                  انصراف
                </button>
                <button
                  onClick={() => void submitDecision()}
                  disabled={decisionBusy}
                  className={`rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-60 ${decisionDraft.approve ? 'bg-[#3b82f6]' : 'bg-danger'}`}
                >
                  {decisionBusy ? 'در حال ثبت…' : `تأیید نهایی ${decisionDraft.approve ? 'پذیرش' : 'رد'}`}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
