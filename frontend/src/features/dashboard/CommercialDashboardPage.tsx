import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCartable } from '../../api/cartable';
import {
  fetchCommercialOverview,
  fetchLowSalesAlerts,
  fetchRevenueMix,
} from '../../api/reporting';
import type { CartableListResult } from '../../types/cartable';
import type { CommercialOverview, LowSalesAlert, RevenueMixResult } from '../../types/reporting';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import {
  StaffCartableWidget,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { useIsMobile } from '../../hooks/useIsMobile';

const MIX_COLORS = { SYSTEM: '#3b82f6', CHARTER: '#a855f7', AGENCY: '#34d399' };

function LowSalesBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  const a = alerts[0];
  return (
    <div
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: 14,
        padding: '13px 15px',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        flexWrap: 'wrap',
        marginBottom: 15,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(245,158,11,0.16)',
          color: STAFF_PANEL.warning,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        ⚠
      </span>
      <div style={{ lineHeight: 1.6, minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fbbf24' }}>
          هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز
        </div>
        <div style={{ fontSize: 11.5, color: '#cdd7e5', marginTop: 4 }}>
          پرواز <span dir="ltr">{a.flightNo}</span> {a.originCode} ← {a.destCode} (
          {formatJalaliDateTime(a.departureAt).split(' ')[0]}) تنها {faDigits(a.soldSeats)} از{' '}
          {faDigits(a.capacity)} صندلی فروخته شده است.
        </div>
      </div>
    </div>
  );
}

function ChannelSummary({ mix }: { mix: RevenueMixResult }) {
  const total = mix.totalIrr || 1;
  const sysPct = mix.channels.find((c) => c.channel === 'SYSTEM')?.pct ?? 0;
  const chPct = mix.channels.find((c) => c.channel === 'CHARTER')?.pct ?? 0;
  const agPct = mix.channels.find((c) => c.channel === 'AGENCY')?.pct ?? 0;

  return (
    <StaffPanelCard
      title="گزارش مالی"
      subtitle="خلاصه فروش سال جاری — جزئیات و فیلترها در صفحه مالی"
      headerAction={
        <Link
          to="/panel/finance"
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: STAFF_PANEL.link,
            background: STAFF_PANEL.accentSoft,
            border: '1px solid rgba(59,130,246,0.3)',
            padding: '7px 12px',
            borderRadius: 9,
            textDecoration: 'none',
          }}
        >
          مشاهده جزئیات ←
        </Link>
      }
    >
      <div
        style={{
          display: 'flex',
          height: 16,
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 7,
          background: STAFF_PANEL.inputBg,
        }}
      >
        <div style={{ width: `${sysPct}%`, background: MIX_COLORS.SYSTEM }} />
        <div style={{ width: `${chPct}%`, background: MIX_COLORS.CHARTER }} />
        <div style={{ width: `${agPct}%`, background: MIX_COLORS.AGENCY }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, marginBottom: 13 }}>
        {(
          [
            ['سیستمی', sysPct, MIX_COLORS.SYSTEM],
            ['چارتر', chPct, MIX_COLORS.CHARTER],
            ['آژانس', agPct, MIX_COLORS.AGENCY],
          ] as const
        ).map(([label, pct, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: STAFF_PANEL.navMuted }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
            {label} {faPercent(pct)}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <div style={{ background: STAFF_PANEL.inputBg, border: `1px solid ${STAFF_PANEL.inputBorder}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10.5, color: STAFF_PANEL.textMuted, marginBottom: 5 }}>جمع فروش سال</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{faMoney(total)}</div>
        </div>
        {mix.channels.map((c) => (
          <div
            key={c.channel}
            style={{ background: STAFF_PANEL.inputBg, border: `1px solid ${STAFF_PANEL.inputBorder}`, borderRadius: 12, padding: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: STAFF_PANEL.textMuted, marginBottom: 5 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: MIX_COLORS[c.channel as keyof typeof MIX_COLORS],
                }}
              />
              {c.labelFa.replace('فروش ', '')}
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: MIX_COLORS[c.channel as keyof typeof MIX_COLORS],
              }}
            >
              {faMoney(c.amountIrr)}
            </div>
          </div>
        ))}
      </div>
    </StaffPanelCard>
  );
}

export default function CommercialDashboardPage() {
  const isMobile = useIsMobile();
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCommercialOverview(),
      fetchRevenueMix({ granularity: 'year' }),
      fetchLowSalesAlerts(),
      fetchCartable(),
    ])
      .then(([ov, mixData, alertData, cartableData]) => {
        setOverview(ov);
        setMix(mixData);
        setAlerts(alertData);
        setCartable(cartableData);
      })
      .catch(() => setError('خطا در دریافت اطلاعات داشبورد.'));
  }, []);

  if (error) return <p style={{ fontSize: 13, color: STAFF_PANEL.danger }}>{error}</p>;
  if (!overview || !mix || !cartable) {
    return <p style={{ fontSize: 13, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>;
  }

  return (
    <div data-testid="commercial-dashboard">
      <StaffPanelPageHeader title="داشبورد" subtitle="نمای کلی فروش و کارهای در انتظار اقدام" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 13,
          marginBottom: 24,
        }}
      >
        <StaffKpiCard label="آژانس فعال" value={faDigits(overview.activeAgencies)} iconBg={STAFF_PANEL.accentSoft} iconColor={STAFF_PANEL.accent} icon="●" />
        <StaffKpiCard label="مسافر این ماه" value={faDigits(overview.passengersThisMonth)} iconBg="rgba(168,85,247,0.16)" iconColor={STAFF_PANEL.purple} icon="●" />
        <StaffKpiCard label="درخواست همکاری آژانس‌ها" value={faDigits(overview.pendingAgencyRequests)} iconBg="rgba(16,185,129,0.16)" iconColor={STAFF_PANEL.success} icon="●" />
      </div>

      <LowSalesBanner alerts={alerts} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.7fr 1fr',
          gap: 15,
          alignItems: 'start',
        }}
      >
        <ChannelSummary mix={mix} />
        <StaffCartableWidget cartable={cartable} />
      </div>
    </div>
  );
}
