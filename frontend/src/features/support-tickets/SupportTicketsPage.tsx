import { useCallback, useEffect, useState } from 'react';
import {
  fetchForwardTargets,
  fetchSupportTicketDetail,
  fetchSupportTickets,
  forwardSupportTicket,
  updateSupportTicketStatus,
} from '../../api/support-tickets';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { ForwardTarget, SupportTicketRow, SupportTicketStatus } from '../../types/support-tickets';
import Modal from '../../components/Modal';

const STATUS_META: Record<SupportTicketStatus, { label: string; className: string }> = {
  OPEN: { label: 'باز', className: 'bg-[#f59e0b24] text-[#b45309]' },
  IN_PROGRESS: { label: 'در حال بررسی', className: 'bg-[#60a5fa2e] text-[#1d4ed8]' },
  ANSWERED: { label: 'پاسخ داده‌شده', className: 'bg-[#a855f72e] text-[#7c3aed]' },
  CLOSED: { label: 'بسته شده', className: 'bg-[#10b98124] text-[#059669]' },
};

const STATUS_OPTIONS: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'];

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicketRow[] | null>(null);
  const [detail, setDetail] = useState<SupportTicketRow | null>(null);
  const [targets, setTargets] = useState<ForwardTarget[]>([]);
  const [targetPick, setTargetPick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTickets(await fetchSupportTickets());
    } catch {
      setError('خطا در دریافت تیکت‌های پشتیبانی.');
    }
  }, []);

  useEffect(() => {
    void load();
    fetchForwardTargets()
      .then(setTargets)
      .catch(() => setTargets([]));
  }, [load]);

  async function openDetail(id: string) {
    setError(null);
    try {
      setTargetPick('');
      setDetail(await fetchSupportTicketDetail(id));
    } catch {
      setError('خطا در دریافت جزئیات تیکت.');
    }
  }

  async function onForward() {
    if (!detail || !targetPick) return;
    try {
      const updated = await forwardSupportTicket(detail.id, targetPick);
      const target = targets.find((t) => t.id === targetPick);
      setNotice(`تیکت به ${target?.fullName ?? 'کارمند'} ارجاع شد ✓`);
      setDetail(updated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت ارجاع.');
    }
  }

  async function onStatusChange(status: SupportTicketStatus) {
    if (!detail) return;
    try {
      const updated = await updateSupportTicketStatus(detail.id, status);
      setDetail(updated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در تغییر وضعیت.');
    }
  }

  const rows = tickets ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-ink">تیکت‌های پشتیبانی</h1>
        <p className="mt-1 text-sm text-muted">
          تیکت‌های ثبت‌شده از صفحهٔ عمومی پشتیبانی — بررسی، ارجاع و تغییر وضعیت
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">فهرست تیکت‌ها</h2>
          <span className="font-num text-[11px] text-muted">{faDigits(rows.length)} تیکت</span>
        </div>

        {tickets === null ? (
          <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">تیکتی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((t) => {
              const st = STATUS_META[t.status];
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <button
                    onClick={() => void openDetail(t.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-right"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-sm font-black text-accent">
                      {t.requesterName.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">
                        {t.subject}{' '}
                        <span className="ltr font-num text-[11px] text-muted">{t.trackingCode}</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {t.requesterName}
                        {t.forwardedTo ? ` · ارجاع به: ${t.forwardedTo.fullName}` : ''}
                      </span>
                    </span>
                  </button>
                  <div className="text-left">
                    <div className="text-[10px] text-muted">تاریخ ثبت</div>
                    <div className="font-num text-xs font-bold text-ink">{formatJalaliDateTime(t.createdAt)}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detail && (
        <Modal title={`تیکت پشتیبانی · ${detail.trackingCode}`} onClose={() => setDetail(null)}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] text-muted">وضعیت تیکت</span>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATUS_META[detail.status].className}`}>
              {STATUS_META[detail.status].label}
            </span>
          </div>

          <div className="mb-3 rounded-lg bg-surface p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">اطلاعات درخواست‌کننده</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div>
                <dt className="text-muted">نام</dt>
                <dd className="font-bold text-ink">{detail.requesterName}</dd>
              </div>
              <div>
                <dt className="text-muted">شماره تماس</dt>
                <dd className="ltr font-num font-bold text-ink">{detail.requesterPhone}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">موضوع</dt>
                <dd className="font-bold text-ink">{detail.subject}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">متن تیکت</dt>
                <dd className="text-ink">{detail.body}</dd>
              </div>
            </dl>
          </div>

          <div className="mb-3 rounded-lg border border-border p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">ارجاع به کارمند</h3>
            <div className="flex gap-2">
              <select
                aria-label="گیرنده ارجاع"
                value={targetPick}
                onChange={(e) => setTargetPick(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-border bg-white px-2 text-xs outline-none"
              >
                <option value="">— انتخاب کارمند —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} — {t.roleLabelFa}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void onForward()}
                disabled={!targetPick}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
              >
                ثبت ارجاع
              </button>
            </div>
            {detail.forwardedTo && (
              <p className="mt-2 text-[11px] text-muted">ارجاع فعلی: {detail.forwardedTo.fullName}</p>
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-xs font-bold text-ink">تغییر وضعیت</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void onStatusChange(s)}
                  disabled={detail.status === s}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_META[s].className}`}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
