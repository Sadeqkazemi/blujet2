import { useEffect, useState } from 'react';
import { fetchSystemLogs } from '../../api/it-manager';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { AuditLogRow } from '../../types/it-manager';

const LEVEL_LABEL: Record<AuditLogRow['level'], { label: string; className: string }> = {
  info: { label: 'info', className: 'bg-[#3b82f62e] text-[#1d4ed8]' },
  warn: { label: 'warn', className: 'bg-[#f59e0b24] text-[#b45309]' },
  error: { label: 'error', className: 'bg-danger/15 text-danger' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemLogs()
      .then(setLogs)
      .catch(() => setError('خطا در دریافت لاگ‌ها.'));
  }, []);

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">لاگ و رویدادها</h1>
      <p className="mb-6 text-sm text-muted">فعالیت‌های ثبت‌شدهٔ کارمندان واحدها — اقدامات و ایجاد حساب‌ها</p>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[0.9fr_1.2fr_2fr_0.8fr_0.7fr] gap-2 border-b border-border bg-surface px-4 py-2.5 text-[10.5px] font-bold text-muted">
          <span>زمان</span>
          <span>کارمند</span>
          <span>رویداد</span>
          <span>واحد</span>
          <span>سطح</span>
        </div>
        {logs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">فعالیتی از کارمندان ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((l) => {
              const lvl = LEVEL_LABEL[l.level] ?? LEVEL_LABEL.info;
              return (
                <li
                  key={l.id}
                  className="grid grid-cols-[0.9fr_1.2fr_2fr_0.8fr_0.7fr] items-center gap-2 px-4 py-3 text-xs"
                >
                  <span className="font-num text-muted">{formatJalaliDateTime(l.createdAt)}</span>
                  <span className="font-bold text-text-2">{l.actorName}</span>
                  <span className="text-text-2">{l.action} — {l.detail}</span>
                  <span className="text-text-2">{l.unit}</span>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${lvl.className}`}>
                    {lvl.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
