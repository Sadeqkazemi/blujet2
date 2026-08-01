import { useEffect, useState } from 'react';
import {
  fetchCompletedFlightsSummary,
  fetchFinanceDashboardStats,
  fetchSalesChart,
} from '../../api/reporting';
import { fetchCartable } from '../../api/cartable';
import type { CartableListResult } from '../../types/cartable';
import { faDigits, faMoney } from '../../lib/fa-format';
import type {
  CompletedFlightsSummary,
  FinanceDashboardStats,
  SalesChartPeriod,
  SalesGranularity,
} from '../../types/reporting';
import SalesBarChart from '../../components/SalesBarChart';
import {
  StaffCartableWidget,
  StaffFlightsSummaryGrid,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
  staffSegmentedControl,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { useIsMobile } from '../../hooks/useIsMobile';

const CHART_MODES: { key: SalesGranularity; label: string }[] = [
  { key: 'q3', label: '۳ ماهه' },
  { key: 'q6', label: '۶ ماهه' },
  { key: 'year', label: 'سالانه' },
];

function trendLabel(pct: number): string {
  if (pct === 0) return '۰٪';
  return `${pct > 0 ? '+' : '−'}${faDigits(Math.abs(pct))}٪`;
}

export default function FinanceDashboardPage() {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<FinanceDashboardStats | null>(null);
  const [granularity, setGranularity] = useState<SalesGranularity>('q6');
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinanceDashboardStats()
      .then(setStats)
      .catch(() => setError('خطا در دریافت آمار داشبورد.'));
    fetchCartable()
      .then(setCartable)
      .catch(() => setCartable(null));
  }, []);

  useEffect(() => {
    setPeriodKey(null);
  }, [granularity]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSalesChart({ granularity }),
      fetchCompletedFlightsSummary({ granularity, periodKey: periodKey ?? undefined }),
    ])
      .then(([chartData, flightsData]) => {
        if (cancelled) return;
        setPeriods(chartData);
        setFlights(flightsData);
      })
      .catch(() => {
        if (!cancelled) setError('خطا در دریافت نمودار فروش.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [granularity, periodKey]);

  const channelSums = {
    system: periods.reduce((s, p) => s + Number(p.systemIrr), 0),
    charter: periods.reduce((s, p) => s + Number(p.charterIrr), 0),
    agency: periods.reduce((s, p) => s + Number(p.agencyIrr), 0),
  };

  return (
    <div data-testid="finance-dashboard">
      <StaffPanelPageHeader title="داشبورد" subtitle="نمای کلی فروش و کارهای در انتظار اقدام" />

      {error && (
        <p style={{ marginBottom: 16, fontSize: 13, color: STAFF_PANEL.danger }}>{error}</p>
      )}

      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 13,
            marginBottom: 24,
          }}
        >
          <StaffKpiCard
            label="آژانس فعال"
            value={faDigits(stats.activeAgencies)}
            trend={trendLabel(stats.activeAgenciesTrendPct)}
            trendUp={stats.activeAgenciesTrendPct >= 0}
            iconBg={STAFF_PANEL.accentSoft}
            iconColor={STAFF_PANEL.accent}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 21h18M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M19 21V10a1 1 0 0 0-1-1h-3" />
              </svg>
            }
          />
          <StaffKpiCard
            label="مسافر این ماه"
            value={faDigits(stats.passengersThisMonth)}
            trend={trendLabel(stats.passengersTrendPct)}
            trendUp={stats.passengersTrendPct >= 0}
            iconBg="rgba(168,85,247,0.16)"
            iconColor={STAFF_PANEL.purple}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
            }
          />
          <StaffKpiCard
            label="بلیط فروخته‌شده"
            value={faDigits(stats.ticketsSoldThisMonth)}
            trend={trendLabel(stats.ticketsTrendPct)}
            trendUp={stats.ticketsTrendPct >= 0}
            iconBg="rgba(16,185,129,0.16)"
            iconColor={STAFF_PANEL.success}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
                <path d="M14 7v10" />
              </svg>
            }
          />
          <StaffKpiCard
            label="درآمد (تومان)"
            value={faMoney(stats.revenueThisMonthIrr)}
            trend={trendLabel(stats.revenueTrendPct)}
            trendUp={stats.revenueTrendPct >= 0}
            iconBg="rgba(245,158,11,0.16)"
            iconColor={STAFF_PANEL.warning}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18" />
              </svg>
            }
          />
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.7fr 1fr',
          gap: 15,
          alignItems: 'start',
        }}
      >
        <StaffPanelCard
          title="نمودار فروش"
          subtitle="به تفکیک کانال · تومان"
          headerAction={
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                borderRadius: 10,
                border: `1px solid ${STAFF_PANEL.inputBorder}`,
                background: STAFF_PANEL.inputBg,
              }}
            >
              {CHART_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setGranularity(m.key)}
                  style={staffSegmentedControl(granularity === m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {(
              [
                ['سیستمی', channelSums.system, '#1668c4'],
                ['چارتر', channelSums.charter, '#a855f7'],
                ['آژانس', channelSums.agency, '#059669'],
              ] as const
            ).map(([label, sum, color]) => (
              <div
                key={label}
                style={{
                  background: STAFF_PANEL.inputBg,
                  border: `1px solid ${STAFF_PANEL.inputBorder}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: STAFF_PANEL.textMuted, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                  {label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color }}>{faMoney(sum)}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: STAFF_PANEL.textMuted }}>
              در حال بارگذاری…
            </p>
          ) : (
            <SalesBarChart dark periods={periods} selectedPeriodKey={periodKey} onSelectPeriod={setPeriodKey} />
          )}

          {flights && (
            <StaffFlightsSummaryGrid
              flightCount={flights.flightCount}
              totalSeats={flights.totalSeats}
              soldSeats={flights.soldSeats}
              unsoldSeats={flights.unsoldSeats}
            />
          )}
        </StaffPanelCard>

        {cartable && <StaffCartableWidget cartable={cartable} />}
      </div>
    </div>
  );
}
