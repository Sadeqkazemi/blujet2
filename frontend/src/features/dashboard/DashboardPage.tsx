import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchCompletedFlightsSummary,
  fetchKpis,
  fetchLowSalesAlerts,
  fetchSalesChart,
} from '../../api/reporting';
import { fetchCartable } from '../../api/cartable';
import type { CartableListResult } from '../../types/cartable';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate } from '../../lib/jalali';
import type {
  CompletedFlightsSummary,
  KpiResult,
  LowSalesAlert,
  SalesChartPeriod,
} from '../../types/reporting';
import SalesBarChart from '../../components/SalesBarChart';
import SalesChartControls from '../../components/SalesChartControls';
import StatTile from '../../components/StatTile';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';

function LowSalesBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-3">
      {alerts.map((a) => (
        <div
          key={`${a.flightNo}-${a.departureAt}`}
          className="flex items-center gap-3 rounded-xl border border-[#f59e0b59] bg-[#f59e0b14] p-4"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f59e0b29] text-[#b45309]">
            ⚠
          </span>
          <div className="min-w-0 flex-1 text-xs leading-6">
            <div className="font-extrabold text-[#b45309]">هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز</div>
            <div className="text-text-2">
              پرواز <span className="ltr font-num inline-block">{a.flightNo}</span> {a.originCode} ←{' '}
              {a.destCode} ({formatJalaliDate(a.departureAt)}) تنها {faDigits(a.soldSeats)} از{' '}
              {faDigits(a.capacity)} صندلی فروخته شده است. این هشدار برای مدیر عامل، مدیر ارشد، مدیر مالی و
              مدیر بازرگانی ارسال شد.
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CartableWidget({ cartable }: { cartable: CartableListResult }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/15 text-danger">
          🔔
        </span>
        <h2 className="flex-1 text-sm font-extrabold text-ink">کارتابل</h2>
        {cartable.totalOpen > 0 && (
          <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-extrabold text-white">
            {faDigits(cartable.totalOpen)}
          </span>
        )}
      </div>
      <div className="px-2 py-1">
        {cartable.tasks.length === 0 ? (
          <p className="px-3 py-5 text-center text-[11.5px] text-muted">کارتابل خالی است ✓</p>
        ) : (
          <ul>
            {cartable.tasks.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link
                  to="/panel/cartable"
                  className="flex items-start gap-2.5 rounded-[10px] px-2.5 py-2.5 hover:bg-body"
                >
                  <div className="min-w-0 leading-relaxed">
                    <div className="text-[11.5px] font-bold text-ink">{t.title}</div>
                    <div className="mt-0.5 text-[10.5px] text-muted">
                      {t.senderLabelFa ?? t.sender?.fullName ?? ''}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link
        to="/panel/cartable"
        className="block border-t border-border py-3 text-center text-[11.5px] font-bold text-accent"
      >
        مشاهده‌ی همه‌ی کارها ←
      </Link>
    </section>
  );
}

export default function DashboardPage() {
  const chart = useSalesChartQuery({ includeFlightMode: true });
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartable, setCartable] = useState<CartableListResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);

  useEffect(() => {
    fetchCartable()
      .then(setCartable)
      .catch(() => setCartable(null));
    fetchLowSalesAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
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
        <h1 className="text-xl font-black text-ink">داشبورد</h1>
        <p className="mt-1 text-sm text-muted">نمای کلی فروش و عملکرد پروازها</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

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

      <LowSalesBanner alerts={alerts} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">گزارش مالی</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                خلاصه فروش — جزئیات و فیلترها در صفحه مالی
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/panel/finance"
                className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent"
              >
                مشاهده جزئیات ←
              </Link>
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
          </div>

          {!chart.isQueryReady ? (
            <p className="py-10 text-center text-sm text-muted">شماره پرواز را وارد کنید.</p>
          ) : loading ? (
            <p className="py-10 text-center text-sm text-muted">در حال بارگذاری…</p>
          ) : (
            <SalesBarChart
              periods={periods}
              selectedPeriodKey={chart.periodKey}
              onSelectPeriod={chart.setPeriodKey}
            />
          )}
        </div>

        {cartable && <CartableWidget cartable={cartable} />}
      </div>

      {flights && (
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-white p-5 md:grid-cols-4">
          <div>
            <div className="font-num text-lg font-black text-ink">{faDigits(flights.flightCount)}</div>
            <div className="text-xs text-muted">پروازهای انجام‌شده</div>
          </div>
          <div>
            <div className="font-num text-lg font-black text-ink">{faDigits(flights.totalSeats)}</div>
            <div className="text-xs text-muted">مجموع صندلی</div>
          </div>
          <div>
            <div className="font-num text-lg font-black text-[#059669]">{faDigits(flights.soldSeats)}</div>
            <div className="text-xs text-muted">صندلی فروخته‌شده</div>
          </div>
          <div>
            <div className="font-num text-lg font-black text-danger">{faDigits(flights.unsoldSeats)}</div>
            <div className="text-xs text-muted">صندلی فروش‌نرفته</div>
          </div>
        </div>
      )}
    </div>
  );
}
