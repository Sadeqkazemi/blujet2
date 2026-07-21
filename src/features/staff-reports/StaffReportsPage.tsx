import { useEffect, useState } from 'react';
import { fetchStaffReports } from '../../api/reporting';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { StaffReportsResult } from '../../types/reporting';

const CATEGORY_LABEL: Record<string, string> = {
  FINANCE: 'مالی',
  AGENCY: 'آژانس',
  ACCOUNT: 'حساب کاربری',
  SECURITY: 'امنیت',
  ACCESS: 'دسترسی',
  SYSTEM: 'سیستم',
  RESERVATION: 'رزرواسیون',
  CLUB: 'باشگاه',
  PRICING: 'قیمت‌گذاری',
  REFUND: 'استرداد',
};

export default function StaffReportsPage() {
  const [data, setData] = useState<StaffReportsResult | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStaffReports(staffId ?? undefined)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError('خطا در دریافت گزارش کارمندان.');
      });
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const selected = staffId ? data.staff.find((s) => s.id === staffId) : null;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">گزارش کارمندان</h1>
      <p className="mb-6 text-sm text-muted">
        اقدامات کارمندان واحد شما — برای هر کارمند یک تب جداگانه
      </p>

      {!bannerDismissed && data.newEmployeeEvents.length > 0 && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-ink">کارمند جدید توسط مدیر IT اضافه شد</div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-[11px] font-bold text-muted transition hover:text-ink"
            >
              علامت‌گذاری به‌عنوان خوانده‌شده
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.newEmployeeEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-text-2">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span className="flex-1">{e.detail}</span>
                <span className="font-num text-[10px] text-muted">{formatJalaliDateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-ink">گزارش عملکرد کارمندان</div>
            <div className="mt-0.5 text-[11px] text-muted">
              هر اقدام مهم کارمندان به‌صورت خودکار ثبت و برای شما نمایش داده می‌شود.
            </div>
          </div>
          <span className="rounded-lg bg-body px-3 py-1.5 text-[11px] font-bold text-muted">
            {faDigits(data.staff.length)} کارمند فعال
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setStaffId(null)}
            className={`rounded-lg px-3.5 py-2 text-[11.5px] transition ${
              staffId === null ? 'bg-accent font-bold text-white' : 'bg-body text-muted hover:text-ink'
            }`}
          >
            همهٔ کارمندان
          </button>
          {data.staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setStaffId(s.id)}
              className={`rounded-lg px-3.5 py-2 text-[11.5px] transition ${
                staffId === s.id ? 'bg-accent font-bold text-white' : 'bg-body text-muted hover:text-ink'
              }`}
            >
              {s.fullName}
            </button>
          ))}
        </div>

        <div className="mb-3 border-b border-border pb-3 text-xs text-muted">
          {selected ? `${selected.fullName}${selected.rank ? ` · ${selected.rank}` : ''}` : 'همهٔ کارمندان'} ·{' '}
          <span className="font-num font-bold text-ink">{faDigits(data.reports.length)}</span> گزارش
        </div>

        {data.reports.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">گزارشی برای این کارمند ثبت نشده است.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/70 bg-body/50 p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-extrabold text-ink">{r.action}</span>
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                    {CATEGORY_LABEL[r.category] ?? r.category}
                  </span>
                </div>
                <div className="text-[11.5px] leading-6 text-text-2">{r.detail}</div>
                <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted">
                  <span>{r.staffName}</span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="font-num">{formatJalaliDateTime(r.at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
