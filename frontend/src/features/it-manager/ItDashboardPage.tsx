import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchItDashboard } from '../../api/it-manager';
import { faDigits, faPercent } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { StaffPanelCard, StaffPanelPageHeader } from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { ItDashboardData } from '../../types/it-manager';

const EVENT_DOT: Record<string, string> = {
  SECURITY: STAFF_PANEL.warning,
  ACCOUNT: STAFF_PANEL.accent,
  SYSTEM: STAFF_PANEL.success,
  ACCESS: STAFF_PANEL.purple,
};

const RESOURCE_COLORS = [STAFF_PANEL.accent, STAFF_PANEL.purple, STAFF_PANEL.success, STAFF_PANEL.warning];

export default function ItDashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState<ItDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItDashboard()
      .then(setData)
      .catch(() => setError('خطا در دریافت داشبورد فنی.'));
  }, []);

  if (error) return <p style={{ fontSize: 13, color: STAFF_PANEL.danger }}>{error}</p>;
  if (!data) return <p style={{ fontSize: 13, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>;

  const kpis = [
    {
      label: 'سرویس فعال',
      value: `${data.kpis.servicesUp}/${data.kpis.servicesTotal}`,
      trend: 'پایدار',
      trendColor: STAFF_PANEL.success,
      cta: 'مدیریت ←',
      onClick: () => navigate('/panel/services'),
    },
    {
      label: 'آپ‌تایم ۳۰ روز',
      value: faPercent(data.kpis.uptime30dPct),
      trend: '+۰٫۰۲',
      trendColor: STAFF_PANEL.success,
      cta: 'لاگ‌ها ←',
      onClick: () => navigate('/panel/logs'),
    },
    {
      label: 'کاربر فعال سامانه',
      value: faDigits(data.kpis.activeSessions),
      trend: '+۳',
      trendColor: STAFF_PANEL.success,
      cta: 'کاربران ←',
      onClick: () => navigate('/panel/users'),
    },
    {
      label: 'هشدار امنیتی باز',
      value: faDigits(data.kpis.securityAlerts),
      trend: data.kpis.securityAlerts > 0 ? 'نیازمند بررسی' : 'بدون هشدار',
      trendColor: data.kpis.securityAlerts > 0 ? STAFF_PANEL.warning : STAFF_PANEL.success,
      cta: 'بررسی ←',
      onClick: () => navigate('/panel/security'),
    },
  ];

  const resourceBars = [
    { label: 'پردازنده (CPU)', pct: data.resources.cpuUsedPct },
    { label: 'حافظه (RAM)', pct: data.resources.memoryUsedPct },
    ...(data.resources.diskUsedPct !== null ? [{ label: 'دیسک', pct: data.resources.diskUsedPct }] : []),
    ...(data.resources.bandwidthUsedPct !== null ? [{ label: 'پهنای باند', pct: data.resources.bandwidthUsedPct }] : []),
  ];

  return (
    <div data-testid="it-dashboard">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <StaffPanelPageHeader title="داشبورد فنی" subtitle="نمای کلی سلامت زیرساخت و سرویس‌های blujet" />
        {data.kpis.allServicesHealthy && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 10,
              border: `1px solid ${STAFF_PANEL.inputBorder}`,
              background: STAFF_PANEL.cardBg,
              padding: '8px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              color: STAFF_PANEL.success,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAFF_PANEL.success }} />
            همه سامانه‌ها سالم
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 13,
          marginBottom: 24,
        }}
      >
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            style={{
              background: STAFF_PANEL.cardBg,
              border: `1px solid ${STAFF_PANEL.cardBorder}`,
              borderRadius: 14,
              padding: 14,
              textAlign: 'right',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: STAFF_PANEL.text,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: k.trendColor, marginBottom: 8 }}>{k.trend}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{k.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>{k.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: STAFF_PANEL.link }}>{k.cta}</span>
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr',
          gap: 15,
          alignItems: 'start',
        }}
      >
        <StaffPanelCard
          title="سلامت سرویس‌ها"
          headerAction={
            <button
              type="button"
              onClick={() => navigate('/panel/services')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 11,
                fontWeight: 700,
                color: STAFF_PANEL.link,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              مدیریت سرویس‌ها ←
            </button>
          }
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.serviceHealth.map((s) => (
              <li key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: s.enabled ? STAFF_PANEL.success : STAFF_PANEL.danger,
                    flex: 'none',
                  }}
                />
                <span style={{ flex: 1, color: STAFF_PANEL.text }}>{s.name}</span>
                {s.uptimePct !== null && (
                  <span style={{ color: STAFF_PANEL.textMuted }}>{faPercent(s.uptimePct)}</span>
                )}
                <span
                  style={{
                    borderRadius: 14,
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: s.enabled ? STAFF_PANEL.success : STAFF_PANEL.danger,
                    background: s.enabled ? 'rgba(16,185,129,0.14)' : 'rgba(248,113,113,0.14)',
                  }}
                >
                  {s.enabled ? 'سالم' : 'قطع'}
                </span>
              </li>
            ))}
          </ul>
        </StaffPanelCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <StaffPanelCard title="استفاده از منابع سرور">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resourceBars.map((r, i) => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: STAFF_PANEL.text }}>{r.label}</span>
                    <span style={{ fontWeight: 700, color: STAFF_PANEL.textMuted }}>{faPercent(r.pct)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: STAFF_PANEL.inputBg }}>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 6,
                        width: `${Math.min(100, r.pct)}%`,
                        background: RESOURCE_COLORS[i % RESOURCE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </StaffPanelCard>

          <StaffPanelCard title="رویدادهای اخیر">
            {data.recentEvents.length === 0 ? (
              <p style={{ fontSize: 12, color: STAFF_PANEL.textMuted, margin: 0 }}>رویدادی ثبت نشده است.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.recentEvents.map((e) => (
                  <li key={e.id} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span
                      style={{
                        marginTop: 6,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: EVENT_DOT[e.category] ?? STAFF_PANEL.textMuted,
                        flex: 'none',
                      }}
                    />
                    <div>
                      <div style={{ color: STAFF_PANEL.text }}>{e.text}</div>
                      <div style={{ marginTop: 2, color: STAFF_PANEL.textMuted }}>{formatJalaliDateTime(e.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </StaffPanelCard>
        </div>
      </div>
    </div>
  );
}
