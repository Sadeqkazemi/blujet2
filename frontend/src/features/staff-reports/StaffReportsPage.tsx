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

  if (error) return <p className="p-8 text-sm text-[#f87171]">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;

  const selected = staffId ? data.staff.find((s) => s.id === staffId) : null;

  const isNewStaff = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return created >= cutoff;
  };

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <h1 className="mb-1 text-[20.5px] font-black text-white">گزارش کارمندان</h1>
      <p className="mb-6 text-sm text-[#6b7b94]">
        اقدامات کارمندان واحد شما — برای هر کارمند یک تب جداگانه
      </p>

      {!bannerDismissed && data.newEmployeeEvents.length > 0 && (
        <div className="mb-6 rounded-xl border border-[#3b82f64d] bg-[#3b82f614] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-white">کارمند جدید توسط مدیر IT اضافه شد</div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-[11px] font-bold text-[#6b7b94] transition hover:text-white"
            >
              علامت‌گذاری به‌عنوان خوانده‌شده
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.newEmployeeEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-[#cdd7e5]">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#60a5fa]" />
                <span className="flex-1">{e.detail}</span>
                <span className="font-num text-[10px] text-[#6b7b94]">{formatJalaliDateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#1f2a3d] bg-[#141d2e] p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-white">گزارش عملکرد کارمندان</div>
            <div className="mt-0.5 text-[11px] text-[#6b7b94]">
              هر اقدام مهم کارمندان به‌صورت خودکار ثبت و برای شما نمایش داده می‌شود.
            </div>
          </div>
          <span className="rounded-lg border border-[#28344c] bg-[#18223a] px-3 py-1.5 text-[11px] font-bold text-[#6b7b94]">
            {faDigits(data.staff.length)} کارمند فعال
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setStaffId(null)}
            className={`rounded-lg px-3.5 py-2 text-[11.5px] transition ${
              staffId === null ? 'bg-[#3b82f6] font-bold text-white' : 'bg-[#18223a] text-[#6b7b94] hover:text-white'
            }`}
          >
            همهٔ کارمندان
          </button>
          {data.staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setStaffId(s.id)}
              className={`relative rounded-lg px-3.5 py-2 text-[11.5px] transition ${
                staffId === s.id ? 'bg-[#3b82f6] font-bold text-white' : 'bg-[#18223a] text-[#6b7b94] hover:text-white'
              }`}
            >
              {s.fullName}
              {isNewStaff(s.createdAt) && (
                <span className="absolute -top-1 end-[-4px] h-2 w-2 rounded-full border-2 border-[#141d2e] bg-[#f87171]" />
              )}
            </button>
          ))}
        </div>

        <div className="mb-3 border-b border-[#22304a] pb-3 text-xs text-[#6b7b94]">
          {selected ? `${selected.fullName}${selected.rank ? ` · ${selected.rank}` : ''}` : 'همهٔ کارمندان'} ·{' '}
          <span className="font-num font-bold text-white">{faDigits(data.reports.length)}</span> گزارش
        </div>

        {data.reports.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#6b7b94]">گزارشی برای این کارمند ثبت نشده است.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-[#22304a] bg-[#0f1726] p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-extrabold text-white">{r.action}</span>
                  <span className="rounded-full bg-[#3b82f624] px-2.5 py-0.5 text-[10px] font-bold text-[#60a5fa]">
                    {CATEGORY_LABEL[r.category] ?? r.category}
                  </span>
                </div>
                <div className="text-[11.5px] leading-6 text-[#cdd7e5]">{r.detail}</div>
                <div className="mt-2 flex items-center gap-2 text-[10.5px] text-[#6b7b94]">
                  <span>{r.staffName}</span>
                  <span className="h-1 w-1 rounded-full bg-[#28344c]" />
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
