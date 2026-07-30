import { useEffect, useState } from 'react';
import { fetchDashboard } from '../../api/agency-portal';
import { faDigits, faMoney } from '../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyDashboard } from '../../types/agency-portal';

// Jalali month names, romanized for EN — reuses the exact spellings
// design-reference-v2/وضعیت پرواز.dc.html's own MONTHS_EN already
// established. Its own MONTHS_AR is identical to the Persian names
// verbatim (there is no separate Arabic name for a Jalali month, same
// reasoning as "تومان" staying the same word in Arabic) — followed here too.
const MONTH_LABELS: Record<string, Record<StoredLocale, string>> = {
  '01': { fa: 'فروردین', en: 'Farvardin', ar: 'فروردین' },
  '02': { fa: 'اردیبهشت', en: 'Ordibehesht', ar: 'اردیبهشت' },
  '03': { fa: 'خرداد', en: 'Khordad', ar: 'خرداد' },
  '04': { fa: 'تیر', en: 'Tir', ar: 'تیر' },
  '05': { fa: 'مرداد', en: 'Mordad', ar: 'مرداد' },
  '06': { fa: 'شهریور', en: 'Shahrivar', ar: 'شهریور' },
  '07': { fa: 'مهر', en: 'Mehr', ar: 'مهر' },
  '08': { fa: 'آبان', en: 'Aban', ar: 'آبان' },
  '09': { fa: 'آذر', en: 'Azar', ar: 'آذر' },
  '10': { fa: 'دی', en: 'Dey', ar: 'دی' },
  '11': { fa: 'بهمن', en: 'Bahman', ar: 'بهمن' },
  '12': { fa: 'اسفند', en: 'Esfand', ar: 'اسفند' },
};

function monthLabel(monthKey: string, locale: StoredLocale): string {
  const [, m] = monthKey.split('-');
  return MONTH_LABELS[m]?.[locale] ?? monthKey;
}

const STR: Record<StoredLocale, {
  heading: string;
  subtitle: string;
  errorFallback: string;
  loading: string;
  kpiSales: string;
  kpiCredit: string;
  kpiTicketsIssued: string;
  kpiSeatsSold: string;
  chartHeading: string;
  chartAriaLabel: string;
  creditSummaryHeading: string;
  creditLimitLabel: string;
  creditUsedLabel: string;
  creditRemainingLabel: string;
  toman: string;
}> = {
  fa: {
    heading: 'داشبورد',
    subtitle: 'نمای کلی فروش و اعتبار آژانس شما',
    errorFallback: 'خطا در دریافت داشبورد.',
    loading: 'در حال بارگذاری…',
    kpiSales: 'فروش این ماه (تومان)',
    kpiCredit: 'مانده اعتبار (تومان)',
    kpiTicketsIssued: 'بلیط صادرشده (کل)',
    kpiSeatsSold: 'صندلی فروش‌رفته (این ماه)',
    chartHeading: 'فروش ۶ ماه اخیر',
    chartAriaLabel: 'نمودار فروش ۶ ماه اخیر',
    creditSummaryHeading: 'خلاصه اعتبار',
    creditLimitLabel: 'سقف اعتبار',
    creditUsedLabel: 'مصرف‌شده',
    creditRemainingLabel: 'باقیمانده',
    toman: 'تومان',
  },
  en: {
    heading: 'Dashboard',
    subtitle: "An overview of your agency's sales and credit",
    errorFallback: 'Error loading the dashboard.',
    loading: 'Loading…',
    kpiSales: "This Month's Sales (Toman)",
    kpiCredit: 'Remaining Credit (Toman)',
    kpiTicketsIssued: 'Tickets Issued (Total)',
    kpiSeatsSold: 'Seats Sold (This Month)',
    chartHeading: 'Last 6 Months’ Sales',
    chartAriaLabel: 'Last 6 months sales chart',
    creditSummaryHeading: 'Credit Summary',
    creditLimitLabel: 'Credit Limit',
    creditUsedLabel: 'Used',
    creditRemainingLabel: 'Remaining',
    toman: 'Toman',
  },
  ar: {
    heading: 'لوحة التحكم',
    subtitle: 'نظرة عامة على مبيعات وائتمان وكالتك',
    errorFallback: 'خطأ في تحميل لوحة التحكم.',
    loading: 'جارٍ التحميل…',
    kpiSales: 'مبيعات هذا الشهر (تومان)',
    kpiCredit: 'الرصيد المتبقي (تومان)',
    kpiTicketsIssued: 'التذاكر الصادرة (الإجمالي)',
    kpiSeatsSold: 'المقاعد المباعة (هذا الشهر)',
    chartHeading: 'مبيعات آخر 6 أشهر',
    chartAriaLabel: 'مخطط مبيعات آخر 6 أشهر',
    creditSummaryHeading: 'ملخص الرصيد',
    creditLimitLabel: 'سقف الائتمان',
    creditUsedLabel: 'المستخدم',
    creditRemainingLabel: 'المتبقي',
    toman: 'تومان',
  },
};

export default function AgencyDashboardPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [data, setData] = useState<AgencyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => setError(t.errorFallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">{t.loading}</p>;

  const max = Math.max(1, ...data.monthlySales.map((m) => m.salesIrr));
  const kpis = [
    { label: t.kpiSales, value: faMoney(data.kpis.salesThisMonthIrr) },
    { label: t.kpiCredit, value: faMoney(data.credit.remainingIrr) },
    { label: t.kpiTicketsIssued, value: faDigits(data.kpis.ticketsIssuedTotal) },
    { label: t.kpiSeatsSold, value: faDigits(data.kpis.seatsSoldThisMonth) },
  ];

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">{t.heading}</h1>
      <p className="mb-6 text-sm text-muted">{t.subtitle}</p>

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
          <div className="mb-4 text-sm font-bold text-ink">{t.chartHeading}</div>
          <div className="flex h-40 items-end gap-3" role="img" aria-label={t.chartAriaLabel}>
            {data.monthlySales.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className="w-full max-w-9 rounded-t-sm bg-accent"
                  style={{ height: `${Math.max((m.salesIrr / max) * 100, 2)}%` }}
                  aria-label={`${monthLabel(m.month, locale)} — ${faMoney(m.salesIrr)} ${t.toman}`}
                />
                <span className="text-[10px] text-muted">{monthLabel(m.month, locale)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 text-sm font-bold text-ink">{t.creditSummaryHeading}</div>
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">{t.creditLimitLabel}</span>
              <span className="font-num font-bold">{faMoney(data.credit.limitIrr)} {t.toman}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t.creditUsedLabel}</span>
              <span className="font-num font-bold">{faMoney(data.credit.usedIrr)} {t.toman}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-muted">{t.creditRemainingLabel}</span>
              <span className="font-num font-bold text-accent">{faMoney(data.credit.remainingIrr)} {t.toman}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
