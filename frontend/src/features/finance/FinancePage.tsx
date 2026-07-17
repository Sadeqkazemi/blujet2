import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchAgencySettlements,
  fetchCompletedFlightsSummary,
  fetchKpis,
  fetchLowSalesAlerts,
  fetchRecentTransactions,
  fetchRevenueMix,
  fetchSalesChart,
} from '../../api/reporting';
import { remindAgencyInvoice } from '../../api/agencies';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import SalesBarChart from '../../components/SalesBarChart';
import type {
  AgencySettlementsResult,
  CompletedFlightsSummary,
  KpiResult,
  LowSalesAlert,
  RecentTransactionsResult,
  RevenueMixResult,
  SalesChartPeriod,
  SalesGranularity,
  SettlementStatus,
} from '../../types/reporting';

const CHART_MODES: { key: SalesGranularity; label: string }[] = [
  { key: 'q3', label: '۳ ماهه' },
  { key: 'q6', label: '۶ ماهه' },
  { key: 'year', label: 'سالانه' },
];

const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; className: string }> = {
  SETTLED: { label: 'تسویه شد', className: 'bg-[#10b98124] text-[#059669]' },
  PENDING: { label: 'در انتظار پرداخت', className: 'bg-[#f59e0b24] text-[#b45309]' },
  OVERDUE: { label: 'معوق', className: 'bg-danger/15 text-danger' },
};

const MIX_COLORS: Record<string, string> = {
  SYSTEM: '#1668c4',
  CHARTER: '#a855f7',
  AGENCY: '#059669',
};

function RevenueMixCard({ mix }: { mix: RevenueMixResult }) {
  const [c0, c1] = [mix.channels[0]?.pct ?? 0, (mix.channels[0]?.pct ?? 0) + (mix.channels[1]?.pct ?? 0)];
  const gradient = `conic-gradient(${MIX_COLORS.SYSTEM} 0% ${c0}%, ${MIX_COLORS.CHARTER} ${c0}% ${c1}%, ${MIX_COLORS.AGENCY} ${c1}% 100%)`;
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-1 text-sm font-bold text-ink">ترکیب درآمد</div>
      <div className="mb-4 text-[11px] text-muted">بر اساس کانال فروش</div>
      <div className="mb-4 flex items-center justify-center">
        <div
          className="flex h-36 w-36 items-center justify-center rounded-full"
          style={{ background: gradient }}
          role="img"
          aria-label="نمودار ترکیب درآمد"
        >
          <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white">
            <span className="font-num text-xs font-black text-ink">{faMoney(mix.totalIrr)}</span>
            <span className="text-[9px] text-muted">کل (تومان)</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {mix.channels.map((c) => (
          <div key={c.channel} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MIX_COLORS[c.channel] }} />
              {c.labelFa}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-num font-bold">{faMoney(c.amountIrr)}</span>
              <span className="rounded-full bg-body px-2 py-0.5 text-[10px] font-bold text-muted">
                {faPercent(c.pct)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletedFlightsCard({ flights }: { flights: CompletedFlightsSummary }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">پروازهای انجام‌شده</div>
        <span className="font-num text-lg font-black text-ink">
          {faDigits(flights.flightCount)} <span className="text-[10px] font-normal text-muted">پرواز</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-body p-3">
          <div className="text-[10px] text-muted">مجموع صندلی</div>
          <div className="font-num mt-1 text-sm font-black text-ink">{faDigits(flights.totalSeats)}</div>
        </div>
        <div className="rounded-lg bg-body p-3">
          <div className="text-[10px] text-muted">فروخته‌شده</div>
          <div className="font-num mt-1 text-sm font-black text-[#059669]">{faDigits(flights.soldSeats)}</div>
        </div>
        <div className="rounded-lg bg-body p-3">
          <div className="text-[10px] text-muted">فروش‌نرفته</div>
          <div className="font-num mt-1 text-sm font-black text-danger">{faDigits(flights.unsoldSeats)}</div>
        </div>
      </div>
    </div>
  );
}

function LowSalesBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  const a = alerts[0];
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#f59e0b59] bg-[#f59e0b14] p-4">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f59e0b29] text-[#b45309]">
        ⚠
      </span>
      <div className="text-xs leading-6">
        <div className="font-extrabold text-[#b45309]">هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز</div>
        <div className="text-text-2">
          پرواز <span className="ltr font-num inline-block">{a.flightNo}</span> {a.originCode} ← {a.destCode} (
          {formatJalaliDate(a.departureAt)}) تنها {faDigits(a.soldSeats)} از {faDigits(a.capacity)} صندلی فروخته
          شده است.
        </div>
      </div>
    </div>
  );
}

/** FINANCE_MANAGER's finance-ops layout — the only panel with transactions
 * and agency settlements, per the design. */
function FinanceOpsView() {
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [tx, setTx] = useState<RecentTransactionsResult | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [settlements, setSettlements] = useState<AgencySettlementsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reload() {
    Promise.all([
      fetchKpis({ granularity: 'year' }),
      fetchLowSalesAlerts(),
      fetchCompletedFlightsSummary({ granularity: 'year' }),
      fetchRecentTransactions(),
      fetchRevenueMix({ granularity: 'year' }),
      fetchAgencySettlements(),
    ])
      .then(([k, a, f, t, m, s]) => {
        setKpis(k);
        setAlerts(a);
        setFlights(f);
        setTx(t);
        setMix(m);
        setSettlements(s);
      })
      .catch(() => setError('خطا در دریافت اطلاعات مالی.'));
  }

  useEffect(reload, []);

  async function onRemind(agencyId: string, invoiceId: string, agencyName: string) {
    try {
      await remindAgencyInvoice(agencyId, invoiceId);
      setNotice(`یادآوری تسویه برای «${agencyName}» ارسال شد ✓`);
    } catch {
      setError('خطا در ارسال یادآوری.');
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!kpis || !flights || !tx || !mix || !settlements)
    return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const kpiCards = [
    { label: 'کل درآمد (تومان)', value: faMoney(kpis.revenueIrr) },
    { label: `سود خالص · حاشیه ${faPercent(kpis.marginPct)}`, value: faMoney(kpis.profitIrr) },
    { label: 'هزینه عملیاتی (تومان)', value: faMoney(kpis.operatingCostIrr) },
    {
      label: `مطالبات معوق آژانس‌ها · ${faDigits(kpis.agencyDebtCount)} آژانس`,
      value: faMoney(kpis.agencyDebtIrr),
    },
  ];

  return (
    <>
      {notice && (
        <p className="mb-4 rounded-lg bg-[#10b98118] p-3 text-xs font-bold text-[#059669]">{notice}</p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-white p-4">
            <div className="font-num text-lg font-black text-ink">{k.value}</div>
            <div className="mt-1 text-[11px] text-muted">{k.label}</div>
          </div>
        ))}
      </div>

      <LowSalesBanner alerts={alerts} />

      <div className="mb-6">
        <CompletedFlightsCard flights={flights} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-bold text-ink">تراکنش‌های مالی اخیر</div>
            <span className="rounded-lg bg-body px-3 py-1 text-[11px] font-bold text-muted">
              {faDigits(tx.totalCount)} تراکنش
            </span>
          </div>
          <div className="mb-3 text-[11px] text-muted">فروش، تسویه، کمیسیون و استرداد</div>
          <div className="flex flex-col divide-y divide-border/60">
            {tx.rows.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-ink">{t.titleFa}</div>
                  <div className="mt-0.5 text-[10px] text-muted">
                    {t.party} · {formatJalaliDateTime(t.occurredAt)}
                  </div>
                </div>
                <span
                  className={`font-num font-black whitespace-nowrap ${
                    t.signedAmountIrr >= 0 && t.type !== 'REFUND' ? 'text-[#059669]' : 'text-danger'
                  }`}
                >
                  {t.signedAmountIrr >= 0 ? '+' : '−'} {faMoney(Math.abs(t.signedAmountIrr))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <RevenueMixCard mix={mix} />
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-ink">تسویه‌حساب آژانس‌های همکار</div>
          <span className="rounded-full bg-danger/10 px-3 py-1 text-[11px] font-extrabold text-danger">
            مجموع مطالبات: {faMoney(settlements.outstandingIrr)} تومان
          </span>
        </div>
        <div className="mb-4 text-[11px] text-muted">وضعیت پرداخت دوره‌ای و مطالبات معوق</div>
        <div className="flex flex-col gap-3">
          {settlements.rows.map((s) => {
            const st = SETTLEMENT_STATUS[s.status];
            return (
              <div
                key={s.agencyId}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border/70 bg-body/50 px-4 py-3"
              >
                <div className="min-w-[140px]">
                  <div className="text-xs font-extrabold text-ink">{s.agencyName}</div>
                  {s.dueAt && (
                    <div className="mt-0.5 text-[10px] text-muted">سررسید: {formatJalaliDate(s.dueAt)}</div>
                  )}
                </div>
                <div className="min-w-[110px] text-xs">
                  <div className="text-[9px] text-muted">مبلغ دوره</div>
                  <div className="font-num font-bold">{faMoney(s.totalIrr)} تومان</div>
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-muted">پرداخت‌شده</span>
                    <span className="font-num font-extrabold">{faPercent(s.paidPct)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-border/60">
                    <div
                      className={`h-full rounded ${
                        s.status === 'SETTLED'
                          ? 'bg-[#059669]'
                          : s.status === 'OVERDUE'
                            ? 'bg-danger'
                            : 'bg-[#f59e0b]'
                      }`}
                      style={{ width: `${s.paidPct}%` }}
                    />
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${st.className}`}>
                  {st.label}
                  {s.status === 'OVERDUE' && ` — ${faDigits(s.overdueDays)} روز`}
                </span>
                {s.remindInvoiceId && (
                  <button
                    onClick={() => void onRemind(s.agencyId, s.remindInvoiceId!, s.agencyName)}
                    className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-extrabold text-accent transition hover:bg-accent/20"
                  >
                    ارسال یادآوری
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Analytic مالی view for CEO / Board Chair / Senior / Commercial. */
function FinanceAnalyticView() {
  const [granularity, setGranularity] = useState<SalesGranularity>('q6');
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeriodKey(null);
  }, [granularity]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchSalesChart({ granularity }),
      fetchCompletedFlightsSummary({ granularity, periodKey: periodKey ?? undefined }),
      fetchRevenueMix({ granularity, periodKey: periodKey ?? undefined }),
    ])
      .then(([chartData, flightsData, mixData]) => {
        if (cancelled) return;
        setPeriods(chartData);
        setFlights(flightsData);
        setMix(mixData);
      })
      .catch(() => {
        if (!cancelled) setError('خطا در دریافت اطلاعات مالی.');
      });
    return () => {
      cancelled = true;
    };
  }, [granularity, periodKey]);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!flights || !mix) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const sums = {
    system: periods.reduce((s, p) => s + p.systemIrr, 0),
    charter: periods.reduce((s, p) => s + p.charterIrr, 0),
    agency: periods.reduce((s, p) => s + p.agencyIrr, 0),
  };

  return (
    <>
      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-ink">نمودار فروش</div>
            <div className="mt-0.5 text-[11px] text-muted">به تفکیک کانال فروش · تومان</div>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-body p-1">
            {CHART_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setGranularity(m.key)}
                className={`rounded-md px-3 py-1.5 text-[11px] transition ${
                  granularity === m.key ? 'bg-accent font-bold text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-body p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted">
              <span className="h-2 w-2 rounded-sm bg-[#1668c4]" />
              سیستمی
            </div>
            <div className="font-num font-black text-[#1668c4]">{faMoney(sums.system)}</div>
          </div>
          <div className="rounded-lg bg-body p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted">
              <span className="h-2 w-2 rounded-sm bg-[#a855f7]" />
              چارتر
            </div>
            <div className="font-num font-black text-[#a855f7]">{faMoney(sums.charter)}</div>
          </div>
          <div className="rounded-lg bg-body p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted">
              <span className="h-2 w-2 rounded-sm bg-[#059669]" />
              آژانس
            </div>
            <div className="font-num font-black text-[#059669]">{faMoney(sums.agency)}</div>
          </div>
        </div>

        <SalesBarChart periods={periods} selectedPeriodKey={periodKey} onSelectPeriod={setPeriodKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <CompletedFlightsCard flights={flights} />
        <RevenueMixCard mix={mix} />
      </div>
    </>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const isFinanceOps = user?.role === 'FINANCE_MANAGER';

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">مالی</h1>
      <p className="mb-6 text-sm text-muted">
        {isFinanceOps
          ? 'تراکنش‌ها، ترکیب درآمد و تسویه‌حساب آژانس‌های همکار'
          : 'نمای تحلیلی فروش و ترکیب درآمد'}
      </p>
      {isFinanceOps ? <FinanceOpsView /> : <FinanceAnalyticView />}
    </div>
  );
}
