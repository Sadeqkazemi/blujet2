import { useEffect, useMemo, useState } from 'react';
import { fetchManagerReports } from '../../api/audit';
import { faDigits } from '../../lib/fa-format';
import { dayjs, formatJalaliDateTime } from '../../lib/jalali';
import PanelAlert from '../panel/PanelAlert';
import {
  panelCard,
  panelInput,
  panelMuted,
  panelMuted2,
  panelSegmentBtn,
  panelTitle,
  panelValue,
} from '../panel/panel-theme';
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

const CATEGORY_STYLE: Record<string, { color: string; bg: string }> = {
  FINANCE: { color: '#34d399', bg: 'rgba(52,211,153,.16)' },
  AGENCY: { color: '#60a5fa', bg: 'rgba(59,130,246,.16)' },
  SECURITY: { color: '#f87171', bg: 'rgba(248,113,113,.16)' },
  ACCESS: { color: '#f59e0b', bg: 'rgba(245,158,11,.16)' },
  SYSTEM: { color: '#a855f7', bg: 'rgba(168,85,247,.16)' },
};

const ROLE_FILTERS = ['FINANCE_MANAGER', 'COMMERCIAL_MANAGER', 'IT_MANAGER', 'SITE_ADMIN'];

function isTodayTehran(iso: string): boolean {
  const today = dayjs().tz('Asia/Tehran').format('YYYY-MM-DD');
  const rowDay = dayjs(iso).tz('Asia/Tehran').format('YYYY-MM-DD');
  return rowDay === today;
}

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

  const kpis = useMemo(() => {
    if (!rows) return null;
    return {
      total: rows.length,
      today: rows.filter((r) => isTodayTehran(r.createdAt)).length,
      activeManagers: new Set(rows.map((r) => r.actorId)).size,
    };
  }, [rows]);

  if (error) return <PanelAlert className="mb-0">{error}</PanelAlert>;

  return (
    <div className="flex flex-col gap-4">
      {kpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={`${panelCard} px-[18px] py-4`}>
            <div className={`mb-2 text-[11.5px] ${panelMuted}`}>کل گزارش‌ها</div>
            <div className={panelValue}>{faDigits(kpis.total)}</div>
          </div>
          <div className={`${panelCard} px-[18px] py-4`}>
            <div className={`mb-2 text-[11.5px] ${panelMuted}`}>اقدامات امروز</div>
            <div className="font-num text-[26px] font-black text-[#34d399]">{faDigits(kpis.today)}</div>
          </div>
          <div className={`${panelCard} px-[18px] py-4`}>
            <div className={`mb-2 text-[11.5px] ${panelMuted}`}>مدیران فعال</div>
            <div className="font-num text-[26px] font-black text-panel-accent">{faDigits(kpis.activeManagers)}</div>
          </div>
        </div>
      )}

      <div className={`${panelCard} p-4`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={panelTitle}>اقدامات کلیدی مدیران</h2>
            <p className={`mt-1 text-[11.5px] leading-relaxed ${panelMuted}`}>
              هر اقدام مهم مدیران واحدها به‌صورت خودکار برای هیئت مدیره ثبت می‌شود.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActorRole(null)}
              className={panelSegmentBtn(actorRole === null)}
            >
              همه نقش‌ها
            </button>
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setActorRole(actorRole === r ? null : r)}
                className={panelSegmentBtn(actorRole === r)}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در اقدامات…"
            className={`h-[42px] w-full max-w-md px-3.5 ${panelInput}`}
          />
        </div>

        {rows === null ? (
          <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <div className={`rounded-[13px] border border-dashed border-panel-border px-6 py-8 text-center text-xs ${panelMuted}`}>
            گزارشی با این فیلتر یافت نشد.
          </div>
        ) : (
          <>
            <p className={`mb-3 text-[11.5px] ${panelMuted}`}>
              نمایش <span className="font-num font-extrabold text-panel-text">{faDigits(rows.length)}</span> گزارش
            </p>
            <div className="flex flex-col gap-2.5">
              {rows.map((r) => {
                const catStyle = CATEGORY_STYLE[r.category] ?? {
                  color: '#9fb0c7',
                  bg: 'rgba(159,176,199,.12)',
                };
                return (
                  <div
                    key={r.id}
                    className="rounded-[13px] border border-panel-border px-3.5 py-3"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-extrabold text-white">{r.action}</span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                        style={{ color: catStyle.color, background: catStyle.bg }}
                      >
                        {CATEGORY_LABEL[r.category] ?? r.category}
                      </span>
                      <span className="rounded-full bg-panel-elevated px-2.5 py-0.5 text-[10px] font-bold text-panel-muted">
                        {ROLE_LABEL[r.actorRole] ?? r.actorRole}
                      </span>
                      <span className={`font-num ms-auto text-[10.5px] ${panelMuted}`}>
                        {formatJalaliDateTime(r.createdAt)}
                      </span>
                    </div>
                    <div className={`text-[11.5px] leading-6 ${panelMuted2}`}>{r.detail}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
