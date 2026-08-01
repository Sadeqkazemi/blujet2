import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import PanelAlert from '../panel/PanelAlert';
import PanelCard from '../panel/PanelCard';
import PanelStatCard from '../panel/PanelStatCard';
import {
  panelElevatedPadded,
  panelLink,
  panelMuted,
  panelSegmentBtn,
  panelSegmented,
} from '../panel/panel-theme';

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
    <div>
      {error && <PanelAlert>{error}</PanelAlert>}

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-[13px] md:grid-cols-4">
          <PanelStatCard
            label="آژانس فعال"
            value={faDigits(stats.activeAgencies)}
            trend={{ text: trendLabel(stats.activeAgenciesTrendPct), up: stats.activeAgenciesTrendPct >= 0 }}
            iconClass="bg-[rgba(59,130,246,.16)] text-panel-accent"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
            }
          />
          <PanelStatCard
            label="بلیط فروخته‌شده"
            value={faDigits(stats.ticketsSoldThisMonth)}
            trend={{ text: trendLabel(stats.ticketsTrendPct), up: stats.ticketsTrendPct >= 0 }}
            iconClass="bg-[rgba(52,211,153,.16)] text-[#34d399]"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18" />
              </svg>
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <PanelCard
          title="نمودار فروش"
          subtitle="به تفکیک کانال · تومان"
          actions={
            <div className={panelSegmented}>
              {CHART_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setGranularity(m.key)}
                  className={panelSegmentBtn(granularity === m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: 'سیستمی', color: '#1668c4', value: channelSums.system },
              { label: 'چارتر', color: '#a855f7', value: channelSums.charter },
              { label: 'آژانس', color: '#059669', value: channelSums.agency },
            ].map((ch) => (
              <div key={ch.label} className={panelElevatedPadded}>
                <div className={`mb-1 flex items-center gap-1.5 text-[10px] ${panelMuted}`}>
                  <span className="h-2 w-2 rounded-sm" style={{ background: ch.color }} />
                  {ch.label}
                </div>
                <div className="font-black" style={{ color: ch.color }}>
                  {faMoney(ch.value)}
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <p className={`py-10 text-center text-sm ${panelMuted}`}>در حال بارگذاری…</p>
          ) : (
            <SalesBarChart
              periods={periods}
              selectedPeriodKey={periodKey}
              onSelectPeriod={setPeriodKey}
              variant="panel"
            />
          )}

          {flights && (
            <div className={`mt-4 grid grid-cols-2 gap-3 rounded-[14px] border border-panel-border bg-panel-elevated/50 p-4 md:grid-cols-4`}>
              <div>
                <div className="text-lg font-black text-white">{faDigits(flights.flightCount)}</div>
                <div className={`text-xs ${panelMuted}`}>پروازهای انجام‌شده</div>
              </div>
              <div>
                <div className="text-lg font-black text-white">{faDigits(flights.totalSeats)}</div>
                <div className={`text-xs ${panelMuted}`}>مجموع صندلی</div>
              </div>
              <div>
                <div className="text-lg font-black text-[#34d399]">{faDigits(flights.soldSeats)}</div>
                <div className={`text-xs ${panelMuted}`}>فروخته‌شده</div>
              </div>
              <div>
                <div className="text-lg font-black text-[#f87171]">{faDigits(flights.unsoldSeats)}</div>
                <div className={`text-xs ${panelMuted}`}>فروش‌نرفته</div>
              </div>
            </div>
          )}
        </PanelCard>

        {cartable && (
          <PanelCard
            title={
              <>
                کارتابل
                {cartable.totalOpen > 0 && (
                  <span className="mr-2 rounded-full bg-[rgba(248,113,113,.16)] px-2.5 py-0.5 text-[11px] font-bold text-[#f87171]">
                    {faDigits(cartable.totalOpen)}
                  </span>
                )}
              </>
            }
          >
            {cartable.tasks.length === 0 ? (
              <p className={`py-6 text-center text-xs ${panelMuted}`}>کارتابل خالی است ✓</p>
            ) : (
              <ul className="divide-y divide-panel-border">
                {cartable.tasks.slice(0, 4).map((t) => (
                  <li key={t.id} className="flex items-start gap-3 py-3 text-xs">
                    <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[rgba(59,130,246,.16)] text-panel-accent">
                      ✉
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-white">{t.title}</div>
                      <div className={`mt-0.5 text-[10px] ${panelMuted}`}>
                        {t.senderLabelFa ?? t.sender?.fullName ?? ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/panel/cartable" className={`mt-4 block text-center text-xs ${panelLink}`}>
              مشاهده‌ی همه‌ی کارها ←
            </Link>
          </PanelCard>
        )}
      </div>
    </div>
  );
}
