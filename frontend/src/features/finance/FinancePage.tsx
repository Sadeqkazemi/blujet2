import type { CSSProperties } from 'react';
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
import { fetchReconciliationQueue, resolveReconciliation } from '../../api/reconciliation';
import { faDigits, faMoney, faPercent } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import SalesBarChart from '../../components/SalesBarChart';
import SalesChartControls from '../../components/SalesChartControls';
import {
  StaffAlert,
  StaffFlightsSummaryGrid,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
  StaffPrimaryButton,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import { staffCard, staffInnerTile, staffInput, staffStatusStyle } from '../../lib/staff-panel-styles';
import { useSalesChartQuery } from '../../hooks/useSalesChartQuery';
import type {
  AgencySettlementsResult,
  CompletedFlightsSummary,
  KpiResult,
  LowSalesAlert,
  RecentTransactionsResult,
  RevenueMixResult,
  SalesChartPeriod,
  SettlementStatus,
} from '../../types/reporting';
import type { ReconciliationItem } from '../../types/reconciliation';

const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  SETTLED: { label: 'تسویه شد', tone: 'success' },
  PENDING: { label: 'در انتظار پرداخت', tone: 'warning' },
  OVERDUE: { label: 'معوق', tone: 'danger' },
};

const MIX_COLORS: Record<string, string> = {
  SYSTEM: '#3b82f6',
  CHARTER: '#a855f7',
  AGENCY: '#34d399',
};

const TX_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

const TX_ICON: Record<string, { bg: string; color: string }> = {
  SALE: { bg: STAFF_PANEL.accentSoft, color: STAFF_PANEL.accent },
  SETTLEMENT: { bg: 'rgba(52,211,153,0.12)', color: STAFF_PANEL.success },
  COMMISSION: { bg: 'rgba(245,158,11,0.12)', color: STAFF_PANEL.warning },
  REFUND: { bg: 'rgba(248,113,113,0.12)', color: STAFF_PANEL.danger },
};

function trendLabel(pct: number): string {
  if (pct === 0) return '۰٪';
  return `${pct > 0 ? '+' : '−'}${faDigits(Math.abs(pct))}٪`;
}

function RevenueMixCard({ mix }: { mix: RevenueMixResult }) {
  const [c0, c1] = [mix.channels[0]?.pct ?? 0, (mix.channels[0]?.pct ?? 0) + (mix.channels[1]?.pct ?? 0)];
  const gradient = `conic-gradient(${MIX_COLORS.SYSTEM} 0% ${c0}%, ${MIX_COLORS.CHARTER} ${c0}% ${c1}%, ${MIX_COLORS.AGENCY} ${c1}% 100%)`;
  return (
    <StaffPanelCard title="ترکیب درآمد" subtitle="بر اساس کانال فروش">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            width: 144,
            height: 144,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: gradient,
          }}
          role="img"
          aria-label="نمودار ترکیب درآمد"
        >
          <div
            style={{
              display: 'flex',
              width: 88,
              height: 88,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: STAFF_PANEL.cardBg,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>{faMoney(mix.totalIrr)}</span>
            <span style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>کل (تومان)</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mix.channels.map((c) => (
          <div key={c.channel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: STAFF_PANEL.text }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: MIX_COLORS[c.channel] }} />
              {c.labelFa}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800 }}>{faMoney(c.amountIrr)}</span>
              <span
                style={{
                  borderRadius: 20,
                  background: STAFF_PANEL.inputBg,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: STAFF_PANEL.textMuted,
                }}
              >
                {faPercent(c.pct)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </StaffPanelCard>
  );
}

function LowSalesBanner({ alerts }: { alerts: LowSalesAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
      {alerts.map((a) => (
        <div
          key={`${a.flightNo}-${a.departureAt}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderRadius: 14,
            border: '1px solid rgba(245,158,11,0.35)',
            background: 'rgba(245,158,11,0.08)',
            padding: 14,
          }}
        >
          <span
            style={{
              display: 'flex',
              width: 36,
              height: 36,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              background: 'rgba(245,158,11,0.16)',
              color: STAFF_PANEL.warning,
            }}
          >
            ⚠
          </span>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 900, color: STAFF_PANEL.warning }}>هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز</div>
            <div style={{ color: STAFF_PANEL.navMuted }}>
              پرواز <span dir="ltr">{a.flightNo}</span> {a.originCode} ← {a.destCode} ({formatJalaliDate(a.departureAt)}) تنها{' '}
              {faDigits(a.soldSeats)} از {faDigits(a.capacity)} صندلی فروخته شده است.
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
    <StaffPanelCard
      title="صف مغایرت‌های پرداخت"
      subtitle="پرداخت‌هایی که با موفقیت انجام شده‌اند اما صدور بلیط آن‌ها کامل نشده است"
      headerAction={
        <span style={{ ...staffStatusStyle('danger'), padding: '4px 12px' }}>{faDigits(items.length)} مورد</span>
      }
      style={{ marginBottom: 24 }}
    >
      {items.length === 0 && <p style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>موردی برای بررسی وجود ندارد.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div key={item.id} data-testid="reconciliation-item" style={{ ...staffInnerTile, padding: '12px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
              <div style={{ minWidth: 110, fontSize: 11 }}>
                <div style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>کد رزرو</div>
                <div style={{ fontWeight: 900, color: STAFF_PANEL.text }}>{item.pnr}</div>
              </div>
              <div style={{ minWidth: 110, fontSize: 11 }}>
                <div style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>شناسه درگاه</div>
                <div style={{ fontWeight: 800 }}>{item.gatewayRefId}</div>
              </div>
              <div style={{ minWidth: 110, fontSize: 11 }}>
                <div style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>مبلغ</div>
                <div style={{ fontWeight: 800 }}>{faMoney(item.amountIrr)} تومان</div>
              </div>
              <div style={{ minWidth: 110, fontSize: 11 }}>
                <div style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>تاریخ</div>
                <div>{formatJalaliDateTime(item.createdAt)}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenId(openId === item.id ? null : item.id);
                  setError(null);
                  setNote('');
                }}
                style={{
                  marginRight: 'auto',
                  borderRadius: 10,
                  border: `1px solid ${STAFF_PANEL.accent}`,
                  background: STAFF_PANEL.accentSoft,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: STAFF_PANEL.accent,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                رفع مغایرت
              </button>
            </div>
            {openId === item.id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}` }}>
                {error && (
                  <p role="alert" style={{ fontSize: 11, color: STAFF_PANEL.danger }}>
                    {error}
                  </p>
                )}
                <textarea
                  data-testid="reconciliation-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="توضیح رفع مغایرت (مثلاً: بلیط دستی صادر و مغایرت رفع شد.)"
                  style={{ ...staffInput, width: '100%', padding: 8, fontSize: 11, boxSizing: 'border-box' }}
                  rows={2}
                />
                <StaffPrimaryButton
                  onClick={() => void submit(item.id)}
                  disabled={busy}
                  style={{ marginTop: 8 }}
                >
                  {busy ? 'در حال ثبت…' : 'ثبت رفع مغایرت'}
                </StaffPrimaryButton>
              </div>
            )}
          </div>
        ))}
      </div>
    </StaffPanelCard>
  );
}

function FinanceOpsView() {
  const chart = useSalesChartQuery({ includeFlightMode: false });
  const [kpis, setKpis] = useState<KpiResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);
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

  if (error) return <StaffAlert tone="error">{error}</StaffAlert>;
  if (!chart.isQueryReady || !kpis || !flights || !tx || !mix || !settlements || !reconciliation)
    return <p style={{ fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>;

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

  return (
    <>
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>بازهٔ گزارش:</span>
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
          dark
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StaffKpiCard label={`کل درآمد · ${periodLabel}`} value={faMoney(kpis.revenueIrr)} trend={trendLabel(kpis.trends.revenuePct)} trendUp={kpis.trends.revenuePct >= 0} iconColor={STAFF_PANEL.success} />
        <StaffKpiCard label={`سود خالص · حاشیه ${faPercent(kpis.marginPct)}`} value={faMoney(kpis.profitIrr)} trend={trendLabel(kpis.trends.profitPct)} trendUp={kpis.trends.profitPct >= 0} iconColor={STAFF_PANEL.accent} />
        <StaffKpiCard label="هزینه عملیاتی" value={faMoney(kpis.operatingCostIrr)} trend={trendLabel(kpis.trends.operatingCostPct)} trendUp={kpis.trends.operatingCostPct <= 0} iconColor={STAFF_PANEL.warning} />
        <StaffKpiCard label="مطالبات معوق آژانس‌ها" value={faMoney(kpis.agencyDebtIrr)} sublabel={`${faDigits(kpis.agencyDebtCount)} آژانس`} iconColor={STAFF_PANEL.danger} />
      </div>

      <LowSalesBanner alerts={alerts} />
      <ReconciliationQueueCard items={reconciliation} onResolve={onResolveReconciliation} />

      <StaffPanelCard title="پروازهای انجام‌شده" style={{ marginBottom: 24 }} padding={0}>
        <StaffFlightsSummaryGrid
          flightCount={flights.flightCount}
          totalSeats={flights.totalSeats}
          soldSeats={flights.soldSeats}
          unsoldSeats={flights.unsoldSeats}
        />
      </StaffPanelCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12, marginBottom: 24 }}>
        <StaffPanelCard
          title="تراکنش‌های مالی اخیر"
          subtitle="فروش، تسویه، کمیسیون و استرداد"
          headerAction={
            <span style={{ borderRadius: 10, background: STAFF_PANEL.inputBg, padding: '4px 10px', fontSize: 11, fontWeight: 800, color: STAFF_PANEL.textMuted }}>
              {faDigits(tx.totalCount)} تراکنش
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tx.rows.map((t, idx) => {
              const icon = TX_ICON[t.type] ?? { bg: STAFF_PANEL.inputBg, color: STAFF_PANEL.textMuted };
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    fontSize: 11,
                    borderTop: idx > 0 ? `1px solid ${STAFF_PANEL.sidebarBorder}` : undefined,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      background: icon.bg,
                      color: icon.color,
                      fontSize: 14,
                    }}
                  >
                    {t.type === 'REFUND' ? '↩' : t.type === 'COMMISSION' ? '₪' : '✓'}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, color: STAFF_PANEL.text }}>{t.titleFa}</div>
                    <div style={{ marginTop: 2, fontSize: 10, color: STAFF_PANEL.textMuted }}>
                      {t.party} · {formatJalaliDateTime(t.occurredAt)}
                    </div>
                  </div>
                  <span style={staffStatusStyle(TX_STATUS_TONE[t.statusTone] ?? 'warning')}>{t.statusFa}</span>
                  <span
                    style={{
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      color: Number(t.signedAmountIrr) >= 0 && t.type !== 'REFUND' ? STAFF_PANEL.success : STAFF_PANEL.danger,
                    }}
                  >
                    {Number(t.signedAmountIrr) >= 0 ? '+' : '−'} {faMoney(Math.abs(Number(t.signedAmountIrr)))}
                  </span>
                </div>
              );
            })}
          </div>
        </StaffPanelCard>
        <RevenueMixCard mix={mix} />
      </div>

      <StaffPanelCard
        title="تسویه‌حساب آژانس‌های همکار"
        subtitle="وضعیت پرداخت دوره‌ای و مطالبات معوق"
        headerAction={
          <span style={{ ...staffStatusStyle('danger'), padding: '4px 12px' }}>
            مجموع مطالبات: {faMoney(settlements.outstandingIrr)} تومان
          </span>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {settlements.rows.map((s) => {
            const st = SETTLEMENT_STATUS[s.status];
            const barColor = s.status === 'SETTLED' ? STAFF_PANEL.success : s.status === 'OVERDUE' ? STAFF_PANEL.danger : STAFF_PANEL.warning;
            return (
              <div key={s.agencyId} style={{ ...staffInnerTile, padding: '12px 14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: STAFF_PANEL.text }}>{s.agencyName}</div>
                    {s.dueAt && (
                      <div style={{ marginTop: 2, fontSize: 10, color: STAFF_PANEL.textMuted }}>سررسید: {formatJalaliDate(s.dueAt)}</div>
                    )}
                  </div>
                  <div style={{ minWidth: 110, fontSize: 11 }}>
                    <div style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>مبلغ دوره</div>
                    <div style={{ fontWeight: 800 }}>{faMoney(s.totalIrr)} تومان</div>
                  </div>
                  <div style={{ minWidth: 140, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: STAFF_PANEL.textMuted }}>
                      <span>پرداخت‌شده</span>
                      <span style={{ fontWeight: 900 }}>{faPercent(s.paidPct)}</span>
                    </div>
                    <div style={{ height: 6, overflow: 'hidden', borderRadius: 4, background: STAFF_PANEL.inputBg }}>
                      <div style={{ height: '100%', borderRadius: 4, background: barColor, width: `${s.paidPct}%` }} />
                    </div>
                  </div>
                  <span style={staffStatusStyle(st.tone)}>
                    {st.label}
                    {s.status === 'OVERDUE' && ` — ${faDigits(s.overdueDays)} روز`}
                  </span>
                  {s.remindInvoiceId && (
                    <button
                      type="button"
                      onClick={() => void onRemind(s.agencyId, s.remindInvoiceId!, s.agencyName)}
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${STAFF_PANEL.accent}`,
                        background: STAFF_PANEL.accentSoft,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: STAFF_PANEL.accent,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ارسال یادآوری
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </StaffPanelCard>
    </>
  );
}

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

  if (error) return <StaffAlert tone="error">{error}</StaffAlert>;
  if (!flights || !mix) return <p style={{ fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>;

  const sums = {
    system: periods.reduce((s, p) => s + Number(p.systemIrr), 0),
    charter: periods.reduce((s, p) => s + Number(p.charterIrr), 0),
    agency: periods.reduce((s, p) => s + Number(p.agencyIrr), 0),
  };

  return (
    <>
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StaffKpiCard label="کل درآمد" value={`${faMoney(kpis.revenueIrr)} تومان`} iconColor={STAFF_PANEL.success} />
          <StaffKpiCard label="سود خالص" value={`${faMoney(kpis.profitIrr)} تومان`} sublabel={`حاشیه ${faPercent(kpis.marginPct)}`} iconColor={STAFF_PANEL.accent} />
          <StaffKpiCard label="هزینه عملیاتی" value={`${faMoney(kpis.operatingCostIrr)} تومان`} iconColor={STAFF_PANEL.warning} />
          <StaffKpiCard label="مطالبات معوق آژانس‌ها" value={`${faMoney(kpis.agencyDebtIrr)} تومان`} sublabel={`${faDigits(kpis.agencyDebtCount)} آژانس`} iconColor={STAFF_PANEL.danger} />
        </div>
      )}

      <StaffPanelCard title="نمودار فروش" subtitle="به تفکیک کانال فروش · تومان" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
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
            dark
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {(
            [
              ['سیستمی', sums.system, MIX_COLORS.SYSTEM],
              ['چارتر', sums.charter, MIX_COLORS.CHARTER],
              ['آژانس', sums.agency, MIX_COLORS.AGENCY],
            ] as const
          ).map(([label, amount, color]) => (
            <div key={label} style={staffInnerTile}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 10, color: STAFF_PANEL.textMuted }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                {label}
              </div>
              <div style={{ fontWeight: 900, color }}>{faMoney(amount)}</div>
            </div>
          ))}
        </div>

        <SalesBarChart periods={periods} selectedPeriodKey={chart.periodKey} onSelectPeriod={chart.setPeriodKey} dark />
      </StaffPanelCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12 }}>
        <StaffPanelCard title="پروازهای انجام‌شده" padding={0}>
          <StaffFlightsSummaryGrid
            flightCount={flights.flightCount}
            totalSeats={flights.totalSeats}
            soldSeats={flights.soldSeats}
            unsoldSeats={flights.unsoldSeats}
          />
        </StaffPanelCard>
        <RevenueMixCard mix={mix} />
      </div>
    </>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const isFinanceOps = user?.role === 'FINANCE_MANAGER';

  return (
    <div style={{ padding: '24px 28px' }}>
      <StaffPanelPageHeader
        title="مالی"
        subtitle={
          isFinanceOps
            ? 'تراکنش‌ها، ترکیب درآمد و تسویه‌حساب آژانس‌های همکار'
            : 'نمای تحلیلی فروش و ترکیب درآمد'
        }
      />
      {isFinanceOps ? <FinanceOpsView /> : <FinanceAnalyticView />}
    </div>
  );
}
