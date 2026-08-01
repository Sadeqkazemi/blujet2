import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '../../api/agency-portal';
import { faDigits, faMoney, formatLocalePercent } from '../../lib/fa-format';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyDashboard } from '../../types/agency-portal';

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

function chartBarLabel(salesIrr: string, locale: StoredLocale): string {
  const tomans = Math.round(Number(salesIrr) / 10);
  if (tomans >= 1_000_000) {
    const compact = Math.round(tomans / 1_000_000);
    return locale === 'en' ? String(compact) : faDigits(compact);
  }
  return faMoney(salesIrr);
}

const STR: Record<
  StoredLocale,
  {
    heading: string;
    subtitle: string;
    errorFallback: string;
    loading: string;
    newMessage: string;
    kpiSales: string;
    kpiCredit: string;
    kpiTicketsIssued: string;
    kpiSeatsSold: string;
    salesTrendTitle: string;
    salesTrendSub: string;
    chartAriaLabel: string;
    creditRemainingCardLabel: string;
    creditLimitLine: (limit: string) => string;
    usedLabel: string;
    viewStatement: string;
    toman: string;
  }
> = {
  fa: {
    heading: 'داشبورد آژانس',
    subtitle: 'نمای کلی فروش، اعتبار و صندلی‌های شما',
    errorFallback: 'خطا در دریافت داشبورد.',
    loading: 'در حال بارگذاری…',
    newMessage: 'پیام جدید',
    kpiSales: 'فروش این ماه',
    kpiCredit: 'اعتبار باقیمانده',
    kpiTicketsIssued: 'بلیط صادرشده',
    kpiSeatsSold: 'صندلی فروخته‌شده',
    salesTrendTitle: 'روند فروش آژانس',
    salesTrendSub: '۶ ماه اخیر · تومان',
    chartAriaLabel: 'نمودار فروش ۶ ماه اخیر',
    creditRemainingCardLabel: 'اعتبار باقیمانده',
    creditLimitLine: (limit) => `از سقف ${limit}`,
    usedLabel: 'مصرف‌شده:',
    viewStatement: 'مشاهده صورت‌حساب',
    toman: 'تومان',
  },
  en: {
    heading: 'Agency Dashboard',
    subtitle: 'Overview of your sales, credit, and seats',
    errorFallback: 'Error loading the dashboard.',
    loading: 'Loading…',
    newMessage: 'New message',
    kpiSales: 'Sales this month',
    kpiCredit: 'Credit remaining',
    kpiTicketsIssued: 'Tickets issued',
    kpiSeatsSold: 'Seats sold',
    salesTrendTitle: 'Agency sales trend',
    salesTrendSub: 'Last 6 months · Toman',
    chartAriaLabel: 'Last 6 months sales chart',
    creditRemainingCardLabel: 'Credit remaining',
    creditLimitLine: (limit) => `of ${limit} limit`,
    usedLabel: 'Used:',
    viewStatement: 'View statement',
    toman: 'Toman',
  },
  ar: {
    heading: 'لوحة تحكم الوكالة',
    subtitle: 'نظرة عامة على مبيعاتك ورصيدك ومقاعدك',
    errorFallback: 'خطأ في تحميل لوحة التحكم.',
    loading: 'جارٍ التحميل…',
    newMessage: 'رسالة جديدة',
    kpiSales: 'مبيعات هذا الشهر',
    kpiCredit: 'الرصيد المتبقي',
    kpiTicketsIssued: 'التذاكر الصادرة',
    kpiSeatsSold: 'المقاعد المباعة',
    salesTrendTitle: 'اتجاه مبيعات الوكالة',
    salesTrendSub: 'آخر ٦ أشهر · تومان',
    chartAriaLabel: 'مخطط مبيعات آخر 6 أشهر',
    creditRemainingCardLabel: 'الرصيد المتبقي',
    creditLimitLine: (limit) => `من سقف ${limit}`,
    usedLabel: 'المستخدم:',
    viewStatement: 'عرض كشف الحساب',
    toman: 'تومان',
  },
};

const KPI_ICONS = {
  sales: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l3.5-3.5 3 3L20 7" />
    </svg>
  ),
  credit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
  tickets: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
      <path d="M5 11h11a2 2 0 0 1 2 2v3H5z" />
    </svg>
  ),
  seats: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6z" />
    </svg>
  ),
};

export default function AgencyDashboardPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [data, setData] = useState<AgencyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => setError(t.errorFallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p style={{ fontSize: 13, color: '#e5484d' }}>{error}</p>;
  }
  if (!data) {
    return <p style={{ fontSize: 13, color: '#8a96a6' }}>{t.loading}</p>;
  }

  const max = Math.max(1, ...data.monthlySales.map((m) => Number(m.salesIrr)));
  const limit = Number(data.credit.limitIrr);
  const used = Number(data.credit.usedIrr);
  const usedPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const limitMoney = faMoney(data.credit.limitIrr);
  const usedMoney = faMoney(data.credit.usedIrr);

  const kpis = [
    {
      key: 'sales',
      label: t.kpiSales,
      value: `${faMoney(data.kpis.salesThisMonthIrr)} ${t.toman}`,
      iconBg: '#eef4fb',
      iconColor: '#1668c4',
      icon: KPI_ICONS.sales,
    },
    {
      key: 'credit',
      label: t.kpiCredit,
      value: `${faMoney(data.credit.remainingIrr)} ${t.toman}`,
      iconBg: '#eaf7f0',
      iconColor: '#1f8a5b',
      icon: KPI_ICONS.credit,
    },
    {
      key: 'tickets',
      label: t.kpiTicketsIssued,
      value: faDigits(data.kpis.ticketsIssuedTotal),
      iconBg: '#f1ecfe',
      iconColor: '#8a5cf6',
      icon: KPI_ICONS.tickets,
    },
    {
      key: 'seats',
      label: t.kpiSeatsSold,
      value: faDigits(data.kpis.seatsSoldThisMonth),
      iconBg: '#fdf1e7',
      iconColor: '#e8893a',
      icon: KPI_ICONS.seats,
    },
  ];

  return (
    <div data-testid="agency-dashboard">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
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
        <Link
          to="/agency/inbox"
          style={{
            height: 42,
            padding: '0 15px',
            background: '#1668c4',
            color: '#fff',
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t.newMessage}
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 13,
          marginBottom: 20,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.key}
            data-testid={`agency-kpi-${k.key}`}
            style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: k.iconBg,
                  color: k.iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {k.icon}
              </div>
            </div>
            <div style={{ fontSize: 21.5, fontWeight: 900, color: '#0d2640', letterSpacing: '-0.5px' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
          gap: 13,
        }}
      >
        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: 14 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', margin: 0, whiteSpace: 'nowrap' }}>{t.salesTrendTitle}</h3>
            <div style={{ fontSize: 11, color: '#8a96a6', marginTop: 3 }}>{t.salesTrendSub}</div>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 11, height: 170, paddingTop: 5 }}
            role="img"
            aria-label={t.chartAriaLabel}
          >
            {data.monthlySales.map((m) => {
              const h = Math.max(Math.round((Number(m.salesIrr) / max) * 100), 4);
              return (
                <div
                  key={m.month}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#5a6678' }}>{chartBarLabel(m.salesIrr, locale)}</div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 34,
                      height: `${h}%`,
                      background: 'linear-gradient(180deg,#3b8ae0,#1668c4)',
                      borderRadius: '7px 7px 0 0',
                    }}
                    aria-label={`${monthLabel(m.month, locale)} — ${faMoney(m.salesIrr)} ${t.toman}`}
                  />
                  <div style={{ fontSize: 10.5, color: '#8a96a6', fontWeight: 600 }}>{monthLabel(m.month, locale)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          data-testid="agency-credit-card"
          style={{
            background: 'linear-gradient(135deg,#0d2640,#16406e)',
            borderRadius: 14,
            padding: 15,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 11.5, color: '#aac4e2', fontWeight: 600 }}>{t.creditRemainingCardLabel}</div>
          <div style={{ fontSize: 27, fontWeight: 900, margin: '6px 0 2px', letterSpacing: '-0.5px' }}>
            {faMoney(data.credit.remainingIrr)} <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>{t.toman}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#8fb0d6' }}>{t.creditLimitLine(limitMoney)}</div>
          <div style={{ height: 9, background: 'rgba(255,255,255,.16)', borderRadius: 6, margin: '16px 0 8px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${usedPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg,#4ade80,#22c55e)',
                borderRadius: 6,
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aac4e2' }}>
            <span>
              {t.usedLabel} {usedMoney}
            </span>
            <span>{formatLocalePercent(usedPct, locale)}</span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 13 }}>
            <Link
              to="/agency/credit"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,.12)',
                border: '1px solid rgba(255,255,255,.18)',
                borderRadius: 10,
                height: 42,
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              {t.viewStatement}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
