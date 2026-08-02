import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import StatTile from '../../components/StatTile';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';

export default function DashboardPage() {
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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-panel-ink">داشبورد</h1>
        <p className="mt-1 text-sm text-panel-muted">نمای کلی فروش و عملکرد پروازها</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {cartable && (
        <section className="mb-6 rounded-xl border border-white/10 bg-panel-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-panel-ink">
              کارتابل
              {cartable.totalOpen > 0 && (
                <span className="mr-2 rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-bold text-danger">
                  {faDigits(cartable.totalOpen)}
                </span>
              )}
            </h2>
            <Link to="/panel/cartable" className="text-xs font-bold text-accent">
              مشاهده‌ی همه‌ی کارها ←
            </Link>
          </div>
          {cartable.tasks.length === 0 ? (
            <p className="py-2 text-center text-xs text-panel-muted">کارتابل خالی است ✓</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {cartable.tasks.slice(0, 3).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="font-bold text-panel-ink">{t.title}</span>
                  <span className="text-[10px] text-panel-muted">
                    {t.senderLabelFa ?? t.sender?.fullName ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="کل درآمد" value={`${faMoney(kpis.revenueIrr)} تومان`} tone="good" />
          <StatTile
            label="سود خالص"
            value={`${faMoney(kpis.profitIrr)} تومان`}
            sublabel={`حاشیه ${faPercent(kpis.marginPct)}`}
            tone="accent"
          />
          <StatTile label="هزینه عملیاتی" value={`${faMoney(kpis.operatingCostIrr)} تومان`} tone="warning" />
          <StatTile
            label="مطالبات معوق آژانس‌ها"
            value={`${faMoney(kpis.agencyDebtIrr)} تومان`}
            sublabel={`${faDigits(kpis.agencyDebtCount)} آژانس`}
            tone="critical"
          />
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-panel-surface p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-panel-ink">نمودار فروش</h2>
          <SalesChartControls
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
          <p className="py-10 text-center text-sm text-panel-muted">شماره پرواز را وارد کنید.</p>
        ) : loading ? (
          <p className="py-10 text-center text-sm text-panel-muted">در حال بارگذاری…</p>
        ) : (
          <SalesBarChart
            periods={periods}
            selectedPeriodKey={chart.periodKey}
            onSelectPeriod={chart.setPeriodKey}
          />
        )}
      </div>

      {flights && (
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-panel-surface p-5 md:grid-cols-4">
          <div>
            <div className="font-num text-lg font-black text-panel-ink">{faDigits(flights.flightCount)}</div>
            <div className="text-xs text-panel-muted">پروازهای انجام‌شده</div>
          </div>
          <div>
            <div className="font-num text-lg font-black text-panel-ink">{faDigits(flights.totalSeats)}</div>
            <div className="text-xs text-panel-muted">مجموع صندلی</div>
          </div>
          <div>
            <div className="font-num text-lg font-black text-[#059669]">{faDigits(flights.soldSeats)}</div>
            <div className="text-xs text-panel-muted">صندلی فروخته‌شده</div>
          </div>
          <div>
            <div className="font-num text-lg font-black text-danger">{faDigits(flights.unsoldSeats)}</div>
            <div className="text-xs text-panel-muted">صندلی فروش‌نرفته</div>
          </div>
        </div>
      )}
    </div>
  );
}
