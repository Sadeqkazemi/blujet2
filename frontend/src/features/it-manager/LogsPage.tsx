import { useEffect, useState } from 'react';
import { fetchSystemLogs } from '../../api/it-manager';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { AuditLogRow } from '../../types/it-manager';

const LEVEL_LABEL: Record<string, { label: string; className: string }> = {
  SECURITY: { label: 'امنیتی', className: 'bg-danger/15 text-danger' },
  ACCESS: { label: 'دسترسی', className: 'bg-[#a78bfa2e] text-[#6d28d9]' },
  ACCOUNT: { label: 'حساب', className: 'bg-[#3b82f62e] text-[#1d4ed8]' },
  SYSTEM: { label: 'سیستم', className: 'bg-surface text-text-2' },
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
        {logs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">فعالیتی از کارمندان ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((l) => {
              const lvl = LEVEL_LABEL[l.category] ?? { label: l.category, className: 'bg-surface text-text-2' };
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
                  <span className="font-num w-32 flex-none text-muted">{formatJalaliDateTime(l.createdAt)}</span>
                  <span className="flex-1 text-text-2">{l.detail}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${lvl.className}`}>{lvl.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
