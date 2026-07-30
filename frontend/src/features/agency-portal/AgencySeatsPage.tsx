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

const STR: Record<StoredLocale, {
  infoBanner: string;
  errorFallback: string;
  empty: string;
  activeBadge: string;
  releasedBadge: string;
  allocatedLabel: string;
  soldLabel: string;
  remainingLabel: string;
}> = {
  fa: {
    infoBanner: 'صندلی‌های تخصیص‌یافته از سوی ایرلاین بر اساس میزان تقاضای آژانس شما، برای پروازهایی که مجوز پرواز آن‌ها صادر شده است. این ظرفیت برای فروش در اختیار شما قرار گرفته است.',
    errorFallback: 'خطا در دریافت سهمیه‌های صندلی.',
    empty: 'هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.',
    activeBadge: 'فعال',
    releasedBadge: 'آزادشده',
    allocatedLabel: 'تخصیص‌یافته',
    soldLabel: 'فروخته',
    remainingLabel: 'باقی‌مانده',
  },
  en: {
    infoBanner: "Seats allocated by the airline based on your agency's demand, for flights whose operating license has been issued. This capacity is available for you to sell.",
    errorFallback: 'Error loading seat allotments.',
    empty: 'No allotment has been recorded for your agency yet.',
    activeBadge: 'Active',
    releasedBadge: 'Released',
    allocatedLabel: 'Allocated',
    soldLabel: 'Sold',
    remainingLabel: 'Remaining',
  },
  ar: {
    infoBanner: 'مقاعد مخصصة من شركة الطيران بناءً على طلب وكالتك، للرحلات التي صدر لها تصريح تشغيل. هذه السعة متاحة لك للبيع.',
    errorFallback: 'خطأ في تحميل حصص المقاعد.',
    empty: 'لم يتم تسجيل أي حصة لوكالتك بعد.',
    activeBadge: 'نشط',
    releasedBadge: 'مُحرَّر',
    allocatedLabel: 'مخصَّص',
    soldLabel: 'مباع',
    remainingLabel: 'متبقٍ',
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
    <div>
      <div className="mb-5 rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-4 text-xs leading-6 text-[#3f546b]">
        {t.infoBanner}
      </div>

      {error && <p className="mb-4 text-xs text-danger">{error}</p>}

      {rows && rows.length === 0 && (
        <p className="text-center text-xs text-muted">{t.empty}</p>
      )}

      <div className="flex flex-col gap-4">
        {(rows ?? []).map((f) => {
          const left = Math.max(f.seatsAllocated - f.seatsUsed, 0);
          return (
            <div
              key={f.id}
              data-testid="alloc-card"
              className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f7fd] text-base">
                    ✈
                  </span>
                  <div>
                    <div className="text-sm font-black text-[#0d2640]">{f.route}</div>
                    <div className="mt-0.5 text-[11px] text-[#8a96a6]">
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
                    <div className="font-num text-lg font-black" style={{ color }}>
                      {faDigits(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
