import { useEffect, useMemo, useState } from 'react';
import { fetchStaffReport } from '../../api/finance';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { StaffReportResult } from '../../types/finance';

const CATEGORY_FA: Record<string, string> = {
  AGENCY: 'آژانس',
  FINANCE: 'مالی',
  REFUND: 'استرداد',
  CLUB: 'باشگاه',
  PRICING: 'قیمت‌گذاری',
  SYSTEM: 'سامانه',
  ACCOUNT: 'حساب کاربری',
  ACCESS: 'دسترسی',
  SECURITY: 'امنیت',
  RESERVATION: 'رزرواسیون',
  STRATEGY: 'راهبردی',
};

export default function StaffReportPage() {
  const [data, setData] = useState<StaffReportResult | null>(null);
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffReport()
      .then(setData)
      .catch(() => setError('خطا در دریافت گزارش کارمندان.'));
  }, []);

  const visibleReports = useMemo(() => {
    if (!data) return [];
    return selected === 'all'
      ? data.reports
      : data.reports.filter((r) => r.employeeId === selected);
  }, [data, selected]);

  const selectedName =
    selected === 'all'
      ? 'همه کارمندان'
      : (data?.employees.find((e) => e.id === selected)?.fullName ?? '');

  return (
    <div className="p-8">
      <h1 className="text-xl font-black text-ink">گزارش عملکرد کارمندان</h1>
      <p className="mt-1 text-sm text-muted">
        هر اقدام مهم کارمندان به‌صورت خودکار ثبت و برای شما نمایش داده می‌شود.
      </p>

      {error && <p className="my-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {data && data.notices.length > 0 && !noticeDismissed && (
        <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-black text-ink">کارمند جدید توسط مدیر IT اضافه شد</h2>
            <button
              onClick={() => setNoticeDismissed(true)}
              className="text-[11px] font-bold text-muted hover:text-ink"
            >
              علامت‌گذاری به‌عنوان خوانده‌شده
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.notices.map((n) => (
              <li key={n.id} className="flex items-center gap-2 text-xs text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="flex-1">{n.text}</span>
                <span className="font-num text-[10px] text-muted">{formatJalaliDateTime(n.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">گزارش‌ها</h2>
          <span className="font-num rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted">
            {faDigits(data?.employees.length ?? 0)} کارمند فعال
          </span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelected('all')}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
              selected === 'all' ? 'bg-accent text-white' : 'border border-border bg-white text-muted'
            }`}
          >
            همه
          </button>
          {data?.employees.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                selected === e.id ? 'bg-accent text-white' : 'border border-border bg-white text-muted'
              }`}
            >
              {e.fullName}
              {e.dept ? ` · ${e.dept}` : ''}
            </button>
          ))}
        </div>

        <p className="mb-3 border-b border-border pb-3 text-xs text-muted">
          {selectedName} · <span className="font-num font-bold text-ink">{faDigits(visibleReports.length)}</span>{' '}
          گزارش
        </p>

        {visibleReports.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">گزارشی برای این کارمند ثبت نشده است.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibleReports.map((r) => {
              const employee = data?.employees.find((e) => e.id === r.employeeId);
              return (
                <li key={r.id} className="rounded-xl border border-border p-3.5">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-ink">{r.action}</span>
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                      {CATEGORY_FA[r.category] ?? r.category}
                    </span>
                  </div>
                  <p className="text-[11px] leading-6 text-muted">{r.detail}</p>
                  <p className="mt-1.5 text-[10px] text-muted">
                    {employee?.fullName ?? '—'} ·{' '}
                    <span className="font-num">{formatJalaliDateTime(r.at)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
