import { useEffect, useState } from 'react';
import { downloadSalesExport, fetchSales } from '../../api/agency-portal';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencySalesReport } from '../../types/agency-portal';

// فروش و گزارش — heading/section labels reuse
// design-reference-v2/پنل آژانس.dc.html's own isEN vocabulary for this
// exact tab ("Sales per flight", the reportKpis labels); AR has no
// counterpart there and is hand-translated.
interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const BOOKING_STATUS_LABEL: Record<string, Tr> = {
  DRAFT: { fa: 'پیش‌نویس', en: 'Draft', ar: 'مسودة' },
  HELD: { fa: 'رزرو موقت', en: 'Held', ar: 'محجوز مؤقتًا' },
  PAID: { fa: 'پرداخت‌شده', en: 'Paid', ar: 'مدفوع' },
  TICKETED: { fa: 'صادرشده', en: 'Ticketed', ar: 'تم إصدار التذكرة' },
  CANCELLED: { fa: 'لغوشده', en: 'Cancelled', ar: 'ملغى' },
  EXPIRED: { fa: 'منقضی‌شده', en: 'Expired', ar: 'منتهي الصلاحية' },
  REFUNDED: { fa: 'مستردشده', en: 'Refunded', ar: 'تم الاسترداد' },
};

const STR: Record<StoredLocale, {
  heading: string;
  subtitle: string;
  errorFallback: string;
  loading: string;
  kpiTotalSales: string;
  kpiTicketsIssued: string;
  kpiAvgFare: string;
  kpiRefundRate: string;
  perFlightHeading: string;
  perFlightEmpty: string;
  colFlight: string;
  colRoute: string;
  colTicketsCount: string;
  colTotalSales: string;
  ticketsHeading: string;
  ticketsEmpty: string;
  colPnr: string;
  colDepartureDate: string;
  colAmount: string;
  colStatus: string;
  toman: string;
  exportExcel: string;
  exportBusy: string;
  exportError: string;
}> = {
  fa: {
    heading: 'فروش و گزارش',
    subtitle: 'تفکیک فروش آژانس شما بر اساس پرواز و بلیط',
    errorFallback: 'خطا در دریافت گزارش فروش.',
    loading: 'در حال بارگذاری…',
    kpiTotalSales: 'کل فروش (تومان)',
    kpiTicketsIssued: 'بلیط صادرشده',
    kpiAvgFare: 'میانگین نرخ (تومان)',
    kpiRefundRate: 'نرخ استرداد',
    perFlightHeading: 'فروش هر پرواز',
    perFlightEmpty: 'فروشی ثبت نشده است.',
    colFlight: 'پرواز',
    colRoute: 'مسیر',
    colTicketsCount: 'تعداد بلیط',
    colTotalSales: 'جمع فروش',
    ticketsHeading: 'بلیط‌های صادرشده',
    ticketsEmpty: 'بلیطی ثبت نشده است.',
    colPnr: 'PNR',
    colDepartureDate: 'تاریخ پرواز',
    colAmount: 'مبلغ',
    colStatus: 'وضعیت',
    toman: 'تومان',
    exportExcel: 'خروجی Excel',
    exportBusy: 'در حال آماده‌سازی…',
    exportError: 'خطا در دریافت خروجی.',
  },
  en: {
    heading: 'Sales & Reports',
    subtitle: 'A breakdown of your agency sales by flight and ticket',
    errorFallback: 'Error loading the sales report.',
    loading: 'Loading…',
    kpiTotalSales: 'Total Sales (Toman)',
    kpiTicketsIssued: 'Tickets Issued',
    kpiAvgFare: 'Average Fare (Toman)',
    kpiRefundRate: 'Refund Rate',
    perFlightHeading: 'Sales per Flight',
    perFlightEmpty: 'No sales recorded yet.',
    colFlight: 'Flight',
    colRoute: 'Route',
    colTicketsCount: 'Tickets',
    colTotalSales: 'Total Sales',
    ticketsHeading: 'Issued Tickets',
    ticketsEmpty: 'No tickets recorded yet.',
    colPnr: 'PNR',
    colDepartureDate: 'Departure Date',
    colAmount: 'Amount',
    colStatus: 'Status',
    toman: 'Toman',
    exportExcel: 'Export Excel',
    exportBusy: 'Preparing…',
    exportError: 'Error downloading the export.',
  },
  ar: {
    heading: 'المبيعات والتقارير',
    subtitle: 'تفصيل مبيعات وكالتك حسب الرحلة والتذكرة',
    errorFallback: 'خطأ في تحميل تقرير المبيعات.',
    loading: 'جارٍ التحميل…',
    kpiTotalSales: 'إجمالي المبيعات (تومان)',
    kpiTicketsIssued: 'التذاكر الصادرة',
    kpiAvgFare: 'متوسط السعر (تومان)',
    kpiRefundRate: 'معدل الاسترداد',
    perFlightHeading: 'المبيعات لكل رحلة',
    perFlightEmpty: 'لا توجد مبيعات مسجّلة بعد.',
    colFlight: 'الرحلة',
    colRoute: 'المسار',
    colTicketsCount: 'عدد التذاكر',
    colTotalSales: 'إجمالي المبيعات',
    ticketsHeading: 'التذاكر الصادرة',
    ticketsEmpty: 'لا توجد تذاكر مسجّلة بعد.',
    colPnr: 'رمز الحجز',
    colDepartureDate: 'تاريخ الرحلة',
    colAmount: 'المبلغ',
    colStatus: 'الحالة',
    toman: 'تومان',
    exportExcel: 'تصدير Excel',
    exportBusy: 'جارٍ التحضير…',
    exportError: 'خطأ في تنزيل التصدير.',
  },
};

export default function AgencySalesPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [data, setData] = useState<AgencySalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    fetchSales()
      .then(setData)
      .catch(() => setError(t.errorFallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">{t.loading}</p>;

  const kpis = [
    { label: t.kpiTotalSales, value: faMoney(data.summary.totalSalesIrr) },
    { label: t.kpiTicketsIssued, value: faDigits(data.summary.ticketsIssued) },
    { label: t.kpiAvgFare, value: faMoney(data.summary.avgFareIrr) },
    { label: t.kpiRefundRate, value: faPercent(data.summary.refundRatePct) },
  ];

  async function onExport() {
    setExportError(null);
    setExportBusy(true);
    try {
      const blob = await downloadSalesExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agency-sales.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t.exportError);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-end gap-3">
        <button
          type="button"
          data-testid="sales-export"
          disabled={exportBusy}
          onClick={() => void onExport()}
          className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-bold text-accent disabled:opacity-60"
        >
          {exportBusy ? t.exportBusy : t.exportExcel}
        </button>
      </div>
      {exportError && <p className="mb-4 text-xs text-danger">{exportError}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">{k.label}</div>
            <div className="mt-1 text-lg font-black text-ink">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">{t.perFlightHeading}</div>
        {data.perFlight.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t.perFlightEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="py-2 font-bold">{t.colFlight}</th>
                  <th className="py-2 font-bold">{t.colRoute}</th>
                  <th className="py-2 font-bold">{t.colTicketsCount}</th>
                  <th className="py-2 font-bold">{t.colTotalSales}</th>
                </tr>
              </thead>
              <tbody>
                {data.perFlight.map((f) => (
                  <tr key={f.flightNo} className="border-b border-border/60">
                    <td className="ltr py-2.5">{f.flightNo}</td>
                    <td className="ltr py-2.5">{f.route}</td>
                    <td className="py-2.5">{faDigits(f.ticketsCount)}</td>
                    <td className="py-2.5 font-bold">{faMoney(f.salesIrr)} {t.toman}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">{t.ticketsHeading}</div>
        {data.tickets.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t.ticketsEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="py-2 font-bold">{t.colPnr}</th>
                  <th className="py-2 font-bold">{t.colFlight}</th>
                  <th className="py-2 font-bold">{t.colDepartureDate}</th>
                  <th className="py-2 font-bold">{t.colAmount}</th>
                  <th className="py-2 font-bold">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((t2) => (
                  <tr key={t2.pnr} className="border-b border-border/60">
                    <td className="ltr py-2.5">{t2.pnr}</td>
                    <td className="ltr py-2.5">
                      {t2.flightNo} — {t2.route}
                    </td>
                    <td className="py-2.5">{formatJalaliDate(t2.departureAt)}</td>
                    <td className="py-2.5 font-bold">{faMoney(t2.priceIrr)} {t.toman}</td>
                    <td className="py-2.5">{BOOKING_STATUS_LABEL[t2.status]?.[locale] ?? t2.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
