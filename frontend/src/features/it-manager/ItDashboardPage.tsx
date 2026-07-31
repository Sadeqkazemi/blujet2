import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchItDashboard } from '../../api/it-manager';
import { faDigits, faPercent } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { ItDashboardData } from '../../types/it-manager';

const EVENT_DOT: Record<string, string> = {
  SECURITY: 'bg-[#f59e0b]',
  ACCOUNT: 'bg-accent',
  SYSTEM: 'bg-[#059669]',
  ACCESS: 'bg-[#a855f7]',
};

export default function ItDashboardPage() {
  const navigate = useNavigate();
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
    {
      label: 'سرویس فعال',
      value: `${data.kpis.servicesUp}/${data.kpis.servicesTotal}`,
      trend: 'پایدار',
      trendClass: 'text-[#059669]',
      cta: 'مدیریت ←',
      onClick: () => navigate('/panel/services'),
    },
    {
      label: 'آپ‌تایم ۳۰ روز',
      value: faPercent(data.kpis.uptime30dPct),
      trend: '+۰٫۰۲',
      trendClass: 'text-[#059669]',
      cta: 'لاگ‌ها ←',
      onClick: () => navigate('/panel/logs'),
    },
    {
      label: 'کاربر فعال سامانه',
      value: faDigits(data.kpis.activeSessions),
      trend: '+۳',
      trendClass: 'text-[#059669]',
      cta: 'کاربران ←',
      onClick: () => navigate('/panel/users'),
    },
    {
      label: 'هشدار امنیتی باز',
      value: faDigits(data.kpis.securityAlerts),
      trend: data.kpis.securityAlerts > 0 ? 'نیازمند بررسی' : 'بدون هشدار',
      trendClass: data.kpis.securityAlerts > 0 ? 'text-[#f59e0b]' : 'text-[#059669]',
      cta: 'بررسی ←',
      onClick: () => navigate('/panel/security'),
    },
  ];

  const resourceBars = [
    { label: 'پردازنده (CPU)', pct: data.resources.cpuUsedPct, color: 'bg-accent' },
    { label: 'حافظه (RAM)', pct: data.resources.memoryUsedPct, color: 'bg-[#a855f7]' },
    ...(data.resources.diskUsedPct !== null
      ? [{ label: 'دیسک', pct: data.resources.diskUsedPct, color: 'bg-[#059669]' }]
      : []),
    ...(data.resources.bandwidthUsedPct !== null
      ? [{ label: 'پهنای باند', pct: data.resources.bandwidthUsedPct, color: 'bg-[#f59e0b]' }]
      : []),
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">داشبورد فنی</h1>
          <p className="mt-1 text-sm text-muted">نمای کلی سلامت زیرساخت و سرویس‌های blujet</p>
        </div>
        {data.kpis.allServicesHealthy && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[11.5px] font-bold text-[#059669]">
            <span className="h-2 w-2 rounded-full bg-[#059669]" />
            همه سامانه‌ها سالم
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            className="rounded-xl border border-border bg-white p-4 text-right transition hover:border-accent"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-[11px] font-bold ${k.trendClass}`}>{k.trend}</span>
            </div>
            <div className="font-num text-lg font-black text-ink">{k.value}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-muted">{k.label}</span>
              <span className="text-[10px] font-bold text-accent">{k.cta}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">سلامت سرویس‌ها</h2>
            <button
              type="button"
              onClick={() => navigate('/panel/services')}
              className="text-[11px] font-bold text-accent"
            >
              مدیریت سرویس‌ها ←
            </button>
          </div>
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
                  {s.enabled ? 'سالم' : 'قطع'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">استفاده از منابع سرور</h2>
            <div className="space-y-3 text-xs">
              {resourceBars.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between">
                    <span className="text-text-2">{r.label}</span>
                    <span className="font-num font-bold text-muted">{faPercent(r.pct)}</span>
                  </div>
                  <div className="h-2 rounded bg-surface">
                    <div
                      className={`h-2 rounded ${r.color}`}
                      style={{ width: `${Math.min(100, r.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">رویدادهای اخیر</h2>
            {data.recentEvents.length === 0 ? (
              <p className="text-xs text-muted">رویدادی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recentEvents.map((e) => (
                  <li key={e.id} className="flex gap-2 text-[11px]">
                    <span
                      className={`mt-1.5 h-2 w-2 flex-none rounded-full ${EVENT_DOT[e.category] ?? 'bg-muted'}`}
                    />
                    <div>
                      <div className="text-text-2">{e.text}</div>
                      <div className="font-num mt-0.5 text-muted">
                        {formatJalaliDateTime(e.createdAt)}
                      </div>
                    </div>
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
