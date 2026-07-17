import { useEffect, useState } from 'react';
import { fetchItDashboard } from '../../api/it-manager';
import { faDigits, faPercent } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { ItDashboardData } from '../../types/it-manager';

const BACKUP_STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'موفق',
  FAILED: 'ناموفق',
  RUNNING: 'در حال اجرا',
};

export default function ItDashboardPage() {
  const [data, setData] = useState<ItDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItDashboard()
      .then(setData)
      .catch(() => setError('خطا در دریافت داشبورد فنی.'));
  }, []);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const kpis = [
    { label: 'کارمندان فعال', value: data.kpis.activeEmployees },
    { label: 'نشست‌های فعال', value: data.kpis.activeSessions },
    { label: 'سرویس فعال', value: `${data.kpis.servicesUp}/${data.kpis.servicesTotal}` },
    {
      label: 'آخرین پشتیبان',
      value: data.kpis.lastBackupStatus
        ? BACKUP_STATUS_LABEL[data.kpis.lastBackupStatus] ?? data.kpis.lastBackupStatus
        : '—',
    },
  ];

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">داشبورد فنی</h1>
      <p className="mb-6 text-sm text-muted">نمای کلی سلامت زیرساخت و سرویس‌های blujet</p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-white p-4">
            <div className="text-[11px] text-muted">{k.label}</div>
            <div className="font-num mt-1 text-lg font-black text-ink">{faDigits(k.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">سلامت سرویس‌ها</h2>
          <ul className="space-y-2.5">
            {data.serviceHealth.map((s) => (
              <li key={s.name} className="flex items-center gap-2.5 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${s.enabled ? 'bg-[#059669]' : 'bg-danger'}`}
                />
                <span className="flex-1 text-text-2">{s.name}</span>
                {s.uptimePct !== null && (
                  <span className="font-num text-muted">{faPercent(s.uptimePct)}</span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    s.enabled ? 'bg-[#10b98124] text-[#059669]' : 'bg-danger/15 text-danger'
                  }`}
                >
                  {s.enabled ? 'فعال' : 'غیرفعال'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">استفاده از منابع سرور</h2>
            <div className="space-y-3 text-xs">
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-text-2">حافظه</span>
                  <span className="font-num font-bold text-muted">{faPercent(data.resources.memoryUsedPct)}</span>
                </div>
                <div className="h-2 rounded bg-surface">
                  <div
                    className="h-2 rounded bg-accent"
                    style={{ width: `${Math.min(100, data.resources.memoryUsedPct)}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">میانگین بار (۱ دقیقه)</span>
                <span className="font-num font-bold text-muted">{faDigits(data.resources.loadAvg1m.toFixed(2))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">هسته‌های پردازنده</span>
                <span className="font-num font-bold text-muted">{faDigits(data.resources.cpuCount)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">رویدادهای اخیر</h2>
            {data.recentEvents.length === 0 ? (
              <p className="text-xs text-muted">رویدادی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recentEvents.map((e) => (
                  <li key={e.id} className="text-[11px]">
                    <div className="text-text-2">{e.text}</div>
                    <div className="font-num mt-0.5 text-muted">{formatJalaliDateTime(e.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
