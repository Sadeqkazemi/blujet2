import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchFinanceSummary,
  fetchFinanceTransactions,
  fetchSettlements,
  remindSettlement,
} from '../../api/finance';
import { fetchLowSalesAlerts, fetchSalesChart } from '../../api/reporting';
import { faDigits, faMoney, latinDigits } from '../../lib/fa-format';
import {
  dayjs,
  formatJalaliDate,
  formatJalaliMonthYear,
  parseJalaliDateToIso,
} from '../../lib/jalali';
import SalesBarChart from '../../components/SalesBarChart';
import type { LowSalesAlert, PeriodQuery, SalesChartPeriod } from '../../types/reporting';
import type {
  FinanceSummary,
  FinanceTransaction,
  SettlementsResult,
} from '../../types/finance';

type Mode = 'q6' | 'month' | 'day' | 'flight';

const MODE_LABELS: Record<Mode, string> = {
  q6: '۶ ماه',
  month: 'ماه',
  day: 'روز',
  flight: 'پرواز',
};

const DONUT_META = [
  { key: 'SYSTEM', label: 'سیستمی', color: '#1668c4' },
  { key: 'CHARTER', label: 'چارتر', color: '#a855f7' },
  { key: 'AGENCY', label: 'آژانس', color: '#059669' },
] as const;

const SETTLE_META = {
  SETTLED: { label: 'تسویه شد', className: 'bg-[#10b98124] text-[#059669]' },
  PENDING: { label: 'در انتظار پرداخت', className: 'bg-[#f59e0b24] text-[#b45309]' },
  OVERDUE: { label: 'معوق', className: 'bg-[#f8717124] text-[#dc2626]' },
} as const;

/** Last six Jalali months as chips for the ماه mode. */
function monthChips(): { label: string; periodStart: string }[] {
  const chips: { label: string; periodStart: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const m = dayjs().subtract(i, 'month');
    const startUtc = new Date(Date.UTC(m.year(), m.month(), 1));
    chips.push({
      label: formatJalaliMonthYear(m.toDate()),
      periodStart: startUtc.toISOString(),
    });
  }
  return chips;
}

export default function FinancePage() {
  const { user } = useAuth();
  const isFinance = user?.role === 'FINANCE_MANAGER';

  const [mode, setMode] = useState<Mode>('q6');
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [monthStart, setMonthStart] = useState<string | null>(null);
  const [dayInput, setDayInput] = useState('');
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [flightInput, setFlightInput] = useState('');
  const [flightNo, setFlightNo] = useState<string | null>(null);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [chart, setChart] = useState<SalesChartPeriod[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [settlements, setSettlements] = useState<SettlementsResult | null>(null);
  const [alerts, setAlerts] = useState<LowSalesAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query: PeriodQuery | null = useMemo(() => {
    if (mode === 'q6') return { granularity: 'q6', periodKey: periodKey ?? undefined };
    if (mode === 'month')
      return monthStart
        ? { granularity: 'month', periodStart: monthStart, periodKey: periodKey ?? undefined }
        : null;
    if (mode === 'day') return dayIso ? { granularity: 'day', date: dayIso } : null;
    return flightNo ? { granularity: 'flight', flightNo } : null;
  }, [mode, periodKey, monthStart, dayIso, flightNo]);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchFinanceSummary(query), fetchSalesChart(query)])
      .then(([s, c]) => {
        if (cancelled) return;
        setSummary(s);
        setChart(c);
        setError(null);
      })
      .catch(() => !cancelled && setError('خطا در دریافت اطلاعات مالی.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loadFinanceOnly = useCallback(() => {
    if (!isFinance) return;
    fetchFinanceTransactions().then(setTransactions).catch(() => setTransactions([]));
    fetchSettlements().then(setSettlements).catch(() => setSettlements(null));
    fetchLowSalesAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, [isFinance]);

  useEffect(() => {
    loadFinanceOnly();
  }, [loadFinanceOnly]);

  function switchMode(next: Mode) {
    setMode(next);
    setPeriodKey(null);
    if (next !== 'month') setMonthStart(null);
  }

  async function onRemind(id: string) {
    try {
      const r = await remindSettlement(id);
      setNotice(`یادآوری تسویه برای «${r.agencyName}» ارسال شد ✓`);
    } catch {
      setError('خطا در ارسال یادآوری.');
    }
  }

  const kpis = summary?.kpis;
  const donutTotal = summary
    ? summary.donut.SYSTEM + summary.donut.CHARTER + summary.donut.AGENCY
    : 0;
  const periodCaption =
    mode === 'q6'
      ? periodKey
        ? `ماه ${formatJalaliDate(periodKey)}`
        : '۶ ماه اخیر'
      : mode === 'month'
        ? periodKey
          ? `روز ${formatJalaliDate(periodKey)}`
          : monthStart
            ? formatJalaliMonthYear(monthStart)
            : 'ماه را انتخاب کنید'
        : mode === 'day'
          ? dayIso
            ? `روز ${formatJalaliDate(dayIso)}`
            : 'روز را انتخاب کنید'
          : flightNo
            ? `پرواز ${flightNo}`
            : 'شماره پرواز را جستجو کنید';

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">مالی</h1>
          <p className="mt-1 text-sm text-muted">
            نمودار فروش، شاخص‌های مالی و ترکیب درآمد — همه به تفکیک دورهٔ انتخابی
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-white p-1">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                mode === m ? 'bg-accent text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      {mode === 'month' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {monthChips().map((c) => (
            <button
              key={c.periodStart}
              onClick={() => {
                setMonthStart(c.periodStart);
                setPeriodKey(null);
              }}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                monthStart === c.periodStart
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-white text-muted'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'day' && (
        <div className="mb-4 flex gap-2">
          <input
            aria-label="تاریخ روز (جلالی)"
            placeholder="۱۴۰۵/۰۴/۲۶"
            value={dayInput}
            onChange={(e) => setDayInput(e.target.value)}
            className="font-num h-10 w-44 rounded-lg border border-border bg-white px-3 text-xs outline-none"
          />
          <button
            onClick={() => {
              const iso = parseJalaliDateToIso(dayInput);
              if (!iso) {
                setError('تاریخ جلالی معتبر وارد کنید (مثلاً ۱۴۰۵/۰۴/۲۶).');
                return;
              }
              setError(null);
              setDayIso(iso.slice(0, 10));
            }}
            className="rounded-lg bg-accent px-4 text-xs font-bold text-white"
          >
            نمایش گزارش روز
          </button>
        </div>
      )}

      {mode === 'flight' && (
        <div className="mb-4 flex gap-2">
          <input
            aria-label="شماره پرواز"
            dir="ltr"
            placeholder="EP-821"
            value={flightInput}
            onChange={(e) => setFlightInput(e.target.value)}
            className="font-num h-10 w-44 rounded-lg border border-border bg-white px-3 text-xs outline-none"
          />
          <button
            onClick={() => setFlightNo(latinDigits(flightInput.trim()).toUpperCase() || null)}
            className="rounded-lg bg-accent px-4 text-xs font-bold text-white"
          >
            گزارش مالی پرواز
          </button>
        </div>
      )}

      {kpis && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="font-num text-sm font-black text-ink">{faMoney(kpis.revenueIrr)} تومان</div>
            <div className="mt-1 text-[11px] text-muted">کل درآمد · {periodCaption}</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="font-num text-sm font-black text-[#059669]">{faMoney(kpis.profitIrr)} تومان</div>
            <div className="mt-1 text-[11px] text-muted">
              سود خالص · حاشیه <span className="font-num">{faDigits(kpis.marginPct)}٪</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="font-num text-sm font-black text-[#b45309]">
              {faMoney(kpis.operatingCostIrr)} تومان
            </div>
            <div className="mt-1 text-[11px] text-muted">هزینه عملیاتی</div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="font-num text-sm font-black text-danger">
              {faMoney(kpis.agencyDebtIrr)} تومان
            </div>
            <div className="mt-1 text-[11px] text-muted">
              مطالبات معوق آژانس‌ها · <span className="font-num">{faDigits(kpis.agencyDebtCount)}</span> آژانس
            </div>
          </div>
        </div>
      )}

      {isFinance &&
        alerts.map((a) => (
          <div
            key={a.flightNo + a.departureAt}
            className="mb-4 rounded-xl border border-[#f59e0b55] bg-[#f59e0b12] p-3 text-[11px] leading-6"
          >
            <span className="font-bold text-[#b45309]">هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز: </span>
            <span className="text-ink">
              پرواز <span className="ltr font-num">{a.flightNo}</span> {a.originCode} ← {a.destCode} تنها{' '}
              {faDigits(a.soldSeats)} از {faDigits(a.capacity)} صندلی فروخته شده است.
            </span>
          </div>
        ))}

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">در حال بارگذاری…</p>
      ) : !query ? (
        <p className="rounded-xl border border-border bg-white p-6 text-center text-xs text-muted">
          {periodCaption}
        </p>
      ) : (
        <>
          {mode === 'day' && chart.length === 1 ? (
            <section className="mb-6 max-w-sm rounded-xl border border-border bg-white p-5">
              <h2 className="mb-1 text-sm font-bold text-ink">گزارش فروش روز</h2>
              <p className="font-num mb-4 text-xs text-muted">{formatJalaliDate(chart[0].periodKey)}</p>
              {DONUT_META.map((d) => (
                <div key={d.key} className="mb-2 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                    {d.label}
                  </span>
                  <span className="font-num font-bold text-ink">
                    {faMoney(
                      d.key === 'SYSTEM'
                        ? chart[0].systemIrr
                        : d.key === 'CHARTER'
                          ? chart[0].charterIrr
                          : chart[0].agencyIrr,
                    )}{' '}
                    تومان
                  </span>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="font-bold text-ink">مجموع روز</span>
                <span className="font-num font-black text-accent">
                  {faMoney(chart[0].systemIrr + chart[0].charterIrr + chart[0].agencyIrr)} تومان
                </span>
              </div>
            </section>
          ) : mode !== 'day' ? (
            <section className="mb-6 rounded-xl border border-border bg-white p-5">
              <h2 className="mb-3 text-sm font-bold text-ink">نمودار فروش</h2>
              <SalesBarChart
                periods={chart}
                selectedPeriodKey={periodKey}
                onSelectPeriod={setPeriodKey}
              />
            </section>
          ) : null}

          {summary && (
            <div className="mb-6 grid grid-cols-[1.4fr_1fr] gap-4">
              <section className="rounded-xl border border-border bg-white p-5">
                <h2 className="mb-3 text-sm font-bold text-ink">پروازهای انجام‌شده</h2>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg bg-surface p-3">
                    <div className="font-num text-lg font-black text-ink">
                      {faDigits(summary.seats.flightCount)}
                    </div>
                    <div className="text-[10px] text-muted">پرواز</div>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <div className="font-num text-lg font-black text-ink">
                      {faDigits(summary.seats.totalSeats)}
                    </div>
                    <div className="text-[10px] text-muted">مجموع صندلی</div>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <div className="font-num text-lg font-black text-[#059669]">
                      {faDigits(summary.seats.soldSeats)}
                    </div>
                    <div className="text-[10px] text-muted">فروخته‌شده</div>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <div className="font-num text-lg font-black text-danger">
                      {faDigits(summary.seats.unsoldSeats)}
                    </div>
                    <div className="text-[10px] text-muted">فروش‌نرفته</div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-white p-5">
                <h2 className="mb-1 text-sm font-bold text-ink">ترکیب درآمد</h2>
                <p className="mb-3 text-[11px] text-muted">بر اساس کانال فروش</p>
                {DONUT_META.map((d) => {
                  const value = summary.donut[d.key];
                  const pct = donutTotal > 0 ? Math.round((value / donutTotal) * 100) : 0;
                  return (
                    <div key={d.key} className="mb-2">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-2 text-muted">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                          {d.label}
                        </span>
                        <span className="font-num font-bold text-ink">
                          {faMoney(value)} تومان · {faDigits(pct)}٪
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded bg-surface-2">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          )}
        </>
      )}

      {isFinance && (
        <div className="grid grid-cols-[1.4fr_1fr] items-start gap-4">
          <section className="rounded-xl border border-border bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink">تراکنش‌های مالی اخیر</h2>
                <p className="mt-0.5 text-[11px] text-muted">فروش، تسویه، کمیسیون و استرداد</p>
              </div>
              <span className="font-num rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted">
                {faDigits(transactions.length)} تراکنش
              </span>
            </div>
            <ul className="divide-y divide-border">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink">{t.labelFa}</div>
                    <div className="mt-0.5 text-[10px] text-muted">
                      {t.party} · <span className="font-num">{formatJalaliDate(t.occurredAt)}</span>
                    </div>
                  </div>
                  <span
                    className={`font-num font-black ${t.direction === 'IN' ? 'text-[#059669]' : 'text-danger'}`}
                  >
                    {t.direction === 'IN' ? '+' : '−'} {faMoney(t.amountIrr)} تومان
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-white p-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-ink">تسویه‌حساب آژانس‌های همکار</h2>
              {settlements && (
                <p className="mt-1 text-[11px] font-bold text-danger">
                  مجموع مطالبات: <span className="font-num">{faMoney(settlements.outstandingIrr)}</span> تومان
                </p>
              )}
            </div>
            <ul className="flex flex-col gap-2.5">
              {settlements?.rows.map((s) => {
                const meta = SETTLE_META[s.status];
                return (
                  <li key={s.id} className="rounded-lg border border-border p-3 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink">{s.agencyName}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                        {meta.label}
                        {s.status === 'OVERDUE' ? ` — ${faDigits(s.overdueDays)} روز` : ''}
                      </span>
                    </div>
                    <div className="font-num mt-1 flex items-center justify-between text-muted">
                      <span>
                        {faMoney(s.amountIrr)} تومان · سررسید {formatJalaliDate(s.dueAt)}
                      </span>
                      {s.status !== 'SETTLED' && (
                        <button
                          onClick={() => void onRemind(s.id)}
                          className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent"
                        >
                          ارسال یادآوری
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
