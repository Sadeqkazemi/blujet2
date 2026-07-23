// صندلی‌های تخصیص‌یافته — real per-flight allotments (Phase 16), replacing
// the earlier mock/sample data with GET /agency-portal/allotments.
import { useEffect, useState } from 'react';
import { fetchAllotments } from '../../api/agency-portal';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { AgencyAllotmentRow } from '../../types/agency-portal';

export default function AgencySeatsPage() {
  const [rows, setRows] = useState<AgencyAllotmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllotments()
      .then(setRows)
      .catch(() => setError('خطا در دریافت سهمیه‌های صندلی.'));
  }, []);

  return (
    <div>
      <div className="mb-5 rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-4 text-xs leading-6 text-[#3f546b]">
        صندلی‌های تخصیص‌یافته از سوی ایرلاین بر اساس میزان تقاضای آژانس شما، برای پروازهایی که مجوز پرواز آن‌ها صادر شده است. این ظرفیت برای فروش در اختیار شما قرار گرفته است.
      </div>

      {error && <p className="mb-4 text-xs text-danger">{error}</p>}

      {rows && rows.length === 0 && (
        <p className="text-center text-xs text-muted">هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.</p>
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
                  {f.active ? 'فعال' : 'آزادشده'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['تخصیص‌یافته', f.seatsAllocated, '#1668c4'],
                    ['فروخته', f.seatsUsed, '#1f8a5b'],
                    ['باقی‌مانده', left, left === 0 ? '#d64545' : '#0d2640'],
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
