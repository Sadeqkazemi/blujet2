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
import PanelAlert from '../panel/PanelAlert';
import PanelCard from '../panel/PanelCard';
import PanelStatCard from '../panel/PanelStatCard';
import { panelElevatedPadded, panelLink, panelMuted, panelMuted2, panelTitle } from '../panel/panel-theme';

const MIX_COLORS = { SYSTEM: '#1668c4', CHARTER: '#a855f7', AGENCY: '#059669' };

function LowSalesBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  const a = alerts[0];
  return (
    <div className="mb-6 flex items-center gap-3 rounded-[14px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.08)] p-4">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[rgba(245,158,11,.16)] text-[#f59e0b]">
        ⚠
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">
        <div className="text-xs font-extrabold text-[#fbbf24]">
          هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز
        </div>
        <div className={`mt-0.5 text-[11.5px] ${panelMuted2}`}>
          پرواز{' '}
          <span className="ltr font-mono">{a.flightNo}</span> {a.originCode} ← {a.destCode} (
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
    <PanelCard
      title="گزارش مالی"
      subtitle="خلاصه فروش سال جاری — جزئیات و فیلترها در صفحه مالی"
      actions={
        <Link
          to="/panel/finance"
          className="rounded-lg border border-[rgba(59,130,246,.3)] bg-[rgba(59,130,246,.12)] px-3 py-1.5 text-[11px] font-bold text-panel-link"
        >
          مشاهده جزئیات ←
        </Link>
      }
    >
      <div className="mb-2 flex h-4 overflow-hidden rounded-lg bg-panel-elevated">
        <div style={{ width: `${sysPct}%`, background: MIX_COLORS.SYSTEM }} />
        <div style={{ width: `${chPct}%`, background: MIX_COLORS.CHARTER }} />
        <div style={{ width: `${agPct}%`, background: MIX_COLORS.AGENCY }} />
      </div>
      <div className={`mb-4 flex flex-wrap gap-3 text-[10px] ${panelMuted}`}>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.SYSTEM }} />
          سیستمی {faPercent(sysPct)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.CHARTER }} />
          چارتر {faPercent(chPct)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.AGENCY }} />
          آژانس {faPercent(agPct)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className={panelElevatedPadded}>
          <div className={`text-[10.5px] ${panelMuted}`}>جمع فروش سال</div>
          <div className="mt-1 text-base font-black text-white">{faMoney(total)}</div>
        </div>
        {mix.channels.map((c) => (
          <div key={c.channel} className={panelElevatedPadded}>
            <div className={`mb-1 flex items-center gap-1.5 text-[10.5px] ${panelMuted}`}>
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: MIX_COLORS[c.channel as keyof typeof MIX_COLORS] }}
              />
              فروش {c.labelFa.replace('فروش ', '')}
            </div>
            <div
              className="text-sm font-extrabold"
              style={{ color: MIX_COLORS[c.channel as keyof typeof MIX_COLORS] }}
            >
              {faMoney(c.amountIrr)}
            </div>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

function CartableWidget({ cartable }: { cartable: CartableListResult }) {
  return (
    <PanelCard padding={false} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
        <span className={panelTitle}>کارتابل</span>
        {cartable.totalOpen > 0 && (
          <span className="rounded-full bg-[#f87171] px-2 py-0.5 text-[10px] font-bold text-white">
            {faDigits(cartable.totalOpen)}
          </span>
        )}
      </div>
      <div className="p-2">
        {cartable.tasks.length === 0 ? (
          <p className={`py-4 text-center text-xs ${panelMuted}`}>کارتابل خالی است ✓</p>
        ) : (
          cartable.tasks.slice(0, 4).map((t) => (
            <div key={t.id} className="rounded-lg px-2.5 py-2.5 text-xs">
              <div className="font-bold text-white">{t.title}</div>
              <div className={`mt-0.5 text-[10px] ${panelMuted}`}>
                {t.senderLabelFa ?? t.sender?.fullName ?? ''}
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        to="/panel/cartable"
        className={`block border-t border-panel-border py-3 text-center text-[11.5px] ${panelLink}`}
      >
        مشاهده‌ی همه‌ی کارها ←
      </Link>
    </PanelCard>
  );
}

export default function CommercialDashboardPage() {
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

  if (error) return <PanelAlert className="mb-0">{error}</PanelAlert>;
  if (!overview || !mix || !cartable) {
    return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-[13px] md:grid-cols-3">
        <PanelStatCard
          label="آژانس فعال"
          value={faDigits(overview.activeAgencies)}
          iconClass="bg-[rgba(59,130,246,.16)] text-panel-accent"
          icon={<span className="text-lg">●</span>}
        />
        <PanelStatCard
          label="مسافر این ماه"
          value={faDigits(overview.passengersThisMonth)}
          iconClass="bg-[rgba(168,85,247,.16)] text-[#a855f7]"
          icon={<span className="text-lg">●</span>}
        />
        <PanelStatCard
          label="درخواست همکاری آژانس‌ها"
          value={faDigits(overview.pendingAgencyRequests)}
          iconClass="bg-[rgba(52,211,153,.16)] text-[#34d399]"
          icon={<span className="text-lg">●</span>}
        />
      </div>

      <LowSalesBanner alerts={alerts} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <ChannelSummary mix={mix} />
        <CartableWidget cartable={cartable} />
      </div>
    </div>
  );
}
