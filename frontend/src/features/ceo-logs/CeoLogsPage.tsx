import { useEffect, useState } from 'react';
import { fetchSystemEvents } from '../../api/admins';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { SystemEventRow } from '../../types/admins';

const LEVEL_META: Record<SystemEventRow['level'], { label: string; className: string }> = {
  OK: { label: 'موفق', className: 'bg-[#10b98124] text-[#059669]' },
  WARN: { label: 'هشدار', className: 'bg-[#f59e0b24] text-[#b45309]' },
  INFO: { label: 'info', className: 'bg-accent/10 text-accent' },
};

export default function CeoLogsPage() {
  const [rows, setRows] = useState<SystemEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemEvents()
      .then(setRows)
      .catch(() => setError('خطا در دریافت لاگ‌ها.'));
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!rows) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">لاگ‌ها و رویدادهای سامانه</h1>
      <p className="mb-6 text-sm text-muted">آخرین اقدامات ثبت‌شدهٔ مدیران و رخدادهای کلیدی سامانه</p>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-border bg-body text-[10px] text-muted">
              <th className="p-3 font-bold">زمان</th>
              <th className="p-3 font-bold">کاربر</th>
              <th className="p-3 font-bold">رویداد</th>
              <th className="p-3 font-bold">سطح</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = LEVEL_META[r.level];
              return (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="font-num p-3 whitespace-nowrap text-muted">
                    {formatJalaliDateTime(r.at)}
                  </td>
                  <td className="p-3 font-bold text-ink">{r.user}</td>
                  <td className="p-3 text-text-2">{r.action}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
