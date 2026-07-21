import { useEffect, useState } from 'react';
import { fetchManagerReports } from '../../api/audit';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { ManagerReportRow } from '../../types/audit';

const ROLE_LABEL: Record<string, string> = {
  CEO: 'مدیر عامل',
  BOARD_CHAIR: 'رئیس هیئت مدیره',
  SENIOR_MANAGER: 'مدیر ارشد',
  FINANCE_MANAGER: 'مدیر مالی',
  COMMERCIAL_MANAGER: 'مدیر بازرگانی',
  IT_MANAGER: 'مدیر فناوری اطلاعات',
  SITE_ADMIN: 'ادمین سایت',
  EMPLOYEE: 'کارمند',
  AGENCY: 'آژانس',
};

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

const ROLE_FILTERS = ['FINANCE_MANAGER', 'COMMERCIAL_MANAGER', 'IT_MANAGER', 'SITE_ADMIN'];

export default function ManagerReportsPage() {
  const [rows, setRows] = useState<ManagerReportRow[] | null>(null);
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchManagerReports({ actorRole: actorRole ?? undefined, q: q.trim() || undefined })
        .then((data) => {
          if (!cancelled) setRows(data);
        })
        .catch(() => {
          if (!cancelled) setError('خطا در دریافت گزارش مدیران.');
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [actorRole, q]);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">گزارش مدیران</h1>
      <p className="mb-6 text-sm text-muted">فعالیت‌های ثبت‌شدهٔ مدیران و ادمین‌ها — از دفتر رویدادهای واقعی سامانه</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در اقدامات…"
          className="w-64 rounded-lg border border-border bg-white px-3.5 py-2 text-xs outline-none focus:border-accent"
        />
        <button
          onClick={() => setActorRole(null)}
          className={`rounded-lg px-3 py-2 text-[11px] transition ${
            actorRole === null ? 'bg-accent font-bold text-white' : 'bg-body text-muted hover:text-ink'
          }`}
        >
          همه نقش‌ها
        </button>
        {ROLE_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => setActorRole(actorRole === r ? null : r)}
            className={`rounded-lg px-3 py-2 text-[11px] transition ${
              actorRole === r ? 'bg-accent font-bold text-white' : 'bg-body text-muted hover:text-ink'
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="text-sm text-muted">در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
          گزارشی با این فیلتر یافت نشد.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted">
            <span className="font-num font-bold text-ink">{faDigits(rows.length)}</span> گزارش
          </div>
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-white p-4">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-extrabold text-ink">{r.action}</span>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                  {CATEGORY_LABEL[r.category] ?? r.category}
                </span>
                <span className="rounded-full bg-body px-2.5 py-0.5 text-[10px] font-bold text-muted">
                  {ROLE_LABEL[r.actorRole] ?? r.actorRole}
                </span>
              </div>
              <div className="text-[11.5px] leading-6 text-text-2">{r.detail}</div>
              <div className="font-num mt-2 text-[10.5px] text-muted">{formatJalaliDateTime(r.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
