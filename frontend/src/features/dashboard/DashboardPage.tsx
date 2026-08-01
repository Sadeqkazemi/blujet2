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
import PanelAlert from '../panel/PanelAlert';
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
    <div>
      {error && <PanelAlert>{error}</PanelAlert>}

      {cartable && (
        <section className="mb-6 rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              کارتابل
              {cartable.totalOpen > 0 && (
                <span className="mr-2 rounded-full bg-[rgba(248,113,113,.16)] px-2.5 py-0.5 text-[11px] font-bold text-[#f87171]">
                  {faDigits(cartable.totalOpen)}
                </span>
              )}
            </h2>
            <Link to="/panel/cartable" className="text-xs font-bold text-[#60a5fa]">
              مشاهده‌ی همه‌ی کارها ←
            </Link>
          </div>
          {cartable.tasks.length === 0 ? (
            <p className="py-2 text-center text-xs text-[#6b7b94]">کارتابل خالی است ✓</p>
          ) : (
            <ul className="divide-y divide-[#1f2a3d]">
              {cartable.tasks.slice(0, 3).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="font-bold text-[#e7ecf3]">{t.title}</span>
                  <span className="text-[10px] text-[#6b7b94]">
                    {t.senderLabelFa ?? t.sender?.fullName ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {kpis && (
        <div className="mb-6 grid grid-cols-2 gap-[13px] md:grid-cols-4">
          <StatTile label="کل درآمد" value={`${faMoney(kpis.revenueIrr)} تومان`} tone="good" variant="panel" />
          <StatTile
            label="سود خالص"
            value={`${faMoney(kpis.profitIrr)} تومان`}
            sublabel={`حاشیه ${faPercent(kpis.marginPct)}`}
            tone="accent"
            variant="panel"
          />
          <StatTile
            label="هزینه عملیاتی"
            value={`${faMoney(kpis.operatingCostIrr)} تومان`}
            tone="warning"
            variant="panel"
          />
          <StatTile
            label="مطالبات معوق آژانس‌ها"
            value={`${faMoney(kpis.agencyDebtIrr)} تومان`}
            sublabel={`${faDigits(kpis.agencyDebtCount)} آژانس`}
            tone="critical"
            variant="panel"
          />
        </div>
      )}

      <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-white">نمودار فروش</h2>
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
            variant="panel"
          />
        </div>

        {!chart.isQueryReady ? (
          <p className="py-10 text-center text-sm text-[#6b7b94]">شماره پرواز را وارد کنید.</p>
        ) : loading ? (
          <p className="py-10 text-center text-sm text-[#6b7b94]">در حال بارگذاری…</p>
        ) : (
          <SalesBarChart
            periods={periods}
            selectedPeriodKey={chart.periodKey}
            onSelectPeriod={chart.setPeriodKey}
            variant="panel"
          />
        )}
      </div>

      {flights && (
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-5 md:grid-cols-4">
          <div>
            <div className="text-lg font-black text-white">{faDigits(flights.flightCount)}</div>
            <div className="text-xs text-[#6b7b94]">پروازهای انجام‌شده</div>
          </div>
          <div>
            <div className="text-lg font-black text-white">{faDigits(flights.totalSeats)}</div>
            <div className="text-xs text-[#6b7b94]">مجموع صندلی</div>
          </div>
          <div>
            <div className="text-lg font-black text-[#34d399]">{faDigits(flights.soldSeats)}</div>
            <div className="text-xs text-[#6b7b94]">صندلی فروخته‌شده</div>
          </div>
          <div>
            <div className="text-lg font-black text-[#f87171]">{faDigits(flights.unsoldSeats)}</div>
            <div className="text-xs text-[#6b7b94]">صندلی فروش‌نرفته</div>
          </div>
        </div>
      )}
    </div>
  );
}
