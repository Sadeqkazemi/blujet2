import { useEffect, useState } from 'react';
import { fetchDashboard } from '../../api/agency-portal';
import { faDigits, faMoney } from '../../lib/fa-format';
import type { AgencyDashboard } from '../../types/agency-portal';

const MONTH_LABELS: Record<string, string> = {
  '01': 'فروردین',
  '02': 'اردیبهشت',
  '03': 'خرداد',
  '04': 'تیر',
  '05': 'مرداد',
  '06': 'شهریور',
  '07': 'مهر',
  '08': 'آبان',
  '09': 'آذر',
  '10': 'دی',
  '11': 'بهمن',
  '12': 'اسفند',
};

function monthLabel(monthKey: string): string {
  const [, m] = monthKey.split('-');
  return MONTH_LABELS[m] ?? monthKey;
}

export default function AgencyDashboardPage() {
  const [data, setData] = useState<AgencyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => setError('خطا در دریافت داشبورد.'));
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const max = Math.max(1, ...data.monthlySales.map((m) => m.salesIrr));
  const kpis = [
    { label: 'فروش این ماه (تومان)', value: faMoney(data.kpis.salesThisMonthIrr) },
    { label: 'مانده اعتبار (تومان)', value: faMoney(data.credit.remainingIrr) },
    { label: 'بلیط صادرشده (کل)', value: faDigits(data.kpis.ticketsIssuedTotal) },
    { label: 'صندلی فروش‌رفته (این ماه)', value: faDigits(data.kpis.seatsSoldThisMonth) },
  ];

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">داشبورد</h1>
      <p className="mb-6 text-sm text-muted">نمای کلی فروش و اعتبار آژانس شما</p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">{k.label}</div>
            <div className="font-num mt-1 text-lg font-black text-ink">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 text-sm font-bold text-ink">فروش ۶ ماه اخیر</div>
          <div className="flex h-40 items-end gap-3" role="img" aria-label="نمودار فروش ۶ ماه اخیر">
            {data.monthlySales.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className="w-full max-w-9 rounded-t-sm bg-accent"
                  style={{ height: `${Math.max((m.salesIrr / max) * 100, 2)}%` }}
                  aria-label={`${monthLabel(m.month)} — ${faMoney(m.salesIrr)} تومان`}
                />
                <span className="text-[10px] text-muted">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 text-sm font-bold text-ink">خلاصه اعتبار</div>
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">سقف اعتبار</span>
              <span className="font-num font-bold">{faMoney(data.credit.limitIrr)} تومان</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">مصرف‌شده</span>
              <span className="font-num font-bold">{faMoney(data.credit.usedIrr)} تومان</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-muted">باقیمانده</span>
              <span className="font-num font-bold text-accent">{faMoney(data.credit.remainingIrr)} تومان</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
