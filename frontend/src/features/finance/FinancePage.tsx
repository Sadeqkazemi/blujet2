import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchAgencySettlements,
  fetchCompletedFlightsSummary,
  fetchKpis,
  fetchRecentTransactions,
  fetchRevenueMix,
  fetchSalesChart,
} from '../../api/reporting';
import { remindAgencyInvoice } from '../../api/agencies';
import { fetchReconciliationQueue, resolveReconciliation } from '../../api/reconciliation';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import LowSalesBanner from '../../components/LowSalesBanner';
import SalesBarChart from '../../components/SalesBarChart';
import SalesChartControls from '../../components/SalesChartControls';
import StatTile from '../../components/StatTile';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';
import type { PanelShellContext } from '../../types/panel-shell';
import type {
  AgencySettlementsResult,
  CompletedFlightsSummary,
  KpiResult,
  RecentTransactionsResult,
  RevenueMixResult,
  SalesChartPeriod,
  SettlementStatus,
} from '../../types/reporting';
import type { ReconciliationItem } from '../../types/reconciliation';

const DARK_CARD = 'rounded-xl border border-[#1f2a3d] bg-[#141d2e]';

const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; className: string }> = {
  SETTLED: { label: 'تسویه شد', className: 'bg-[#34d39924] text-[#34d399]' },
  PENDING: { label: 'در انتظار پرداخت', className: 'bg-[#f59e0b24] text-[#fbbf24]' },
  OVERDUE: { label: 'معوق', className: 'bg-[#f8717124] text-[#f87171]' },
};

const MIX_COLORS: Record<string, string> = {
  SYSTEM: '#3b82f6',
  CHARTER: '#a855f7',
  AGENCY: '#34d399',
};

function RevenueMixCard({ mix }: { mix: RevenueMixResult }) {
  const [c0, c1] = [mix.channels[0]?.pct ?? 0, (mix.channels[0]?.pct ?? 0) + (mix.channels[1]?.pct ?? 0)];
  const gradient = `conic-gradient(${MIX_COLORS.SYSTEM} 0% ${c0}%, ${MIX_COLORS.CHARTER} ${c0}% ${c1}%, ${MIX_COLORS.AGENCY} ${c1}% 100%)`;
  return (
    <div className={`${DARK_CARD} p-5`}>
      <div className="mb-1 text-sm font-bold text-white">ترکیب درآمد</div>
      <div className="mb-4 text-[11px] text-[#6b7b94]">بر اساس کانال فروش</div>
      <div className="mb-4 flex items-center justify-center">
        <div
          className="flex h-36 w-36 items-center justify-center rounded-full"
          style={{ background: gradient }}
          role="img"
          aria-label="نمودار ترکیب درآمد"
        >
          <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-[#141d2e]">
            <span className="font-num text-xs font-black text-white">{faMoney(mix.totalIrr)}</span>
            <span className="text-[9px] text-[#6b7b94]">کل (تومان)</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {mix.channels.map((c) => (
          <div key={c.channel} className="flex items-center justify-between gap-2 text-xs text-[#e7ecf3]">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MIX_COLORS[c.channel] }} />
              {c.labelFa}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-num font-bold">{faMoney(c.amountIrr)}</span>
              <span className="rounded-full bg-[#18223a] px-2 py-0.5 text-[10px] font-bold text-[#6b7b94]">
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
    <div className="rounded-xl border border-[#28344c] bg-gradient-to-br from-[#1a2740] to-[#141d2e] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-white">پروازهای انجام‌شده</div>
        <span className="font-num text-lg font-black text-white">
          {faDigits(flights.flightCount)} <span className="text-[10px] font-normal text-[#6b7b94]">پرواز</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-[#18223a] p-3">
          <div className="text-[10px] text-[#6b7b94]">مجموع صندلی</div>
          <div className="font-num mt-1 text-sm font-black text-[#e7ecf3]">{faDigits(flights.totalSeats)}</div>
        </div>
        <div className="rounded-lg bg-[#18223a] p-3">
          <div className="text-[10px] text-[#6b7b94]">فروخته‌شده</div>
          <div className="font-num mt-1 text-sm font-black text-[#34d399]">{faDigits(flights.soldSeats)}</div>
        </div>
        <div className="rounded-lg bg-[#18223a] p-3">
          <div className="text-[10px] text-[#6b7b94]">فروش‌نرفته</div>
          <div className="font-num mt-1 text-sm font-black text-[#f87171]">{faDigits(flights.unsoldSeats)}</div>
        </div>
      </div>
    </div>
  );
}

const TX_STATUS_CLASS: Record<string, string> = {
  success: 'bg-[#34d39924] text-[#34d399]',
  warning: 'bg-[#f59e0b24] text-[#fbbf24]',
  danger: 'bg-[#f8717124] text-[#f87171]',
};

const TX_ICON_CLASS: Record<string, string> = {
  SALE: 'bg-[#3b82f624] text-[#60a5fa]',
  SETTLEMENT: 'bg-[#34d39924] text-[#34d399]',
  COMMISSION: 'bg-[#f59e0b24] text-[#fbbf24]',
  REFUND: 'bg-[#f8717124] text-[#f87171]',
};

function trendBadge(pct: number): string {
  if (pct === 0) return '۰٪';
  return `${pct > 0 ? '+' : '−'}${faDigits(Math.abs(pct))}٪`;
}

function KpiTrendIcon({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      {up ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
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
    <div className={`${DARK_CARD} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 17l6-6 4 4 8-8" />
          </svg>
        </span>
        {countBadge ? (
          <span className="rounded-full bg-[#f8717124] px-2 py-0.5 text-[10px] font-bold text-[#f87171]">
            {countBadge}
          </span>
        ) : trendPct !== undefined ? (
          <span className="flex items-center gap-0.5 rounded-full bg-[#34d39924] px-2 py-0.5 text-[10px] font-bold text-[#34d399]">
            <KpiTrendIcon up={trendPct >= 0} />
            {trendBadge(trendPct)}
          </span>
        ) : null}
      </div>
      <div className="font-num text-lg font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] text-[#6b7b94]">
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
    <div className={`mb-6 ${DARK_CARD} p-5`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-white">صف مغایرت‌های پرداخت</div>
        <span className="rounded-full bg-[#f8717124] px-3 py-1 text-[11px] font-extrabold text-[#f87171]">
          {faDigits(items.length)} مورد
        </span>
      </div>
      <div className="mb-4 text-[11px] text-[#6b7b94]">
        پرداخت‌هایی که با موفقیت انجام شده‌اند اما صدور بلیط آن‌ها کامل نشده است
      </div>
      {items.length === 0 && (
        <p className="text-xs text-[#6b7b94]">موردی برای بررسی وجود ندارد.</p>
      )}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            data-testid="reconciliation-item"
            className="rounded-xl border border-[#22304a] bg-[#0f1726] px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[110px] text-xs">
                <div className="text-[9px] text-[#6b7b94]">کد رزرو</div>
                <div className="font-num font-extrabold text-white">{item.pnr}</div>
              </div>
              <div className="min-w-[110px] text-xs">
                <div className="text-[9px] text-[#6b7b94]">شناسه درگاه</div>
                <div className="font-num font-bold text-[#e7ecf3]">{item.gatewayRefId}</div>
              </div>
              <div className="min-w-[110px] text-xs">
                <div className="text-[9px] text-[#6b7b94]">مبلغ</div>
                <div className="font-num font-bold text-[#e7ecf3]">{faMoney(item.amountIrr)} تومان</div>
              </div>
              <div className="min-w-[110px] text-xs">
                <div className="text-[9px] text-[#6b7b94]">تاریخ</div>
                <div className="text-[#cdd7e5]">{formatJalaliDateTime(item.createdAt)}</div>
              </div>
              <button
                onClick={() => {
                  setOpenId(openId === item.id ? null : item.id);
                  setError(null);
                  setNote('');
                }}
                className="mr-auto rounded-lg border border-[#3b82f64d] bg-[#3b82f61f] px-3 py-1.5 text-[11px] font-extrabold text-[#60a5fa] transition hover:bg-[#3b82f633]"
              >
                رفع مغایرت
              </button>
            </div>
            {openId === item.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-[#22304a] pt-3">
                {error && <p role="alert" className="text-[11px] text-[#f87171]">{error}</p>}
                <textarea
                  data-testid="reconciliation-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="توضیح رفع مغایرت (مثلاً: بلیط دستی صادر و مغایرت رفع شد.)"
                  className="w-full rounded-lg border border-[#28344c] bg-[#18223a] p-2 text-xs text-[#e7ecf3] outline-none"
                  rows={2}
                />
                <button
                  disabled={busy}
                  onClick={() => void submit(item.id)}
                  className="self-start rounded-lg bg-[#3b82f6] px-4 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-50"
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
  const { lowSalesAlerts = [] } = useOutletContext<PanelShellContext>();
  const bannerAlert = lowSalesAlerts[0] ?? null;
  const chart = useSalesChartQuery({ includeFlightMode: false });
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [tx, setTx] = useState<RecentTransactionsResult | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [settlements, setSettlements] = useState<AgencySettlementsResult | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!chart.isQueryReady) return;

    Promise.all([
      fetchKpis(chart.query),
      fetchCompletedFlightsSummary(chart.query),
      fetchRecentTransactions(),
      fetchRevenueMix(chart.query),
      fetchAgencySettlements(),
      fetchReconciliationQueue(),
    ])
      .then(([k, f, t, m, s, r]) => {
        setKpis(k);
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

  if (error) return <p className="p-8 text-sm text-[#f87171]">{error}</p>;
  if (!chart.isQueryReady || !kpis || !flights || !tx || !mix || !settlements || !reconciliation)
    return <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;

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
      iconClass: 'bg-[#34d39924] text-[#34d399]',
    },
    {
      label: `سود خالص · حاشیه ${faPercent(kpis.marginPct)}`,
      value: faMoney(kpis.profitIrr),
      trendPct: kpis.trends.profitPct,
      iconClass: 'bg-[#3b82f624] text-[#60a5fa]',
    },
    {
      label: 'هزینه عملیاتی',
      value: faMoney(kpis.operatingCostIrr),
      trendPct: kpis.trends.operatingCostPct,
      iconClass: 'bg-[#f59e0b24] text-[#fbbf24]',
    },
    {
      label: 'مطالبات معوق آژانس‌ها',
      value: faMoney(kpis.agencyDebtIrr),
      countBadge: faDigits(kpis.agencyDebtCount),
      iconClass: 'bg-[#f8717124] text-[#f87171]',
    },
  ];

  return (
    <>
      {notice && (
        <p className="mb-4 rounded-lg bg-[#34d39924] p-3 text-xs font-bold text-[#34d399]">{notice}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <span className="text-[11px] text-[#6b7b94]">بازهٔ گزارش:</span>
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
          variant="segmented"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiCards.map((k) => (
          <FinanceKpiCard key={k.label} {...k} />
        ))}
      </div>

      <LowSalesBanner alert={bannerAlert} variant="dark" />

      <ReconciliationQueueCard items={reconciliation} onResolve={onResolveReconciliation} />

      <div className="mb-6">
        <CompletedFlightsCard flights={flights} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className={`${DARK_CARD} p-5`}>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-bold text-white">تراکنش‌های مالی اخیر</div>
            <span className="rounded-lg bg-[#18223a] px-3 py-1 text-[11px] font-bold text-[#6b7b94]">
              {faDigits(tx.totalCount)} تراکنش
            </span>
          </div>
          <div className="mb-3 text-[11px] text-[#6b7b94]">فروش، تسویه، کمیسیون و استرداد</div>
          <div className="flex flex-col divide-y divide-[#22304a]">
            {/* Design hint-placeholder-count="5" — show five most-recent rows. */}
            {tx.rows.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 text-xs">
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm ${TX_ICON_CLASS[t.type] ?? 'bg-[#18223a] text-[#6b7b94]'}`}
                >
                  {t.type === 'REFUND' ? '↩' : t.type === 'COMMISSION' ? '₪' : '✓'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-white">{t.titleFa}</div>
                  <div className="mt-0.5 text-[10px] text-[#6b7b94]">
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

      <div className={`${DARK_CARD} p-5`}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-white">تسویه‌حساب آژانس‌های همکار</div>
          <span className="rounded-full bg-[#f8717124] px-3 py-1 text-[11px] font-extrabold text-[#f87171]">
            مجموع مطالبات: {faMoney(settlements.outstandingIrr)} تومان
          </span>
        </div>
        <div className="mb-4 text-[11px] text-[#6b7b94]">وضعیت پرداخت دوره‌ای و مطالبات معوق</div>
        <div className="flex flex-col gap-3">
          {settlements.rows.map((s) => {
            const st = SETTLEMENT_STATUS[s.status];
            return (
              <div
                key={s.agencyId}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-[#22304a] bg-[#0f1726] px-4 py-3"
              >
                <div className="min-w-[140px]">
                  <div className="text-xs font-extrabold text-white">{s.agencyName}</div>
                  {s.dueAt && (
                    <div className="mt-0.5 text-[10px] text-[#6b7b94]">سررسید: {formatJalaliDate(s.dueAt)}</div>
                  )}
                </div>
                <div className="min-w-[110px] text-xs">
                  <div className="text-[9px] text-[#6b7b94]">مبلغ دوره</div>
                  <div className="font-num font-bold text-[#e7ecf3]">{faMoney(s.totalIrr)} تومان</div>
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-[#6b7b94]">پرداخت‌شده</span>
                    <span className="font-num font-extrabold text-[#e7ecf3]">{faPercent(s.paidPct)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-[#18223a]">
                    <div
                      className={`h-full rounded ${
                        s.status === 'SETTLED'
                          ? 'bg-[#34d399]'
                          : s.status === 'OVERDUE'
                            ? 'bg-[#f87171]'
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
                    className="rounded-lg border border-[#3b82f64d] bg-[#3b82f61f] px-3 py-1.5 text-[11px] font-extrabold text-[#60a5fa] transition hover:bg-[#3b82f633]"
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
  const chart = useSalesChartQuery({ includeFlightMode: false });
  const [periods, setPeriods] = useState<SalesChartPeriod[]>([]);
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [flights, setFlights] = useState<CompletedFlightsSummary | null>(null);
  const [mix, setMix] = useState<RevenueMixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <p className="p-8 text-sm text-[#f87171]">{error}</p>;
  if (!flights || !mix) return <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;

  const sums = {
    system: periods.reduce((s, p) => s + Number(p.systemIrr), 0),
    charter: periods.reduce((s, p) => s + Number(p.charterIrr), 0),
    agency: periods.reduce((s, p) => s + Number(p.agencyIrr), 0),
  };

  return (
    <>
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

      <div className={`mb-6 ${DARK_CARD} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">نمودار فروش</div>
            <div className="mt-0.5 text-[11px] text-[#6b7b94]">به تفکیک کانال فروش · تومان</div>
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
            variant="segmented"
          />
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-[#18223a] p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[#6b7b94]">
              <span className="h-2 w-2 rounded-sm bg-[#3b82f6]" />
              سیستمی
            </div>
            <div className="font-num font-black text-[#60a5fa]">{faMoney(sums.system)}</div>
          </div>
          <div className="rounded-lg bg-[#18223a] p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[#6b7b94]">
              <span className="h-2 w-2 rounded-sm bg-[#a855f7]" />
              چارتر
            </div>
            <div className="font-num font-black text-[#c084fc]">{faMoney(sums.charter)}</div>
          </div>
          <div className="rounded-lg bg-[#18223a] p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[#6b7b94]">
              <span className="h-2 w-2 rounded-sm bg-[#34d399]" />
              آژانس
            </div>
            <div className="font-num font-black text-[#34d399]">{faMoney(sums.agency)}</div>
          </div>
        </div>

        <SalesBarChart
          periods={periods}
          selectedPeriodKey={chart.periodKey}
          onSelectPeriod={chart.setPeriodKey}
        />
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
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <h1 className="mb-1 text-[20.5px] font-black text-white">مالی</h1>
      <p className="mb-6 text-sm text-[#6b7b94]">
        {isFinanceOps
          ? 'تراکنش‌ها، ترکیب درآمد و تسویه‌حساب آژانس‌های همکار'
          : 'نمای تحلیلی فروش و ترکیب درآمد'}
      </p>
      {isFinanceOps ? <FinanceOpsView /> : <FinanceAnalyticView />}
    </div>
  );
}
