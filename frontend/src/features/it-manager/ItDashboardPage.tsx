import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchItDashboard } from '../../api/it-manager';
import { faDigits, faPercent } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { ItDashboardData } from '../../types/it-manager';
import PanelAlert from '../panel/PanelAlert';
import PanelCard from '../panel/PanelCard';
import PanelStatCard from '../panel/PanelStatCard';
import { panelLink, panelMuted, panelMuted2 } from '../panel/panel-theme';

const EVENT_DOT: Record<string, string> = {
  SECURITY: 'bg-[#f59e0b]',
  ACCOUNT: 'bg-panel-accent',
  SYSTEM: 'bg-[#34d399]',
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

  if (error) return <PanelAlert className="mb-0">{error}</PanelAlert>;
  if (!data) return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;

  const kpis = [
    {
      label: 'سرویس فعال',
      value: `${data.kpis.servicesUp}/${data.kpis.servicesTotal}`,
      trend: { text: 'پایدار', up: true },
      cta: 'مدیریت ←',
      onClick: () => navigate('/panel/services'),
    },
    {
      label: 'آپ‌تایم ۳۰ روز',
      value: faPercent(data.kpis.uptime30dPct),
      trend: { text: '+۰٫۰۲', up: true },
      cta: 'لاگ‌ها ←',
      onClick: () => navigate('/panel/logs'),
    },
    {
      label: 'کاربر فعال سامانه',
      value: faDigits(data.kpis.activeSessions),
      trend: { text: '+۳', up: true },
      cta: 'کاربران ←',
      onClick: () => navigate('/panel/users'),
    },
    {
      label: 'هشدار امنیتی باز',
      value: faDigits(data.kpis.securityAlerts),
      trend: {
        text: data.kpis.securityAlerts > 0 ? 'نیازمند بررسی' : 'بدون هشدار',
        up: data.kpis.securityAlerts === 0,
      },
      cta: 'بررسی ←',
      onClick: () => navigate('/panel/security'),
    },
  ];

  const resourceBars = [
    { label: 'پردازنده (CPU)', pct: data.resources.cpuUsedPct, color: 'bg-panel-accent' },
    { label: 'حافظه (RAM)', pct: data.resources.memoryUsedPct, color: 'bg-[#a855f7]' },
    ...(data.resources.diskUsedPct !== null
      ? [{ label: 'دیسک', pct: data.resources.diskUsedPct, color: 'bg-[#34d399]' }]
      : []),
    ...(data.resources.bandwidthUsedPct !== null
      ? [{ label: 'پهنای باند', pct: data.resources.bandwidthUsedPct, color: 'bg-[#f59e0b]' }]
      : []),
  ];

  return (
    <div>
      {data.kpis.allServicesHealthy && (
        <div className="mb-6 flex justify-end">
          <div className="flex items-center gap-2 rounded-lg border border-panel-border-2 bg-panel-card px-3 py-2 text-[11.5px] font-bold text-[#34d399]">
            <span className="h-2 w-2 rounded-full bg-[#34d399]" />
            همه سامانه‌ها سالم
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-[13px] md:grid-cols-4">
        {kpis.map((k) => (
          <PanelStatCard
            key={k.label}
            label={k.label}
            value={k.value}
            trend={k.trend}
            onClick={k.onClick}
            footer={
              <div className="mt-1 flex items-center justify-between">
                <span />
                <span className={`text-[10px] ${panelLink}`}>{k.cta}</span>
              </div>
            }
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <PanelCard
          title="سلامت سرویس‌ها"
          actions={
            <button type="button" onClick={() => navigate('/panel/services')} className={`text-[11px] ${panelLink}`}>
              مدیریت سرویس‌ها ←
            </button>
          }
        >
          <ul className="space-y-2.5">
            {data.serviceHealth.map((s) => (
              <li key={s.name} className="flex items-center gap-2.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${s.enabled ? 'bg-[#34d399]' : 'bg-[#f87171]'}`} />
                <span className={`flex-1 ${panelMuted2}`}>{s.name}</span>
                {s.uptimePct !== null && (
                  <span className={panelMuted}>{faPercent(s.uptimePct)}</span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    s.enabled ? 'bg-[rgba(52,211,153,.16)] text-[#34d399]' : 'bg-[rgba(248,113,113,.16)] text-[#f87171]'
                  }`}
                >
                  {s.enabled ? 'سالم' : 'قطع'}
                </span>
              </li>
            ))}
          </ul>
        </PanelCard>

        <div className="flex flex-col gap-4">
          <PanelCard title="استفاده از منابع سرور">
            <div className="space-y-3 text-xs">
              {resourceBars.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between">
                    <span className={panelMuted2}>{r.label}</span>
                    <span className={`font-bold ${panelMuted}`}>{faPercent(r.pct)}</span>
                  </div>
                  <div className="h-2 rounded bg-panel-elevated">
                    <div className={`h-2 rounded ${r.color}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard title="رویدادهای اخیر">
            {data.recentEvents.length === 0 ? (
              <p className={`text-xs ${panelMuted}`}>رویدادی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recentEvents.map((e) => (
                  <li key={e.id} className="flex gap-2 text-[11px]">
                    <span
                      className={`mt-1.5 h-2 w-2 flex-none rounded-full ${EVENT_DOT[e.category] ?? 'bg-panel-muted'}`}
                    />
                    <div>
                      <div className={panelMuted2}>{e.text}</div>
                      <div className={`mt-0.5 ${panelMuted}`}>{formatJalaliDateTime(e.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
