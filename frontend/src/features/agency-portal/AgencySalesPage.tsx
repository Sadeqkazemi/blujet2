import { useEffect, useState } from 'react';
import { downloadSalesExport, fetchSales } from '../../api/agency-portal';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencySalesReport } from '../../types/agency-portal';

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

const STR: Record<
  StoredLocale,
  {
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
  }
> = {
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

const EXPORT_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        padding: 11,
        fontSize: 11,
        color: '#8a96a6',
        fontWeight: 700,
        borderBottom: '1px solid #f4f6fa',
        minWidth: 480,
      }}
    >
      {cols.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </div>
  );
}

export default function AgencySalesPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
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

  if (error) return <p style={{ fontSize: 13, color: '#e5484d' }}>{error}</p>;
  if (!data) return <p style={{ fontSize: 13, color: '#8a96a6' }}>{t.loading}</p>;

  const kpis = [
    { key: 'sales', label: t.kpiTotalSales, value: faMoney(data.summary.totalSalesIrr) },
    { key: 'tickets', label: t.kpiTicketsIssued, value: faDigits(data.summary.ticketsIssued) },
    { key: 'avg', label: t.kpiAvgFare, value: faMoney(data.summary.avgFareIrr) },
    { key: 'refund', label: t.kpiRefundRate, value: faPercent(data.summary.refundRatePct) },
  ];

  return (
    <div data-testid="agency-sales">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', margin: 0 }}>{t.heading}</h1>
          <div style={{ fontSize: 11.5, color: '#7a8696', marginTop: 3 }}>{t.subtitle}</div>
        </div>
        <button
          type="button"
          data-testid="sales-export"
          disabled={exportBusy}
          onClick={() => void onExport()}
          style={{
            height: 38,
            padding: '0 13px',
            background: '#fff',
            border: '1px solid #d9e7f6',
            color: '#1668c4',
            borderRadius: 9,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'inherit',
            opacity: exportBusy ? 0.6 : 1,
          }}
        >
          {EXPORT_ICON}
          {exportBusy ? t.exportBusy : t.exportExcel}
        </button>
      </div>

      {exportError && <p style={{ fontSize: 11, color: '#e5484d', margin: '0 0 14px' }}>{exportError}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 13,
          marginBottom: 13,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.key}
            data-testid={`agency-sales-kpi-${k.key}`}
            style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: 14 }}
          >
            <div style={{ fontSize: 11.5, color: '#8a96a6' }}>{k.label}</div>
            <div style={{ fontSize: 20.5, fontWeight: 900, color: '#0d2640', marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, overflow: 'hidden' }}>
          <div
            style={{
              padding: '11px 14px',
              borderBottom: '1px solid #eef2f7',
              fontSize: 13.5,
              fontWeight: 800,
              color: '#0d2640',
            }}
          >
            {t.perFlightHeading}
          </div>
          {data.perFlight.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a96a6', margin: 0 }}>
              {t.perFlightEmpty}
            </p>
          ) : (
            <div style={{ overflowX: 'auto', padding: '0 7px' }}>
              <TableHeader cols={[t.colFlight, t.colRoute, t.colTicketsCount, t.colTotalSales]} />
              {data.perFlight.map((f) => (
                <div
                  key={f.flightNo}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    padding: 11,
                    fontSize: 11.5,
                    color: '#16202e',
                    borderBottom: '1px solid #f6f8fb',
                    alignItems: 'center',
                    minWidth: 480,
                  }}
                >
                  <span dir="ltr">{f.flightNo}</span>
                  <span dir="ltr">{f.route}</span>
                  <span>{faDigits(f.ticketsCount)}</span>
                  <span style={{ fontWeight: 800, color: '#1f8a5b' }}>
                    {faMoney(f.salesIrr)} {t.toman}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, overflow: 'hidden' }}>
          <div
            style={{
              padding: '11px 14px',
              borderBottom: '1px solid #eef2f7',
              fontSize: 13.5,
              fontWeight: 800,
              color: '#0d2640',
            }}
          >
            {t.ticketsHeading}
          </div>
          {data.tickets.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a96a6', margin: 0 }}>
              {t.ticketsEmpty}
            </p>
          ) : (
            <div style={{ overflowX: 'auto', padding: '0 7px' }}>
              <TableHeader cols={[t.colPnr, t.colFlight, t.colDepartureDate, t.colAmount, t.colStatus]} />
              {data.tickets.map((row) => (
                <div
                  key={row.pnr}
                  data-testid="agency-sales-ticket-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    padding: 11,
                    fontSize: 11.5,
                    color: '#16202e',
                    borderBottom: '1px solid #f6f8fb',
                    alignItems: 'center',
                    minWidth: 520,
                  }}
                >
                  <span dir="ltr" style={{ fontWeight: 700 }}>
                    {row.pnr}
                  </span>
                  <span dir="ltr">
                    {row.flightNo} — {row.route}
                  </span>
                  <span style={{ color: '#5a6678' }}>{formatJalaliDate(row.departureAt)}</span>
                  <span style={{ fontWeight: 800, color: '#0d2640' }}>
                    {faMoney(row.priceIrr)} {t.toman}
                  </span>
                  <span>{BOOKING_STATUS_LABEL[row.status]?.[locale] ?? row.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
