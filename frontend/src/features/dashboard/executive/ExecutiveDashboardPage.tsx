import { useEffect, useState } from 'react';
import { fetchCartable } from '../../../api/cartable';
import {
  fetchExecutiveDashboardStats,
  fetchLowSalesAlerts,
  fetchRevenueMix,
} from '../../../api/reporting';
import type { CartableListResult } from '../../../types/cartable';
import type { FinanceDashboardStats, LowSalesAlert, RevenueMixResult } from '../../../types/reporting';
import { faDigits, faMoney } from '../../../lib/fa-format';
import PanelAlert from '../../panel/PanelAlert';
import PanelStatCard from '../../panel/PanelStatCard';
import { panelMuted } from '../../panel/panel-theme';
import {
  ExecutiveCartablePanel,
  LowSalesAlertBanner,
  RevenueMixSummary,
  trendLabel,
} from './ExecutiveDashboardWidgets';

/** CEO / Board Chair / Senior Manager dashboard — matches design-reference-v2/پنل مدیر عامل.dc.html */
export default function ExecutiveDashboardPage() {
  const [stats, setStats] = useState<FinanceDashboardStats | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchExecutiveDashboardStats(),
      fetchRevenueMix({ granularity: 'year' }),
      fetchLowSalesAlerts(),
      fetchCartable(),
    ])
      .then(([statsData, mixData, alertData, cartableData]) => {
        setStats(statsData);
        setMix(mixData);
        setAlerts(alertData);
        setCartable(cartableData);
      })
      .catch(() => setError('خطا در دریافت اطلاعات داشبورد.'));
  }, []);

  if (error) return <PanelAlert className="mb-0">{error}</PanelAlert>;
  if (!stats || !mix || !cartable) {
    return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-[13px] md:grid-cols-4">
        <PanelStatCard
          label="آژانس فعال"
          value={faDigits(stats.activeAgencies)}
          trend={{ text: trendLabel(stats.activeAgenciesTrendPct), up: stats.activeAgenciesTrendPct >= 0 }}
          iconClass="bg-[rgba(59,130,246,.16)] text-panel-accent"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 21h18M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M19 21V10a1 1 0 0 0-1-1h-3" />
            </svg>
          }
        />
        <PanelStatCard
          label="مسافر این ماه"
          value={faDigits(stats.passengersThisMonth)}
          trend={{ text: trendLabel(stats.passengersTrendPct), up: stats.passengersTrendPct >= 0 }}
          iconClass="bg-[rgba(168,85,247,.16)] text-[#a855f7]"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              <path d="M16 5a3.2 3.2 0 0 1 0 6.4" />
              <path d="M18 14.5c1.9.6 3.4 2.4 3.4 4.5" />
            </svg>
          }
        />
        <PanelStatCard
          label="بلیط فروخته‌شده"
          value={faDigits(stats.ticketsSoldThisMonth)}
          trend={{ text: trendLabel(stats.ticketsTrendPct), up: stats.ticketsTrendPct >= 0 }}
          iconClass="bg-[rgba(52,211,153,.16)] text-[#34d399]"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
              <path d="M14 7v10" />
            </svg>
          }
        />
        <PanelStatCard
          label="درآمد (تومان)"
          value={faMoney(stats.revenueThisMonthIrr)}
          trend={{ text: trendLabel(stats.revenueTrendPct), up: stats.revenueTrendPct >= 0 }}
          iconClass="bg-[rgba(245,158,11,.16)] text-[#f59e0b]"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" />
            </svg>
          }
        />
      </div>

      <LowSalesAlertBanner alerts={alerts} />

      <div className="grid grid-cols-1 items-start gap-[15px] lg:grid-cols-[1.7fr_1fr]">
        <RevenueMixSummary mix={mix} />
        <ExecutiveCartablePanel cartable={cartable} />
      </div>
    </div>
  );
}
