import { useEffect, useState } from 'react';
import { fetchCompletedFlightsSummary, fetchKpis, fetchSalesChart } from '../../api/reporting';
import { fetchCartable } from '../../api/cartable';
import type { CartableListResult } from '../../types/cartable';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import type {
  CompletedFlightsSummary,
  KpiResult,
  SalesChartPeriod,
} from '../../types/reporting';
import SalesBarChart from '../../components/SalesBarChart';
import SalesChartControls from '../../components/SalesChartControls';
import {
  StaffCartableWidget,
  StaffFlightsSummaryGrid,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';

const KPI_ICONS = {
  revenue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18" />
      <path d="M7 14l3.5-3.5 3 3L20 7" />
    </svg>
  ),
  profit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  cost: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  debt: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  ),
};

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const chart = useSalesChartQuery({ includeFlightMode: true });
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);

  useEffect(() => {
    fetchCartable()
      .then(setCartable)
      .catch(() => setCartable(null));
  }, []);

  useEffect(() => {
    if (!chart.isQueryReady) {
      setPeriods([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSalesChart(chart.query),
      fetchKpis(chart.query),
      fetchCompletedFlightsSummary(chart.query),
    ])
      .then(([chartData, kpiData, flightsData]) => {
        if (cancelled) return;
        setPeriods(chartData);
        setKpis(kpiData);
        setFlights(flightsData);
      })
      .catch(() => {
        if (!cancelled) setError('خطا در دریافت اطلاعات داشبورد.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chart.query, chart.isQueryReady]);

  return (
    <div data-testid="staff-dashboard">
      <StaffPanelPageHeader title="داشبورد" subtitle="نمای کلی فروش و عملکرد پروازها" />

      {error && (
        <p style={{ marginBottom: 16, fontSize: 13, color: STAFF_PANEL.danger }}>{error}</p>
      )}

      {cartable && cartable.totalOpen > 0 && (
        <div style={{ marginBottom: 15 }}>
          <StaffCartableWidget cartable={cartable} limit={3} />
        </div>
      )}

      {kpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 13,
            marginBottom: 24,
          }}
        >
          <StaffKpiCard
            label="کل درآمد"
            value={`${faMoney(kpis.revenueIrr)} تومان`}
            icon={KPI_ICONS.revenue}
            iconBg="rgba(16,185,129,0.16)"
            iconColor={STAFF_PANEL.success}
          />
          <StaffKpiCard
            label="سود خالص"
            value={`${faMoney(kpis.profitIrr)} تومان`}
            sublabel={`حاشیه ${faPercent(kpis.marginPct)}`}
            icon={KPI_ICONS.profit}
            iconBg={STAFF_PANEL.accentSoft}
            iconColor={STAFF_PANEL.accent}
          />
          <StaffKpiCard
            label="هزینه عملیاتی"
            value={`${faMoney(kpis.operatingCostIrr)} تومان`}
            icon={KPI_ICONS.cost}
            iconBg="rgba(245,158,11,0.16)"
            iconColor={STAFF_PANEL.warning}
          />
          <StaffKpiCard
            label="مطالبات معوق آژانس‌ها"
            value={`${faMoney(kpis.agencyDebtIrr)} تومان`}
            sublabel={`${faDigits(kpis.agencyDebtCount)} آژانس`}
            icon={KPI_ICONS.debt}
            iconBg="rgba(248,113,113,0.16)"
            iconColor={STAFF_PANEL.danger}
          />
        </div>
      )}

      <StaffPanelCard title="نمودار فروش">
        <div style={{ marginBottom: 16 }}>
          <SalesChartControls
            dark
            modes={chart.modes}
            granularity={chart.granularity}
            onGranularityChange={chart.setGranularity}
            selectedDate={chart.selectedDate}
            onSelectedDateChange={chart.setSelectedDate}
            selectedMonthStart={chart.selectedMonthStart}
            onSelectedMonthStartChange={chart.setSelectedMonthStart}
            flightNo={chart.flightNo}
            onFlightNoChange={chart.setFlightNo}
            onApplyFlightNo={chart.applyFlightNo}
          />
        </div>

        {!chart.isQueryReady ? (
          <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: STAFF_PANEL.textMuted }}>
            شماره پرواز را وارد کنید.
          </p>
        ) : loading ? (
          <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: STAFF_PANEL.textMuted }}>
            در حال بارگذاری…
          </p>
        ) : (
          <SalesBarChart
            dark
            periods={periods}
            selectedPeriodKey={chart.periodKey}
            onSelectPeriod={chart.setPeriodKey}
          />
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
    </div>
  );
}
