// صندلی‌های تخصیص‌یافته — real per-flight allotments (Phase 16), replacing
// the earlier mock/sample data with GET /agency-portal/allotments. The
// info banner and Allocated/Sold/Remaining labels reuse
// design-reference-v2/پنل آژانس.dc.html's own isEN vocabulary for this
// exact tab (seatsInfoBanner, allocatedLabel, soldLabel, remainingLabel);
// AR has no counterpart there and is hand-translated.
import { useEffect, useState } from 'react';
import { fetchAllotments } from '../../api/agency-portal';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyAllotmentRow } from '../../types/agency-portal';

const STR: Record<
  StoredLocale,
  {
    heading: string;
    subtitle: string;
    infoBanner: string;
    errorFallback: string;
    empty: string;
    activeBadge: string;
    releasedBadge: string;
    demandLabel: string;
    allocatedLabel: string;
    soldLabel: string;
    remainingLabel: string;
    flightLicenseLabel: string;
  }
> = {
  fa: {
    heading: 'صندلی‌های تخصیص‌یافته',
    subtitle: 'ظرفیت تخصیص‌یافته بر اساس تقاضا برای پروازهای مجاز',
    infoBanner:
      'صندلی‌های تخصیص‌یافته از سوی ایرلاین بر اساس میزان تقاضای آژانس شما، برای پروازهایی که مجوز پرواز آن‌ها صادر شده است. این ظرفیت برای فروش در اختیار شما قرار گرفته است.',
    errorFallback: 'خطا در دریافت سهمیه‌های صندلی.',
    empty: 'هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.',
    activeBadge: 'مجوز پرواز',
    releasedBadge: 'آزادشده',
    demandLabel: 'تقاضا',
    allocatedLabel: 'تخصیص‌یافته',
    soldLabel: 'فروخته',
    remainingLabel: 'باقی‌مانده',
    flightLicenseLabel: 'مجوز پرواز',
  },
  en: {
    heading: 'Allocated Seats',
    subtitle: 'Capacity allocated by demand for licensed flights',
    infoBanner:
      "Seats allocated by the airline based on your agency's demand, for flights whose operating license has been issued. This capacity is available for you to sell.",
    errorFallback: 'Error loading seat allotments.',
    empty: 'No allotment has been recorded for your agency yet.',
    activeBadge: 'Flight license',
    releasedBadge: 'Released',
    demandLabel: 'Demand',
    allocatedLabel: 'Allocated',
    soldLabel: 'Sold',
    remainingLabel: 'Remaining',
    flightLicenseLabel: 'Flight license',
  },
  ar: {
    heading: 'المقاعد المخصصة',
    subtitle: 'السعة المخصصة حسب الطلب للرحلات المرخّصة',
    infoBanner:
      'مقاعد مخصصة من شركة الطيران بناءً على طلب وكالتك، للرحلات التي صدر لها تصريح تشغيل. هذه السعة متاحة لك للبيع.',
    errorFallback: 'خطأ في تحميل حصص المقاعد.',
    empty: 'لم يتم تسجيل أي حصة لوكالتك بعد.',
    activeBadge: 'ترخيص الرحلة',
    releasedBadge: 'مُحرَّر',
    demandLabel: 'الطلب',
    allocatedLabel: 'مخصَّص',
    soldLabel: 'مباع',
    remainingLabel: 'متبقٍ',
    flightLicenseLabel: 'ترخيص الرحلة',
  },
};

export default function AgencySeatsPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [rows, setRows] = useState<AgencyAllotmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllotments()
      .then(setRows)
      .catch(() => setError(t.errorFallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="agency-seats">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', margin: 0 }}>{t.heading}</h1>
        <div style={{ fontSize: 11.5, color: '#7a8696', marginTop: 3 }}>{t.subtitle}</div>
      </div>

      <div
        style={{
          background: '#eef4fb',
          border: '1px solid #d9e7f6',
          borderRadius: 13,
          padding: '11px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#1a4674',
          lineHeight: 1.8,
          marginBottom: 11,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        {t.infoBanner}
      </div>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: '#e5484d' }}>{error}</p>}

      {rows && rows.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#8a96a6', padding: 24 }}>{t.empty}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {(rows ?? []).map((f) => {
          const left = Math.max(f.seatsAllocated - f.seatsUsed, 0);
          const pct = f.seatsAllocated > 0 ? Math.round((f.seatsUsed / f.seatsAllocated) * 100) : 0;
          return (
            <div
              key={f.id}
              data-testid="alloc-card"
              style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: '12px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 11,
                      background: '#eef4fb',
                      color: '#1668c4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flex: 'none',
                    }}
                  >
                    ✈
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0d2640' }}>{f.route}</div>
                    <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 2 }}>
                      <span dir="ltr">{f.flightNo}</span> · {formatJalaliDateTime(f.departureAt)}
                    </div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10.5px] font-extrabold ${
                    f.active ? 'bg-[#e8f5ee] text-[#1f8a5b]' : 'bg-surface text-muted'
                  }`}
                >
                  {f.active ? t.activeBadge : t.releasedBadge}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    [t.allocatedLabel, f.seatsAllocated, '#1668c4'],
                    [t.soldLabel, f.seatsUsed, '#1f8a5b'],
                    [t.remainingLabel, left, left === 0 ? '#d64545' : '#0d2640'],
                  ] as const
                ).map(([label, val, color]) => (
                  <div key={label} className="rounded-xl border border-[#eef1f5] bg-[#fafbfd] p-3 text-center">
                    <div className="mb-1 text-[10.5px] text-[#8a96a6]">{label}</div>
                    <div className="text-lg font-black" style={{ color }}>
                      {faDigits(val)}
                    </div>
                  ))}
                  {f.active && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 34,
                        padding: '0 11px',
                        background: '#eaf7f0',
                        color: '#1f8a5b',
                        border: '1px solid #cdeede',
                        borderRadius: 18,
                        fontSize: 11.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {t.flightLicenseLabel}
                    </div>
                  )}
                  {!f.active && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8a96a6', background: '#f1f4f8', padding: '5px 11px', borderRadius: 18 }}>
                      {t.releasedBadge}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 8, background: '#eef2f7', borderRadius: 5, marginTop: 16, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg,#1f8a5b,#34d399)',
                    borderRadius: 5,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
