import { useEffect, useState } from 'react';
import { fetchStaffReports } from '../../api/reporting';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
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
  const { user } = useAuth();
  const deptLabel = user?.role === 'FINANCE_MANAGER' ? 'واحد مالی' : 'واحد بازرگانی';
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

  const reportsPager = usePagination(data?.reports ?? []);

  if (error) return <p className="px-[21px] py-8 text-sm text-[#f87171]">{error}</p>;
  if (!data) return <p className="px-[21px] py-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;

  const selected = staffId ? data.staff.find((s) => s.id === staffId) : null;

  const isNewStaff = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return created >= cutoff;
  };

  return (
    <div className="flex flex-col gap-[15px] px-[21px] pb-[34px] pt-[18px]">
      <div>
        <h1 className="m-0 text-[20.5px] font-black text-white">گزارش کارمندان</h1>
        <p className="mt-1 text-[11.5px] text-[#6b7b94]">
          اقدامات کارمندان {deptLabel} — برای هر کارمند یک تب جداگانه
        </p>
      </div>

      {!bannerDismissed && data.newEmployeeEvents.length > 0 && (
        <div className="rounded-[14px] border border-[rgba(59,130,246,.32)] bg-[rgba(59,130,246,.08)] px-4 py-3.5">
          <div className="mb-[9px] flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-[9px]">
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[rgba(59,130,246,.18)] text-[#60a5fa]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </span>
              <h2 className="m-0 text-[13.5px] font-extrabold text-white">کارمند جدید توسط مدیر IT اضافه شد</h2>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-[11px] font-bold text-[#9fb0c7] transition hover:text-white"
            >
              علامت‌گذاری به‌عنوان خوانده‌شده
            </button>
          </div>
          <div className="flex flex-col gap-[7px]">
            {data.newEmployeeEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-[#dbe3f0]">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#60a5fa]" />
                <span className="flex-1">{e.detail}</span>
                <span className="font-num text-[10.5px] text-[#6b7b94]">{formatJalaliDateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#1f2a3d] bg-[#141d2e] p-4">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="m-0 text-[15px] font-extrabold text-white">گزارش عملکرد کارمندان</h2>
            <p className="mt-1 text-[11.5px] text-[#6b7b94]">
              هر اقدام مهم کارمندان به‌صورت خودکار ثبت و برای شما نمایش داده می‌شود.
            </p>
          </div>
          <span className="rounded-[9px] bg-[#18223a] px-[13px] py-[7px] text-[11.5px] font-bold text-[#9fb0c7]">
            {faDigits(data.staff.length)} کارمند فعال
          </span>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-[7px]">
          <button
            onClick={() => setStaffId(null)}
            className={`rounded-[9px] px-3.5 py-2 text-[11.5px] transition ${
              staffId === null
                ? 'bg-[#3b82f6] font-bold text-white'
                : 'bg-[#18223a] text-[#9fb0c7] hover:text-white'
            }`}
          >
            همهٔ کارمندان
          </button>
          {data.staff.map((s) => (
            <button
              key={s.id}
              onClick={() => setStaffId(s.id)}
              className={`relative rounded-[9px] px-3.5 py-2 text-[11.5px] transition ${
                staffId === s.id
                  ? 'bg-[#3b82f6] font-bold text-white'
                  : 'bg-[#18223a] text-[#9fb0c7] hover:text-white'
              }`}
            >
              {s.fullName}
              {isNewStaff(s.createdAt) && (
                <span className="absolute -top-[3px] end-[-3px] h-[9px] w-[9px] rounded-full border-2 border-[#141d2e] bg-[#f87171]" />
              )}
            </button>
          ))}
        </div>

        <div className="mb-3 border-b border-[#1f2a3d] pb-3 text-xs text-[#8fa1bb]">
          {selected ? `${selected.fullName}${selected.rank ? ` · ${selected.rank}` : ''}` : `همهٔ کارمندان ${deptLabel}`}{' '}
          · <span className="font-num font-bold text-[#cdd9ec]">{faDigits(data.reports.length)}</span> گزارش
        </div>

        {data.reports.length === 0 ? (
          <p className="px-3 py-[26px] text-center text-xs text-[#6b7b94]">گزارشی برای این کارمند ثبت نشده است.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reportsPager.pageItems.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-[#1f2a3d] bg-[#101a2c] px-3.5 py-[13px]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[rgba(59,130,246,.2)] text-[12.5px] font-extrabold text-white">
                  {r.staffName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-[9px]">
                    <span className="text-[13px] font-extrabold text-white">{r.action}</span>
                    <span className="rounded-xl bg-[rgba(59,130,246,.14)] px-[9px] py-[3px] text-[10px] font-bold text-[#60a5fa]">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </span>
                  </div>
                  <div className="text-[11.5px] leading-[1.8] text-[#9fb0c7]">{r.detail}</div>
                  <div className="mt-[7px] flex items-center gap-2 text-[10.5px] text-[#6b7b94]">
                    <span>{r.staffName}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-[#3a4a63]" />
                    <span className="font-num">{formatJalaliDateTime(r.at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          page={reportsPager.page}
          totalPages={reportsPager.totalPages}
          onChange={reportsPager.setPage}
          variant="dark"
        />
      </div>
    </div>
  );
}
