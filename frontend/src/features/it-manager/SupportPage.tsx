import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchItSupportTicketDetail,
  fetchItSupportTickets,
  replyToItSupportTicket,
  setItSupportTicketStatus,
} from '../../api/it-support-mock';
import { formatJalaliDateTime } from '../../lib/jalali';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useOptionalAuth } from '../../hooks/useAuth';
import type { ItSupportTicket, ItSupportTicketFilters, ItSupportTicketPriority, ItSupportTicketStatus } from '../../types/it-support';

const STATUS_LABEL: Record<ItSupportTicketStatus, { label: string; className: string }> = {
  OPEN: { label: 'باز', className: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]' },
  IN_PROGRESS: { label: 'در حال بررسی', className: 'bg-[rgba(245,158,11,.14)] text-[#f59e0b]' },
  RESOLVED: { label: 'حل‌شده', className: 'bg-[rgba(16,185,129,.14)] text-[#34d399]' },
  CLOSED: { label: 'بسته‌شده', className: 'bg-[rgba(107,123,148,.18)] text-[#9fb0c7]' },
};

const PRIORITY_LABEL: Record<ItSupportTicketPriority, { label: string; className: string }> = {
  LOW: { label: 'کم', className: 'text-[#6b7b94]' },
  NORMAL: { label: 'عادی', className: 'text-[#9fb0c7]' },
  HIGH: { label: 'بالا', className: 'text-[#f59e0b]' },
  URGENT: { label: 'فوری', className: 'text-[#f87171]' },
};

/**
 * IT Manager's «پشتیبانی» tab — internal/technical support requests from
 * staff. Not the SITE_ADMIN customer-facing support-tickets system; see
 * frontend/src/api/it-support-mock.ts (TEMP/DEV ONLY, no backend yet).
 */
export default function SupportPage() {
  const user = useOptionalAuth()?.user;
  const canManage = user?.role !== 'EMPLOYEE' && user?.role !== 'AGENCY';
  const [tickets, setTickets] = useState<ItSupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<ItSupportTicketFilters>({});
  const [qDraft, setQDraft] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItSupportTicket | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTickets(await fetchItSupportTickets(filters));
    } catch {
      setError('سرویس پشتیبانی در دسترس نیست. دوباره تلاش کنید.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    fetchItSupportTicketDetail(detailId)
      .then(setDetail)
      .catch(() => setError('خطا در دریافت جزئیات تیکت.'));
  }, [detailId]);

  const pager = usePagination(tickets ?? []);
  const openCount = useMemo(() => (tickets ?? []).filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length, [tickets]);

  function applySearch() {
    setFilters((f) => ({ ...f, q: qDraft.trim() || undefined }));
  }

  async function submitReply() {
    if (!detail) return;
    if (!replyDraft.trim()) {
      setReplyError('متن پاسخ نمی‌تواند خالی باشد.');
      return;
    }
    setReplyBusy(true);
    setReplyError(null);
    try {
      const updated = await replyToItSupportTicket(detail.id, replyDraft);
      setDetail(updated);
      setReplyDraft('');
      setNotice('پاسخ ثبت شد ✓');
      await load();
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : 'خطا در ثبت پاسخ.');
    } finally {
      setReplyBusy(false);
    }
  }

  async function closeTicket() {
    if (!detail) return;
    try {
      const updated = await setItSupportTicketStatus(detail.id, 'CLOSED');
      setDetail(updated);
      setCloseConfirm(false);
      setNotice('تیکت بسته شد.');
      await load();
    } catch {
      setError('خطا در بستن تیکت.');
    }
  }

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20.5px] font-black text-white">پشتیبانی</h1>
          <p className="mt-1 text-[11.5px] text-[#6b7b94]">درخواست‌های فنی و پشتیبانی داخلی کارمندان واحدها</p>
        </div>
        <span className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] px-3 py-2 text-xs">
          <span className="font-num font-black text-[#f59e0b]">{openCount}</span> <span className="text-[#6b7b94]">تیکت باز</span>
        </span>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs text-[#f87171]">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[rgba(16,185,129,.12)] p-3 text-xs text-[#34d399]">{notice}</p>}

      {!canManage ? (
        <p role="alert" className="rounded-xl border border-[#28344c] bg-[#141d2e] p-6 text-center text-xs text-[#f87171]">
          دسترسی شما برای مشاهدهٔ تیکت‌های پشتیبانی کافی نیست.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-3">
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="جستجوی موضوع یا کارمند…"
              aria-label="جستجوی تیکت"
              className="min-w-[160px] flex-1 rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
            />
            <button onClick={applySearch} className="rounded-lg bg-[#18223a] px-3 py-2.5 text-[11px] font-bold text-[#cdd6e3]">جستجو</button>
            <select
              aria-label="فیلتر وضعیت تیکت"
              value={filters.status ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as ItSupportTicketStatus | undefined }))}
              className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
            >
              <option value="">همهٔ وضعیت‌ها</option>
              {(Object.keys(STATUS_LABEL) as ItSupportTicketStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s].label}</option>)}
            </select>
            <select
              aria-label="فیلتر اولویت"
              value={filters.priority ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, priority: (e.target.value || undefined) as ItSupportTicketPriority | undefined }))}
              className="rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#cdd6e3] outline-none"
            >
              <option value="">همهٔ اولویت‌ها</option>
              {(Object.keys(PRIORITY_LABEL) as ItSupportTicketPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p].label}</option>)}
            </select>
          </div>

          <section className="overflow-hidden rounded-xl border border-[#1f2a3d] bg-[#141d2e]">
            <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.9fr] gap-2 border-b border-[#1f2a3d] bg-[#18223a] px-4 py-2.5 text-[10.5px] font-bold text-[#6b7b94]">
              <span>موضوع</span>
              <span>درخواست‌کننده</span>
              <span>اولویت</span>
              <span>وضعیت</span>
              <span>آخرین به‌روزرسانی</span>
            </div>
            {tickets === null ? (
              <p className="py-8 text-center text-xs text-[#6b7b94]">در حال بارگذاری…</p>
            ) : pager.pageItems.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#6b7b94]">تیکتی با این فیلترها یافت نشد.</p>
            ) : (
              <ul className="divide-y divide-[#1f2a3d]">
                {pager.pageItems.map((t) => (
                  <li key={t.id} data-testid="support-ticket-row">
                    <button
                      onClick={() => setDetailId(t.id)}
                      className="grid w-full grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.9fr] items-center gap-2 px-4 py-3 text-right text-xs"
                    >
                      <span className="font-bold text-[#e7ecf3]">{t.subject}</span>
                      <span className="text-[#9fb0c7]">{t.requesterNameFa} <span className="text-[10px] text-[#6b7b94]">· {t.requesterDeptFa}</span></span>
                      <span className={`font-bold ${PRIORITY_LABEL[t.priority].className}`}>{PRIORITY_LABEL[t.priority].label}</span>
                      <span className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_LABEL[t.status].className}`}>{STATUS_LABEL[t.status].label}</span>
                      <span className="font-num text-[#6b7b94]">{formatJalaliDateTime(t.updatedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} variant="dark" />
          </section>
        </>
      )}

      {detail && (
        <Modal variant="dark" title={detail.subject} onClose={() => { setDetailId(null); setReplyDraft(''); setReplyError(null); }}>
          <div className="mb-3 flex items-center gap-2 text-[11px] text-[#9fb0c7]">
            <span>{detail.requesterNameFa} · {detail.requesterDeptFa}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_LABEL[detail.status].className}`}>{STATUS_LABEL[detail.status].label}</span>
          </div>
          <div className="mb-3 rounded-lg border border-[#1f2a3d] p-3 text-[11.5px] leading-6 text-[#cdd6e3]">{detail.body}</div>

          {detail.messages.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {detail.messages.map((m) => (
                <div key={m.id} className="rounded-lg bg-[#18223a] p-2.5 text-[11px] leading-6 text-[#cdd6e3]">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-[#6b7b94]">
                    <span className="font-bold text-[#e7ecf3]">{m.authorNameFa}</span>
                    <span className="font-num">{formatJalaliDateTime(m.createdAt)}</span>
                  </div>
                  {m.body}
                </div>
              ))}
            </div>
          )}

          {detail.status !== 'CLOSED' && (
            <>
              <label htmlFor="support-reply" className="mb-1 block text-[10.5px] text-[#9fb0c7]">پاسخ</label>
              <textarea
                id="support-reply"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#1f2a3d] bg-[#0f1623] p-2.5 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
              />
              {replyError && <p role="alert" className="mt-1.5 text-[10.5px] text-[#f87171]">{replyError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setCloseConfirm(true)} className="rounded-lg border border-[#f87171]/40 px-4 py-2 text-xs font-bold text-[#f87171]">بستن تیکت</button>
                <button onClick={() => void submitReply()} disabled={replyBusy} className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {replyBusy ? 'در حال ارسال…' : 'ارسال پاسخ'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {closeConfirm && detail && (
        <Modal variant="dark" title="بستن تیکت پشتیبانی" onClose={() => setCloseConfirm(false)}>
          <p className="mb-4 text-xs leading-6 text-[#9fb0c7]">
            تیکت «{detail.subject}» بسته می‌شود و امکان ارسال پاسخ جدید تا بازگشایی مجدد وجود نخواهد داشت.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCloseConfirm(false)} className="rounded-lg bg-[#18223a] px-4 py-2 text-xs font-bold text-[#cdd6e3]">انصراف</button>
            <button onClick={() => void closeTicket()} className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white">بستن تیکت</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
