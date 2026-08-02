import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchAgencySettlements,
  fetchCompletedFlightsSummary,
  fetchFlightSales,
  fetchKpis,
  fetchLowSalesAlerts,
  fetchRecentTransactions,
  fetchRevenueMix,
  fetchSalesChart,
} from '../../api/reporting';
import { remindAgencyInvoice } from '../../api/agencies';
import { fetchReconciliationQueue, resolveReconciliation } from '../../api/reconciliation';
import { airportCityName } from '../../lib/airport-cities';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import SalesBarChart from '../../components/SalesBarChart';
import SalesChartControls from '../../components/SalesChartControls';
import StatTile from '../../components/StatTile';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';
import {
  panelAlertSuccess,
  panelAlertWarning,
  panelBtnPrimary,
  panelCard,
  panelCardPadded,
  panelElevated,
  panelElevatedPadded,
  panelInput,
  panelListDivider,
  panelMuted,
  panelMuted2,
  panelSubtitle,
  panelText,
  panelTitle,
  panelValueSm,
} from '../panel/panel-theme';
import type {
  AgencySettlementsResult,
  CompletedFlightsSummary,
  FlightSalesRow,
  KpiResult,
  LowSalesAlert,
  RecentTransactionsResult,
  RevenueMixResult,
  SalesChartPeriod,
  SettlementStatus,
} from '../../types/reporting';
import type { ReconciliationItem } from '../../types/reconciliation';

/** Compact تومان for flight cards (میلیون / میلیارد) — display only. */
function faMoneyCompact(amountRial: string | number): string {
  const toman = Math.round(Number(amountRial) / 10);
  if (toman >= 1_000_000_000) {
    const v = (toman / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${faDigits(v)} میلیارد`;
  }
  if (toman >= 1_000_000) {
    return `${faDigits(Math.round(toman / 1_000_000))} میلیون`;
  }
  return faMoney(amountRial);
}

function flightRouteFa(originCode: string, destCode: string): string {
  return `${airportCityName(originCode, 'fa')} ↔ ${airportCityName(destCode, 'fa')}`;
}

const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; className: string }> = {
  SETTLED: { label: 'تسویه شد', className: 'bg-[rgba(52,211,153,.16)] text-[#34d399]' },
  PENDING: { label: 'در انتظار پرداخت', className: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]' },
  OVERDUE: { label: 'معوق', className: 'bg-[rgba(248,113,113,.16)] text-[#f87171]' },
};

const MIX_COLORS: Record<string, string> = {
  SYSTEM: '#3b82f6',
  CHARTER: '#a855f7',
  AGENCY: '#34d399',
};

const PANEL_ACCENT_BTN =
  'rounded-lg border border-[rgba(59,130,246,.3)] bg-[rgba(59,130,246,.12)] px-3 py-1.5 text-[11px] font-extrabold text-panel-link transition hover:bg-[rgba(59,130,246,.2)]';

function RevenueMixCard({ mix }: { mix: RevenueMixResult }) {
  const [c0, c1] = [mix.channels[0]?.pct ?? 0, (mix.channels[0]?.pct ?? 0) + (mix.channels[1]?.pct ?? 0)];
  const gradient = `conic-gradient(${MIX_COLORS.SYSTEM} 0% ${c0}%, ${MIX_COLORS.CHARTER} ${c0}% ${c1}%, ${MIX_COLORS.AGENCY} ${c1}% 100%)`;
  return (
    <div className={panelCardPadded}>
      <div className={panelTitle}>ترکیب درآمد</div>
      <div className={`mb-4 ${panelSubtitle}`}>بر اساس کانال فروش</div>
      <div className="mb-4 flex items-center justify-center">
        <div
          className="flex h-36 w-36 items-center justify-center rounded-full"
          style={{ background: gradient }}
          role="img"
          aria-label="نمودار ترکیب درآمد"
        >
          <div className={`flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full ${panelElevated}`}>
            <span className={`font-num text-xs font-black ${panelText}`}>{faMoney(mix.totalIrr)}</span>
            <span className={`text-[9px] ${panelMuted}`}>کل (تومان)</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {mix.channels.map((c) => (
          <div key={c.channel} className={`flex items-center justify-between gap-2 text-xs ${panelText}`}>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MIX_COLORS[c.channel] }} />
              {c.labelFa}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-num font-bold">{faMoney(c.amountIrr)}</span>
              <span className={`rounded-full ${panelElevated} px-2 py-0.5 text-[10px] font-bold ${panelMuted}`}>
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
    <div className={panelCardPadded}>
      <div className="mb-4 flex items-center justify-between">
        <div className={panelTitle}>پروازهای انجام‌شده</div>
        <span className={panelValueSm}>
          {faDigits(flights.flightCount)} <span className={`text-[10px] font-normal ${panelMuted}`}>پرواز</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={panelElevatedPadded}>
          <div className={`text-[10px] ${panelMuted}`}>مجموع صندلی</div>
          <div className={`font-num mt-1 text-sm font-black ${panelText}`}>{faDigits(flights.totalSeats)}</div>
        </div>
        <div className={panelElevatedPadded}>
          <div className={`text-[10px] ${panelMuted}`}>فروخته‌شده</div>
          <div className="font-num mt-1 text-sm font-black text-[#34d399]">{faDigits(flights.soldSeats)}</div>
        </div>
        <div className={panelElevatedPadded}>
          <div className={`text-[10px] ${panelMuted}`}>فروش‌نرفته</div>
          <div className="font-num mt-1 text-sm font-black text-[#f87171]">{faDigits(flights.unsoldSeats)}</div>
        </div>
      </div>
    </div>
  );
}

function LowSalesBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-3">
      {alerts.map((a) => (
        <div key={`${a.flightNo}-${a.departureAt}`} className={`flex items-center gap-3 ${panelAlertWarning}`}>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[rgba(245,158,11,.16)] text-[#fbbf24]">
            ⚠
          </span>
          <div className="text-xs leading-6">
            <div className="font-extrabold text-[#fbbf24]">هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز</div>
            <div className="text-[#cdd7e5]">
              پرواز <span className="ltr font-num inline-block">{a.flightNo}</span> {a.originCode} ← {a.destCode} (
              {formatJalaliDate(a.departureAt)}) تنها {faDigits(a.soldSeats)} از {faDigits(a.capacity)} صندلی فروخته
              شده است.
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const TX_STATUS_CLASS: Record<string, string> = {
  success: 'bg-[rgba(52,211,153,.16)] text-[#34d399]',
  warning: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]',
  danger: 'bg-[rgba(248,113,113,.16)] text-[#f87171]',
};

const TX_ICON_CLASS: Record<string, string> = {
  SALE: 'bg-[rgba(59,130,246,.16)] text-[#3b82f6]',
  SETTLEMENT: 'bg-[rgba(52,211,153,.16)] text-[#34d399]',
  COMMISSION: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]',
  REFUND: 'bg-[rgba(248,113,113,.16)] text-[#f87171]',
};

function trendBadge(pct: number): string {
  if (pct === 0) return '۰٪';
  return `${pct > 0 ? '+' : '−'}${faDigits(Math.abs(pct))}٪`;
}

function FinanceKpiCard({
  label,
  value,
  sublabel,
  trendPct,
  countBadge,
  iconClass,
}: {
  label: string;
  value: string;
  sublabel?: string;
  trendPct?: number;
  countBadge?: string;
  iconClass: string;
}) {
  return (
    <div className={`${panelCard} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>●</span>
        {countBadge ? (
          <span className="rounded-full bg-[rgba(248,113,113,.16)] px-2 py-0.5 text-[10px] font-bold text-[#f87171]">
            {countBadge}
          </span>
        ) : trendPct !== undefined ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              trendPct >= 0
                ? 'bg-[rgba(52,211,153,.16)] text-[#34d399]'
                : 'bg-[rgba(248,113,113,.16)] text-[#f87171]'
            }`}
          >
            {trendBadge(trendPct)}
          </span>
        ) : null}
      </div>
      <div className={panelValueSm}>{value}</div>
      <div className={`mt-1 text-[11px] ${panelMuted}`}>
        {label}
        {sublabel ? ` · ${sublabel}` : ''}
      </div>
    </div>
  );
}

/** صف مغایرت‌های پرداخت — no design mock exists for this (it's a Phase 13
 * backend-only addition: a real "payment succeeded, ticket not issued"
 * queue), so this is a new, functionally-styled card rather than a
 * redesign of an existing one — same approach as other un-mocked
 * backend-only controls added later in this project. */
function ReconciliationQueueCard({
  items,
  onResolve,
}: {
  items: ReconciliationItem[];
  onResolve: (id: string, note: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(id: string) {
    if (note.trim().length < 3) {
      setError('توضیح رفع مغایرت باید حداقل ۳ نویسه باشد.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onResolve(id, note.trim());
      setOpenId(null);
      setNote('');
    } catch {
      setError('خطا در رفع مغایرت.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mb-6 ${panelCardPadded}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className={panelTitle}>صف مغایرت‌های پرداخت</div>
        <span className="rounded-full bg-[rgba(248,113,113,.16)] px-3 py-1 text-[11px] font-extrabold text-[#f87171]">
          {faDigits(items.length)} مورد
        </span>
      </div>
      <div className={`mb-4 ${panelSubtitle}`}>
        پرداخت‌هایی که با موفقیت انجام شده‌اند اما صدور بلیط آن‌ها کامل نشده است
      </div>
      {items.length === 0 && <p className={`text-xs ${panelMuted}`}>موردی برای بررسی وجود ندارد.</p>}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            data-testid="reconciliation-item"
            className={`rounded-xl border border-panel-border-2 ${panelElevated} px-4 py-3`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[110px] text-xs">
                <div className={`text-[9px] ${panelMuted}`}>کد رزرو</div>
                <div className={`font-num font-extrabold ${panelText}`}>{item.pnr}</div>
              </div>
              <div className="min-w-[110px] text-xs">
                <div className={`text-[9px] ${panelMuted}`}>شناسه درگاه</div>
                <div className={`font-num font-bold ${panelText}`}>{item.gatewayRefId}</div>
              </div>
              <div className="min-w-[110px] text-xs">
                <div className={`text-[9px] ${panelMuted}`}>مبلغ</div>
                <div className={`font-num font-bold ${panelText}`}>{faMoney(item.amountIrr)} تومان</div>
              </div>
              <div className={`min-w-[110px] text-xs ${panelText}`}>
                <div className={`text-[9px] ${panelMuted}`}>تاریخ</div>
                <div>{formatJalaliDateTime(item.createdAt)}</div>
              </div>
              <button
                onClick={() => {
                  setOpenId(openId === item.id ? null : item.id);
                  setError(null);
                  setNote('');
                }}
                className={`mr-auto ${PANEL_ACCENT_BTN}`}
              >
                رفع مغایرت
              </button>
            </div>
            {openId === item.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-panel-border-2 pt-3">
                {error && (
                  <p role="alert" className="text-[11px] text-[#f87171]">
                    {error}
                  </p>
                )}
                <textarea
                  data-testid="reconciliation-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="توضیح رفع مغایرت (مثلاً: بلیط دستی صادر و مغایرت رفع شد.)"
                  className={`w-full p-2 ${panelInput}`}
                  rows={2}
                />
                <button
                  disabled={busy}
                  onClick={() => void submit(item.id)}
                  className={`self-start ${panelBtnPrimary} disabled:opacity-50`}
                >
                  {busy ? 'در حال ثبت…' : 'ثبت رفع مغایرت'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** FINANCE_MANAGER's finance-ops layout — the only panel with transactions
 * and agency settlements, per the design. */
function FinanceOpsView() {
  const chart = useSalesChartQuery({ includeFlightMode: true });
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [tx, setTx] = useState<RecentTransactionsResult | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [settlements, setSettlements] = useState<AgencySettlementsResult | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Auto-pick a flight when entering «شماره پرواز» so KPIs don't stay unloaded.
  useEffect(() => {
    if (chart.granularity !== 'flight' || chart.query.flightNo) return;
    let cancelled = false;
    fetchFlightSales()
      .then((rows) => {
        if (!cancelled && rows[0]) chart.selectFlightNo(rows[0].flightNo);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart.granularity]);

  useEffect(() => {
    if (!chart.isQueryReady) return;

    Promise.all([
      fetchKpis(chart.query),
      fetchLowSalesAlerts(),
      fetchCompletedFlightsSummary(chart.query),
      fetchRecentTransactions(),
      fetchRevenueMix(chart.query),
      fetchAgencySettlements(),
      fetchReconciliationQueue(),
    ])
      .then(([k, a, f, t, m, s, r]) => {
        setKpis(k);
        setAlerts(a);
        setFlights(f);
        setTx(t);
        setMix(m);
        setSettlements(s);
        setReconciliation(r);
        setError(null);
      })
      .catch(() => setError('خطا در دریافت اطلاعات مالی.'));
  }, [chart.query, chart.isQueryReady]);

  async function onResolveReconciliation(id: string, note: string) {
    await resolveReconciliation(id, note);
    setReconciliation((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  }

  async function onRemind(agencyId: string, invoiceId: string, agencyName: string) {
    try {
      await remindAgencyInvoice(agencyId, invoiceId);
      setNotice(`یادآوری تسویه برای «${agencyName}» ارسال شد ✓`);
    } catch {
      setError('خطا در ارسال یادآوری.');
    }
  }

  if (error) return <p className="text-sm text-[#f87171]">{error}</p>;
  if (!chart.isQueryReady || !kpis || !flights || !tx || !mix || !settlements || !reconciliation)
    return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;

  const periodLabel =
    chart.granularity === 'year'
      ? 'سال جاری'
      : chart.granularity === 'q6'
        ? '۶ ماهه'
        : chart.granularity === 'q3'
          ? '۳ ماهه'
          : chart.granularity === 'month'
            ? 'ماهانه'
            : chart.granularity === 'day'
              ? 'روزانه'
              : '';

  const kpiCards = [
    {
      label: `کل درآمد · ${periodLabel}`,
      value: faMoney(kpis.revenueIrr),
      trendPct: kpis.trends.revenuePct,
      iconClass: 'bg-[rgba(52,211,153,.16)] text-[#34d399]',
    },
    {
      label: `سود خالص · حاشیه ${faPercent(kpis.marginPct)}`,
      value: faMoney(kpis.profitIrr),
      trendPct: kpis.trends.profitPct,
      iconClass: 'bg-[rgba(59,130,246,.16)] text-[#3b82f6]',
    },
    {
      label: 'هزینه عملیاتی',
      value: faMoney(kpis.operatingCostIrr),
      trendPct: kpis.trends.operatingCostPct,
      iconClass: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]',
    },
    {
      label: 'مطالبات معوق آژانس‌ها',
      value: faMoney(kpis.agencyDebtIrr),
      countBadge: faDigits(kpis.agencyDebtCount),
      iconClass: 'bg-[rgba(248,113,113,.16)] text-[#f87171]',
    },
  ];

  return (
    <>
      {notice && <p className={`mb-4 ${panelAlertSuccess}`}>{notice}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <span className={`text-[11px] ${panelMuted}`}>بازهٔ گزارش:</span>
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

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiCards.map((k) => (
          <FinanceKpiCard key={k.label} {...k} />
        ))}
      </div>

      <LowSalesBanner alerts={alerts} />

      <ReconciliationQueueCard items={reconciliation} onResolve={onResolveReconciliation} />

      <div className="mb-6">
        <CompletedFlightsCard flights={flights} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className={panelCardPadded}>
          <div className="mb-1 flex items-center justify-between">
            <div className={panelTitle}>تراکنش‌های مالی اخیر</div>
            <span className={`rounded-lg ${panelElevated} px-3 py-1 text-[11px] font-bold ${panelMuted}`}>
              {faDigits(tx.totalCount)} تراکنش
            </span>
          </div>
          <div className={`mb-3 ${panelSubtitle}`}>فروش، تسویه، کمیسیون و استرداد</div>
          <div className={`flex flex-col divide-y ${panelListDivider}`}>
            {tx.rows.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 text-xs">
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm ${TX_ICON_CLASS[t.type] ?? `${panelElevated} ${panelMuted}`}`}
                >
                  {t.type === 'REFUND' ? '↩' : t.type === 'COMMISSION' ? '₪' : '✓'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-extrabold ${panelText}`}>{t.titleFa}</div>
                  <div className={`mt-0.5 text-[10px] ${panelMuted}`}>
                    {t.party} · {formatJalaliDateTime(t.occurredAt)}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${TX_STATUS_CLASS[t.statusTone]}`}
                >
                  {t.statusFa}
                </span>
                <span
                  className={`font-num font-black whitespace-nowrap ${
                    Number(t.signedAmountIrr) >= 0 && t.type !== 'REFUND' ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                >
                  {Number(t.signedAmountIrr) >= 0 ? '+' : '−'} {faMoney(Math.abs(Number(t.signedAmountIrr)))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <RevenueMixCard mix={mix} />
      </div>

      <div className={panelCardPadded}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className={panelTitle}>تسویه‌حساب آژانس‌های همکار</div>
          <span className="rounded-full bg-[rgba(248,113,113,.16)] px-3 py-1 text-[11px] font-extrabold text-[#f87171]">
            مجموع مطالبات: {faMoney(settlements.outstandingIrr)} تومان
          </span>
        </div>
        <div className={`mb-4 ${panelSubtitle}`}>وضعیت پرداخت دوره‌ای و مطالبات معوق</div>
        <div className="flex flex-col gap-3">
          {settlements.rows.map((s) => {
            const st = SETTLEMENT_STATUS[s.status];
            return (
              <div
                key={s.agencyId}
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-panel-border-2 ${panelElevated} px-4 py-3`}
              >
                <div className="min-w-[140px]">
                  <div className={`text-xs font-extrabold ${panelText}`}>{s.agencyName}</div>
                  {s.dueAt && (
                    <div className={`mt-0.5 text-[10px] ${panelMuted}`}>سررسید: {formatJalaliDate(s.dueAt)}</div>
                  )}
                </div>
                <div className={`min-w-[110px] text-xs ${panelText}`}>
                  <div className={`text-[9px] ${panelMuted}`}>مبلغ دوره</div>
                  <div className="font-num font-bold">{faMoney(s.totalIrr)} تومان</div>
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className={`mb-1 flex items-center justify-between text-[10px] ${panelMuted}`}>
                    <span>پرداخت‌شده</span>
                    <span className="font-num font-extrabold">{faPercent(s.paidPct)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-panel-border-2">
                    <div
                      className={`h-full rounded ${
                        s.status === 'SETTLED'
                          ? 'bg-[#34d399]'
                          : s.status === 'OVERDUE'
                            ? 'bg-[#f87171]'
                            : 'bg-[#fbbf24]'
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
                    className={PANEL_ACCENT_BTN}
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
  const chart = useSalesChartQuery({ includeFlightMode: true });
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [flightSales, setFlightSales] = useState<FlightSalesRow[]>([]);
  const [flightQ, setFlightQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isFlightMode = chart.granularity === 'flight';

  useEffect(() => {
    if (!isFlightMode) return;
    let cancelled = false;
    fetchFlightSales()
      .then((rows) => {
        if (cancelled) return;
        setFlightSales(rows);
        if (rows.length > 0 && !chart.query.flightNo) {
          chart.selectFlightNo(rows[0].flightNo);
        }
      })
      .catch(() => {
        if (!cancelled) setError('خطا در دریافت لیست پروازها.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load list when entering flight mode
  }, [isFlightMode]);

  useEffect(() => {
    if (!chart.isQueryReady) return;

    let cancelled = false;
    Promise.all([
      fetchSalesChart(chart.query),
      fetchKpis(chart.query),
      fetchCompletedFlightsSummary(chart.query),
      fetchRevenueMix(chart.query),
    ])
      .then(([chartData, kpiData, flightsData, mixData]) => {
        if (cancelled) return;
        setPeriods(chartData);
        setKpis(kpiData);
        setFlights(flightsData);
        setMix(mixData);
      })
      .catch(() => {
        if (!cancelled) setError('خطا در دریافت اطلاعات مالی.');
      });
    return () => {
      cancelled = true;
    };
  }, [chart.query, chart.isQueryReady]);

  const filteredFlightSales = useMemo(() => {
    const q = flightQ.trim().toLowerCase();
    if (!q) return flightSales;
    return flightSales.filter((r) => {
      const route = flightRouteFa(r.originCode, r.destCode);
      return (
        r.flightNo.toLowerCase().includes(q) ||
        route.includes(flightQ.trim()) ||
        r.originCode.toLowerCase().includes(q) ||
        r.destCode.toLowerCase().includes(q)
      );
    });
  }, [flightSales, flightQ]);

  const selectedFlight =
    flightSales.find((r) => r.flightNo === chart.query.flightNo) ?? filteredFlightSales[0] ?? null;

  if (error) return <p className="text-sm text-[#f87171]">{error}</p>;
  if (!flights || !mix) return <p className={`text-sm ${panelMuted}`}>در حال بارگذاری…</p>;

  // Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON on
  // the backend) — parsed here for this display-only sum; period totals are
  // far below 2^53 so Number() loses no precision.
  const sums = isFlightMode && selectedFlight
    ? {
        system: Number(selectedFlight.systemIrr),
        charter: Number(selectedFlight.charterIrr),
        agency: Number(selectedFlight.agencyIrr),
      }
    : {
        system: periods.reduce((s, p) => s + Number(p.systemIrr), 0),
        charter: periods.reduce((s, p) => s + Number(p.charterIrr), 0),
        agency: periods.reduce((s, p) => s + Number(p.agencyIrr), 0),
      };

  return (
    <>
      {kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="کل درآمد" value={`${faMoney(kpis.revenueIrr)} تومان`} tone="good" variant="panel" />
          <StatTile
            label="سود خالص"
            value={`${faMoney(kpis.profitIrr)} تومان`}
            sublabel={`حاشیه ${faPercent(kpis.marginPct)}`}
            tone="accent"
            variant="panel"
          />
          <StatTile label="هزینه عملیاتی" value={`${faMoney(kpis.operatingCostIrr)} تومان`} tone="warning" variant="panel" />
          <StatTile
            label="مطالبات معوق آژانس‌ها"
            value={`${faMoney(kpis.agencyDebtIrr)} تومان`}
            sublabel={`${faDigits(kpis.agencyDebtCount)} آژانس`}
            tone="critical"
            variant="panel"
          />
        </div>
      )}

      <div className={`mb-6 ${panelCardPadded}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className={panelTitle}>نمودار فروش</div>
            <div className={panelSubtitle}>
              {isFlightMode
                ? 'گزارش مالی بر اساس شماره پرواز · تومان'
                : 'به تفکیک کانال فروش · تومان'}
            </div>
          </div>
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

        {isFlightMode && selectedFlight && (
          <div className="mb-4 rounded-[12px] border border-[#28344c] bg-[#18223a] px-4 py-3">
            <div className="text-[12.5px] font-extrabold text-white">
              پرواز{' '}
              <span className="font-num" dir="ltr">
                {selectedFlight.flightNo}
              </span>{' '}
              — {faMoneyCompact(selectedFlight.totalIrr)} تومان
            </div>
            <div className={`mt-1 text-[11px] ${panelMuted}`}>
              {flightRouteFa(selectedFlight.originCode, selectedFlight.destCode)} ·{' '}
              {formatJalaliDate(selectedFlight.departureAt)} · {faDigits(selectedFlight.tickets)} بلیط
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className={panelElevatedPadded}>
            <div className={`mb-1 flex items-center gap-1.5 text-[10px] ${panelMuted}`}>
              <span className="h-2 w-2 rounded-sm bg-[#3b82f6]" />
              سیستمی
            </div>
            <div className="font-num font-black text-[#3b82f6]">
              {isFlightMode ? faMoneyCompact(sums.system) : faMoney(sums.system)}
            </div>
          </div>
          <div className={panelElevatedPadded}>
            <div className={`mb-1 flex items-center gap-1.5 text-[10px] ${panelMuted}`}>
              <span className="h-2 w-2 rounded-sm bg-[#a855f7]" />
              چارتر
            </div>
            <div className="font-num font-black text-[#a855f7]">
              {isFlightMode ? faMoneyCompact(sums.charter) : faMoney(sums.charter)}
            </div>
          </div>
          <div className={panelElevatedPadded}>
            <div className={`mb-1 flex items-center gap-1.5 text-[10px] ${panelMuted}`}>
              <span className="h-2 w-2 rounded-sm bg-[#34d399]" />
              آژانس
            </div>
            <div className="font-num font-black text-[#34d399]">
              {isFlightMode ? faMoneyCompact(sums.agency) : faMoney(sums.agency)}
            </div>
          </div>
        </div>

        {isFlightMode ? (
          <div className="pt-1">
            {flightSales.length === 0 ? (
              <div className={`py-8 text-center text-[11.5px] ${panelMuted}`}>
                پرواز انجام‌شده‌ای ثبت نشده است.
              </div>
            ) : (
              <>
                <div className="relative mb-3 max-w-[430px]">
                  <input
                    value={flightQ}
                    onChange={(e) => setFlightQ(e.target.value)}
                    placeholder="جستجوی شماره پرواز یا مسیر…"
                    aria-label="جستجوی شماره پرواز یا مسیر"
                    className="h-10 w-full rounded-[11px] border border-[#28344c] bg-[#141d2e] px-3 text-[11.5px] text-[#e7ecf3] outline-none"
                  />
                </div>
                {filteredFlightSales.length === 0 ? (
                  <div className={`py-6 text-center text-[11.5px] ${panelMuted}`}>
                    پروازی با این مشخصات یافت نشد.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredFlightSales.map((r) => {
                      const on = r.flightNo === (chart.query.flightNo ?? selectedFlight?.flightNo);
                      return (
                        <button
                          key={r.flightNo}
                          type="button"
                          onClick={() => chart.selectFlightNo(r.flightNo)}
                          className={`flex items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-right transition ${
                            on
                              ? 'border-[#3b82f6] bg-[rgba(59,130,246,.16)]'
                              : 'border-[#1f2a3d] bg-[#141d2e] hover:border-[#28344c]'
                          }`}
                        >
                          <div className="min-w-0 leading-relaxed">
                            <div
                              className={`truncate text-[12.5px] font-extrabold ${on ? 'text-white' : 'text-[#e7ecf3]'}`}
                            >
                              {flightRouteFa(r.originCode, r.destCode)}
                            </div>
                            <div className={`text-[10px] ${panelMuted}`}>
                              پرواز{' '}
                              <span className="font-num" dir="ltr">
                                {r.flightNo}
                              </span>{' '}
                              · {formatJalaliDate(r.departureAt)}
                            </div>
                          </div>
                          <div className="shrink-0 text-left whitespace-nowrap">
                            <div className="font-num text-[12px] font-extrabold text-[#60a5fa]">
                              {faMoneyCompact(r.totalIrr)}
                            </div>
                            <div className={`text-[9px] ${panelMuted}`}>فروش</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <SalesBarChart
            periods={periods}
            selectedPeriodKey={chart.periodKey}
            onSelectPeriod={chart.setPeriodKey}
            variant="panel"
          />
        )}
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
    <div>
      <p className={`mb-6 text-sm ${panelMuted2}`}>
        {isFinanceOps
          ? 'تراکنش‌ها، ترکیب درآمد و تسویه‌حساب آژانس‌های همکار'
          : 'نمای تحلیلی فروش و ترکیب درآمد'}
      </p>
      {isFinanceOps ? <FinanceOpsView /> : <FinanceAnalyticView />}
    </div>
  );
}
