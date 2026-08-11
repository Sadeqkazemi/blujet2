import { useEffect, useState } from 'react';
import { fetchAdminLoanApplication, fetchAdminLoanApplications } from '../../api/loans';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { LoanApplication, LoanDisplayStatus } from '../../types/loans';

const STATUS: Record<LoanDisplayStatus, { label: string; className: string }> = {
  processing: { label: 'در حال ارسال', className: 'bg-blue-500/15 text-blue-300' },
  awaiting_bank: { label: 'در انتظار بانک', className: 'bg-amber-500/15 text-amber-300' },
  under_review: { label: 'در حال بررسی بانک', className: 'bg-violet-500/15 text-violet-300' },
  approved: { label: 'تأیید بانک', className: 'bg-emerald-500/15 text-emerald-300' },
  rejected: { label: 'رد بانک', className: 'bg-red-500/15 text-red-300' },
  disbursed: { label: 'پرداخت‌شده', className: 'bg-emerald-500/15 text-emerald-300' },
  cancelled: { label: 'لغوشده', className: 'bg-slate-500/15 text-slate-300' },
  failed: { label: 'ناموفق', className: 'bg-red-500/15 text-red-300' },
  unknown: { label: 'نامشخص', className: 'bg-slate-500/15 text-slate-300' },
};

export default function AdminLoansPage() {
  const [items, setItems] = useState<LoanApplication[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LoanApplication | null>(null);
  const pageSize = 20;

  useEffect(() => {
    setItems(null);
    fetchAdminLoanApplications(page, pageSize)
      .then((result) => { setItems(result.items); setTotal(result.total); })
      .catch(() => setError('دریافت درخواست‌های وام از سرور انجام نشد.'));
  }, [page]);

  async function openDetail(id: string) {
    setError(null);
    try {
      setDetail(await fetchAdminLoanApplication(id));
    } catch {
      setError('جزئیات درخواست وام دریافت نشد.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8" data-testid="admin-loans-page">
      <div className="mb-6">
        <h1 className="text-xl font-black text-panel-ink">درخواست وام باشگاه مشتریان</h1>
        <p className="mt-1 text-sm text-panel-muted">نمایش فقط‌خواندنی درخواست‌ها و آخرین وضعیت دریافتی از API بانک</p>
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-panel-border bg-panel-surface p-4"><b className="font-num text-xl text-panel-ink">{faDigits(total)}</b><p className="mt-1 text-xs text-panel-muted">کل درخواست‌ها</p></div>
        <div className="rounded-xl border border-panel-border bg-panel-surface p-4"><b className="font-num text-xl text-amber-300">{faDigits((items ?? []).filter((x) => ['processing','awaiting_bank','under_review'].includes(x.displayStatus)).length)}</b><p className="mt-1 text-xs text-panel-muted">در جریان در این صفحه</p></div>
        <div className="rounded-xl border border-panel-border bg-panel-surface p-4"><b className="font-num text-xl text-emerald-300">{faDigits((items ?? []).filter((x) => x.displayStatus === 'disbursed').length)}</b><p className="mt-1 text-xs text-panel-muted">پرداخت‌شده در این صفحه</p></div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
      <section className="overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_.6fr] gap-3 border-b border-panel-border px-5 py-3 text-[11px] font-bold text-panel-muted">
          <span>شناسه کاربر</span><span>مبلغ درخواستی</span><span>وضعیت بانک</span><span>زمان ثبت</span><span></span>
        </div>
        {items === null ? <p className="py-8 text-center text-xs text-panel-muted">در حال بارگذاری…</p> : items.length === 0 ? <p className="py-8 text-center text-xs text-panel-muted">درخواستی ثبت نشده است.</p> : (
          items.map((row) => {
            const status = STATUS[row.displayStatus] ?? STATUS.unknown;
            return <div key={row.id} className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_.6fr] items-center gap-3 border-b border-panel-border px-5 py-4 text-xs">
              <span dir="ltr" className="truncate font-num text-panel-muted">{row.userId ?? '—'}</span>
              <span className="font-num font-black text-panel-ink">{faMoney(row.requestedAmountIrr)} تومان</span>
              <span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span></span>
              <span className="text-panel-muted">{formatJalaliDateTime(row.createdAt)}</span>
              <button type="button" onClick={() => void openDetail(row.id)} className="text-xs font-bold text-accent">جزئیات</button>
            </div>;
          })
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} variant="dark" />
      </section>
      <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-6 text-amber-200">تصمیم تأیید یا رد توسط بانک انجام می‌شود؛ ادمین سایت فقط وضعیت همگام‌شده را مشاهده می‌کند.</p>

      {detail && <Modal title="جزئیات درخواست وام" onClose={() => setDetail(null)}>
        <div className="space-y-3 text-xs text-panel-muted">
          <p>مبلغ: <b className="font-num text-panel-ink">{faMoney(detail.requestedAmountIrr)} تومان</b></p>
          <p>وضعیت بانک: <b className="text-panel-ink">{STATUS[detail.displayStatus]?.label ?? detail.displayStatus}</b></p>
          <p>شناسه بانک: <span dir="ltr" className="font-num text-panel-ink">{detail.bankReferenceId ?? '—'}</span></p>
          <p>آخرین همگام‌سازی: <span className="text-panel-ink">{detail.lastSyncedAt ? formatJalaliDateTime(detail.lastSyncedAt) : '—'}</span></p>
          {detail.statusSummary && <pre dir="ltr" className="max-h-48 overflow-auto rounded-lg bg-black/20 p-3 text-[11px] text-panel-ink">{JSON.stringify(detail.statusSummary, null, 2)}</pre>}
        </div>
      </Modal>}
    </div>
  );
}
