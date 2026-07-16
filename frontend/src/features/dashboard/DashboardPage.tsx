import { useEffect, useState } from 'react';
import { fetchCompletedFlightsSummary, fetchKpis, fetchSalesChart } from '../../api/reporting';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import type {
  CompletedFlightsSummary,
  KpiResult,
  SalesChartPeriod,
  SalesGranularity,
} from '../../types/reporting';
import SalesBarChart from '../../components/SalesBarChart';
import StatTile from '../../components/StatTile';

const IMPLEMENTED_MODES: { key: SalesGranularity; label: string }[] = [
  { key: 'q3', label: '۳ ماهه' },
  { key: 'q6', label: '۶ ماهه' },
  { key: 'year', label: 'سالانه' },
];

const PENDING_MODES: { key: SalesGranularity; label: string }[] = [
  { key: 'day', label: 'روزانه' },
  { key: 'month', label: 'ماهانه' },
  { key: 'flight', label: 'شماره پرواز' },
];

export default function DashboardPage() {
  const [granularity, setGranularity] = useState<SalesGranularity>('q6');
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeriodKey(null);
  }, [granularity]);

  useEffect(() => {
    if (!IMPLEMENTED_MODES.some((m) => m.key === granularity)) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSalesChart({ granularity }),
      fetchKpis({ granularity, periodKey: periodKey ?? undefined }),
      fetchCompletedFlightsSummary({ granularity, periodKey: periodKey ?? undefined }),
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
  }, [granularity, periodKey]);

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

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">نمودار فروش</h2>
          <div className="flex flex-wrap gap-1.5">
            {IMPLEMENTED_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setGranularity(m.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  granularity === m.key ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
                }`}
              >
                {m.label}
              </button>
            ))}
            {PENDING_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setGranularity(m.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  granularity === m.key ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {!IMPLEMENTED_MODES.some((m) => m.key === granularity) ? (
          <p className="py-10 text-center text-sm text-muted">این حالت نمایش در فاز بعدی تکمیل می‌شود.</p>
        ) : loading ? (
          <p className="py-10 text-center text-sm text-muted">در حال بارگذاری…</p>
        ) : (
          <SalesBarChart periods={periods} selectedPeriodKey={periodKey} onSelectPeriod={setPeriodKey} />
        )}
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
