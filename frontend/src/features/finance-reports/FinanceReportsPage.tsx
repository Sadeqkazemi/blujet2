import { useEffect, useMemo, useState } from 'react';
import {
  downloadFinanceReport,
  fetchFinanceFlightDetail,
  fetchFinanceReport,
  searchFinanceFlights,
  type FinanceReportFilters,
} from '../../api/finance-manager';
import type {
  FinanceFlightDetail,
  FinanceFlightRow,
  FinanceReportPeriod,
  FinanceReportResult,
  FinanceReportScope,
} from '../../types/finance-manager';
import { dayjs, formatJalaliDate } from '../../lib/jalali';
import { faDigits, faMoney, faMoneyCompact } from '../../lib/fa-format';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const PERIODS: { key: FinanceReportPeriod; label: string }[] = [
  { key: 'flight', label: 'پرواز' },
  { key: 'day', label: 'روزانه' },
  { key: 'month', label: 'ماهانه' },
  { key: 'q3', label: 'سه‌ماهه' },
  { key: 'q6', label: 'شش‌ماهه' },
  { key: 'year', label: 'سالانه' },
];

type TopTab = FinanceReportScope | 'FLIGHT_SEARCH';

function jalaliMonth(month: number) {
  return dayjs().calendar('jalali').month(month).startOf('month');
}

function rangeFor(period: FinanceReportPeriod, month: number, day: number): Pick<FinanceReportFilters, 'from' | 'to'> {
  const current = jalaliMonth(month);
  if (period === 'flight') return {};
  if (period === 'day') {
    const start = current.date(day).calendar('gregory').startOf('day');
    return { from: start.toISOString(), to: start.add(1, 'day').toISOString() };
  }
  if (period === 'month') {
    const start = current.calendar('gregory');
    return { from: start.toISOString(), to: current.add(1, 'month').calendar('gregory').toISOString() };
  }
  const months = period === 'q3' ? 3 : period === 'q6' ? 6 : 12;
  const end = dayjs().calendar('jalali').add(1, 'day').calendar('gregory').startOf('day');
  return { from: dayjs().calendar('jalali').subtract(months, 'month').calendar('gregory').startOf('day').toISOString(), to: end.toISOString() };
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-16 text-center text-xs text-[#6b7b94]">{text}</div>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-xs text-[#f87171]">
      <span>دریافت گزارش ناموفق بود.</span>
      <button type="button" onClick={onRetry} className="rounded-lg border border-[#f8717144] px-4 py-2 font-bold">تلاش دوباره</button>
    </div>
  );
}

function ExportButtons({ onExport, busy }: { onExport: (format: 'csv' | 'excel') => void; busy: string | null }) {
  return (
    <div className="flex gap-2" dir="ltr">
      <button type="button" disabled={Boolean(busy)} onClick={() => onExport('excel')} className="rounded-[10px] bg-[#4f7ff0] px-4 py-2.5 text-[11px] font-extrabold text-white disabled:opacity-50">
        {busy === 'excel' ? 'در حال ساخت…' : 'خروجی Excel'}
      </button>
      <button type="button" disabled={Boolean(busy)} onClick={() => onExport('csv')} className="rounded-[10px] border border-[#2b3852] bg-[#18223a] px-4 py-2.5 text-[11px] font-extrabold text-white disabled:opacity-50">
        {busy === 'csv' ? 'در حال ساخت…' : 'خروجی CSV'}
      </button>
    </div>
  );
}

function CalendarPicker({ month, day, onMonth, onDay }: { month: number; day: number; onMonth: (value: number) => void; onDay: (value: number) => void }) {
  const days = jalaliMonth(month).daysInMonth();
  return (
    <div className="rounded-[14px] border border-[#28344c] bg-[#18223a] p-3">
      <div className="mb-3 grid grid-cols-[1fr_72px] gap-2">
        <select value={month} onChange={(event) => onMonth(Number(event.target.value))} className="rounded-lg border border-[#30405f] bg-[#141d2e] px-3 py-2 text-xs text-white">
          {MONTHS.map((name, index) => <option key={name} value={index}>{name}</option>)}
        </select>
        <span className="rounded-lg border border-[#30405f] bg-[#141d2e] px-3 py-2 text-center text-xs text-white">{faDigits(jalaliMonth(month).format('YYYY'))}</span>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[9px] text-[#6b7b94]">{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((name) => <span key={name}>{name}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: days }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" onClick={() => onDay(value)} className={`h-7 rounded-md text-[10px] ${day === value ? 'border border-[#5b8cff] bg-[#263f70] text-white' : 'border border-[#28344c] text-[#9fb0c7] hover:bg-white/5'}`}>
            {faDigits(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthPicker({ selected, onSelect }: { selected: number; onSelect: (month: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {MONTHS.map((month, index) => (
        <button key={month} type="button" onClick={() => onSelect(index)} className={`rounded-[10px] border px-4 py-3 text-xs font-bold ${selected === index ? 'border-[#4f7ff0] bg-[#4f7ff0] text-white' : 'border-[#2b3852] bg-[#18223a] text-[#9fb0c7]'}`}>
          {month}
        </button>
      ))}
    </div>
  );
}

function PartnerTable({ result }: { result: Extract<FinanceReportResult, { kind: 'partners' }> }) {
  if (!result.rows.length) return <EmptyState text="در این بازه گزارشی ثبت نشده است." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-right text-xs">
        <thead className="text-[10px] text-[#6b7b94]"><tr><th className="px-4 py-3">نام</th><th className="px-4 py-3">فروش کل</th><th className="px-4 py-3">پرداخت‌شده</th><th className="px-4 py-3">مانده</th></tr></thead>
        <tbody>{result.rows.map((row) => (
          <tr key={row.id} className="border-t border-[#222e43] text-white">
            <td className="px-4 py-4 font-extrabold">{row.name}</td>
            <td className="font-num px-4 py-4">{faMoney(row.totalIrr)} تومان</td>
            <td className="font-num px-4 py-4">{faMoney(row.paidIrr)} تومان</td>
            <td className={`font-num px-4 py-4 font-bold ${BigInt(row.outstandingIrr) > 0n ? 'text-[#f59e0b]' : 'text-[#34d399]'}`}>{BigInt(row.outstandingIrr) > 0n ? `${faMoney(row.outstandingIrr)} تومان` : 'تسویه‌شده'}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function FlightTable({
  rows,
  onSelect,
  rich,
  summary,
  period,
}: {
  rows: FinanceFlightRow[];
  onSelect?: (row: FinanceFlightRow) => void;
  rich?: boolean;
  summary?: { totalIrr: string; soldSeats: number };
  period?: FinanceReportPeriod;
}) {
  if (!rows.length) return <EmptyState text="پروازی در بازه انتخاب‌شده وجود ندارد." />;
  const periodLabel =
    period === 'day'
      ? 'روزانه'
      : period === 'month'
        ? 'ماهانه'
        : period === 'q3'
          ? 'سه‌ماهه'
          : period === 'q6'
            ? 'شش‌ماهه'
            : period === 'year'
              ? 'سالانه'
              : 'پرواز';
  return (
    <div>
      {summary && rich && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222e43] px-5 py-4">
          <div>
            <div className="text-[10px] text-[#6b7b94]">جمع فروش مشتریان — {periodLabel}</div>
            <div className="font-num mt-1 text-lg font-black text-white">
              {faMoneyCompact(summary.totalIrr)} تومان
            </div>
          </div>
          <div className="text-[11px] text-[#9fb0c7]">
            صندلی فروخته‌شده:{' '}
            <span className="font-num font-bold text-white">{faDigits(summary.soldSeats)}</span>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className={`w-full text-right text-xs ${rich ? 'min-w-[980px]' : 'min-w-[820px]'}`}>
          <thead className="text-[10px] text-[#6b7b94]">
            <tr>
              <th className="px-4 py-3">شماره پرواز</th>
              <th className="px-4 py-3">مسیر</th>
              <th className="px-4 py-3">تاریخ</th>
              <th className="px-4 py-3">فروش مشتریان</th>
              {rich ? (
                <>
                  <th className="px-4 py-3">عادی</th>
                  <th className="px-4 py-3">آژانس</th>
                  <th className="px-4 py-3">فروخته‌نشده</th>
                </>
              ) : (
                <th className="px-4 py-3">صندلی فروخته‌شده</th>
              )}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const direct = Math.max(0, row.soldSeats - row.agencySeats);
              return (
                <tr key={row.flightInstanceId} className="border-t border-[#222e43] text-white">
                  <td className="font-num px-4 py-4 font-extrabold">{row.flightNo}</td>
                  <td className="px-4 py-4">
                    {row.originCityFa} ← {row.destCityFa}
                  </td>
                  <td className="px-4 py-4 text-[#9fb0c7]">{formatJalaliDate(row.departureAt)}</td>
                  <td className="font-num px-4 py-4">{faMoneyCompact(row.totalIrr)} تومان</td>
                  {rich ? (
                    <>
                      <td className="font-num px-4 py-4">{faDigits(direct)}</td>
                      <td className="font-num px-4 py-4">{faDigits(row.agencySeats)}</td>
                      <td className="font-num px-4 py-4 text-[#f59e0b]">{faDigits(row.unsoldSeats)}</td>
                    </>
                  ) : (
                    <td className="font-num px-4 py-4">{faDigits(row.soldSeats)}</td>
                  )}
                  <td className="px-4 py-4">
                    {onSelect && (
                      <button
                        type="button"
                        onClick={() => onSelect(row)}
                        className="rounded-lg border border-[#31518a] px-3 py-1.5 text-[#7da7ff]"
                      >
                        جزئیات
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FinanceReportsPage() {
  const nowJalali = dayjs().calendar('jalali');
  const [tab, setTab] = useState<TopTab>('AGENCIES');
  const [period, setPeriod] = useState<FinanceReportPeriod>('month');
  const [month, setMonth] = useState(nowJalali.month());
  const [day, setDay] = useState(nowJalali.date());
  const [result, setResult] = useState<FinanceReportResult | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchRows, setSearchRows] = useState<FinanceFlightRow[] | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<FinanceFlightDetail | null>(null);

  const filters = useMemo<FinanceReportFilters | null>(() => {
    if (tab === 'FLIGHT_SEARCH') return null;
    return { scope: tab, period: tab === 'CUSTOMERS' ? period : 'month', ...rangeFor(tab === 'CUSTOMERS' ? period : 'month', month, day) };
  }, [tab, period, month, day]);

  useEffect(() => {
    if (!filters) return;
    let active = true;
    setResult(null);
    setError(false);
    fetchFinanceReport(filters).then((data) => active && setResult(data)).catch(() => active && setError(true));
    return () => { active = false; };
  }, [filters, reload]);

  useEffect(() => {
    if (tab !== 'FLIGHT_SEARCH') return;
    let active = true;
    setSearchRows(null);
    searchFinanceFlights({ q: query.trim() || undefined, ...rangeFor('month', month, day) })
      .then((data) => active && setSearchRows(data.rows))
      .catch(() => active && setSearchRows([]));
    return () => { active = false; };
  }, [tab, query, month, day]);

  async function onExport(format: 'csv' | 'excel') {
    if (!filters) return;
    setExportBusy(format);
    try {
      const blob = await downloadFinanceReport(filters, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-report.${format === 'csv' ? 'csv' : 'xls'}`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportBusy(null);
    }
  }

  async function selectFlight(row: FinanceFlightRow) {
    setSelectedFlight(null);
    setSelectedFlight(await fetchFinanceFlightDetail(row.flightInstanceId));
  }

  const title = tab === 'AGENCIES' ? 'گزارش فروش و پرداخت آژانس‌ها' : tab === 'CHARTERS' ? 'گزارش فروش و پرداخت چارترکنندگان' : tab === 'CUSTOMERS' ? 'گزارش فروش مشتریان' : 'جستجوی گزارش پرواز';

  return (
    <div dir="rtl" className="min-h-full bg-[#0f1623] px-6 py-5 text-[#e7ecf3] lg:px-8" data-testid="finance-reports-page">
      <header className="mb-7 text-right">
        <h1 className="text-2xl font-black text-white">گزارشات و خروجی</h1>
        <p className="mt-1 text-[11px] text-[#6b7b94]">خروجی Excel و CSV از فروش آژانس‌ها، چارترها و مشتریان</p>
      </header>

      <div className="mb-4 flex justify-end">
        <div className="flex rounded-[12px] border border-[#28344c] bg-[#18223a] p-1">
          {([['AGENCIES', 'آژانس‌ها'], ['CHARTERS', 'چارترها'], ['CUSTOMERS', 'مشتریان'], ['FLIGHT_SEARCH', 'جستجوی پرواز']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-[9px] px-5 py-2.5 text-xs font-bold ${tab === key ? 'bg-[#4f7ff0] text-white' : 'text-[#9fb0c7]'}`}>{label}</button>
          ))}
        </div>
      </div>

      {tab !== 'FLIGHT_SEARCH' ? (
        <>
          <section className="rounded-[15px] border border-[#222e43] bg-[#141d2e]">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div><h2 className="text-base font-extrabold text-white">{title}</h2><p className="mt-1 text-[10px] text-[#6b7b94]">اطلاعات ثبت‌شده و قطعی سامانه</p></div>
              <ExportButtons onExport={onExport} busy={exportBusy} />
            </div>
            {tab === 'CUSTOMERS' && (
              <div className="flex justify-end px-5 pb-4"><div className="flex rounded-[11px] border border-[#28344c] bg-[#18223a] p-1">{PERIODS.map((item) => <button key={item.key} type="button" onClick={() => setPeriod(item.key)} className={`rounded-[8px] px-4 py-2 text-[11px] font-bold ${period === item.key ? 'bg-[#4f7ff0] text-white' : 'text-[#9fb0c7]'}`}>{item.label}</button>)}</div></div>
            )}
            <div className="border-t border-[#222e43]">
              {error ? (
                <ErrorState onRetry={() => setReload((value) => value + 1)} />
              ) : !result ? (
                <EmptyState text="در حال دریافت گزارش…" />
              ) : result.kind === 'partners' ? (
                <PartnerTable result={result} />
              ) : (
                <FlightTable
                  rows={result.rows}
                  onSelect={selectFlight}
                  rich={tab === 'CUSTOMERS'}
                  summary={result.summary}
                  period={result.period}
                />
              )}
            </div>
          </section>

          {tab === 'CUSTOMERS' && (period === 'day' || period === 'month') && (
            <section className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="rounded-[15px] border border-[#222e43] bg-[#141d2e] p-5">
                <div className="mb-4">
                  <h2 className="text-base font-extrabold text-white">
                    {period === 'day' ? 'انتخاب روز' : 'انتخاب ماه'}
                  </h2>
                  <p className="mt-1 text-[10px] text-[#6b7b94]">
                    {period === 'day'
                      ? 'یک روز را از تقویم انتخاب کنید تا گزارش کامل پروازهای آن روز نمایش داده شود.'
                      : 'یک ماه را انتخاب کنید تا جزئیات فروش پروازهای همان ماه نمایش داده شود.'}
                  </p>
                </div>
                {period === 'month' ? (
                  <MonthPicker selected={month} onSelect={setMonth} />
                ) : (
                  <CalendarPicker month={month} day={day} onMonth={setMonth} onDay={setDay} />
                )}
              </div>
              <div className="rounded-[15px] border border-[#222e43] bg-[#141d2e] p-5">
                <h2 className="mb-2 text-base font-extrabold text-white">خلاصه بازه</h2>
                {result?.kind === 'customers' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#26334b] bg-[#111a2b] p-4">
                      <span className="block text-[10px] text-[#6b7b94]">فروش مشتریان</span>
                      <strong className="font-num mt-2 block text-lg text-white">
                        {faMoneyCompact(result.summary.totalIrr)} تومان
                      </strong>
                    </div>
                    <div className="rounded-xl border border-[#26334b] bg-[#111a2b] p-4">
                      <span className="block text-[10px] text-[#6b7b94]">صندلی فروخته‌شده</span>
                      <strong className="font-num mt-2 block text-lg text-white">
                        {faDigits(result.summary.soldSeats)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <EmptyState text="در حال دریافت خلاصه…" />
                )}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="grid gap-4 rounded-[15px] border border-[#222e43] bg-[#141d2e] p-4 lg:grid-cols-[260px_1fr]">
            <CalendarPicker month={month} day={day} onMonth={setMonth} onDay={setDay} />
            <div>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی شماره پرواز یا مسیر…" className="mb-3 w-full rounded-[11px] border border-[#2b3852] bg-[#18223a] px-4 py-3 text-xs text-white outline-none focus:border-[#4f7ff0]" />
              {!searchRows ? <EmptyState text="در حال جستجو…" /> : searchRows.length === 0 ? <EmptyState text="پرواز منطبق پیدا نشد." /> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{searchRows.map((row) => <button key={row.flightInstanceId} type="button" onClick={() => void selectFlight(row)} className={`rounded-[12px] border p-4 text-right ${selectedFlight?.summary.flightInstanceId === row.flightInstanceId ? 'border-[#4f7ff0] bg-[#4f7ff0] text-white' : 'border-[#2b3852] bg-[#111a2b]'}`}><strong className="font-num block text-sm">{row.flightNo}</strong><span className="mt-1 block text-[11px]">{row.originCityFa} ← {row.destCityFa}</span><span className="font-num mt-1 block text-[9px] opacity-70">{formatJalaliDate(row.departureAt)} · {faDigits(row.soldSeats)} صندلی</span></button>)}</div>}
            </div>
          </section>
          {selectedFlight && (
            <section className="mt-4 rounded-[15px] border border-[#222e43] bg-[#141d2e] p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold">گزارش پرواز {selectedFlight.summary.flightNo} — {selectedFlight.summary.originCityFa} ← {selectedFlight.summary.destCityFa}</h2>
                  <p className="mt-1 text-[10px] text-[#6b7b94]">تفکیک فروش و بدهی آژانس‌ها</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExportButtons
                    busy={exportBusy}
                    onExport={(format) => {
                      const headers = ['نام آژانس', 'تعداد صندلی', 'مبلغ فروش', 'پرداخت‌شده', 'بدهی'];
                      const bodyRows = selectedFlight.agencies.map((a) => [
                        a.agencyName,
                        String(a.soldSeats),
                        String(a.salesIrr),
                        String(a.paidIrr),
                        String(a.outstandingIrr),
                      ]);
                      const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/></head><body><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
                      const blob =
                        format === 'csv'
                          ? new Blob(
                              [
                                '\ufeff' +
                                  [headers.join(','), ...bodyRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join(
                                    '\n',
                                  ),
                              ],
                              { type: 'text/csv;charset=utf-8' },
                            )
                          : new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `flight-${selectedFlight.summary.flightNo}.${format === 'csv' ? 'csv' : 'xls'}`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                  <span className="font-num text-lg font-black">{faMoney(selectedFlight.summary.totalIrr)} تومان</span>
                </div>
              </div>
              <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[['مسافران عادی', selectedFlight.summary.soldSeats - selectedFlight.summary.agencySeats], ['صندلی آژانس‌ها', selectedFlight.summary.agencySeats], ['تعداد آژانس‌ها', selectedFlight.summary.agencyCount], ['صندلی فروش‌نرفته', selectedFlight.summary.unsoldSeats]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#26334b] bg-[#111a2b] p-4"><span className="block text-[10px] text-[#6b7b94]">{label}</span><strong className="font-num mt-2 block text-lg text-white">{faDigits(value)}</strong></div>)}</div>
              {selectedFlight.agencies.length === 0 ? <EmptyState text="این پرواز فروش آژانسی ندارد." /> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right text-xs"><thead className="text-[10px] text-[#6b7b94]"><tr><th className="p-3">نام آژانس</th><th className="p-3">تعداد صندلی</th><th className="p-3">مبلغ فروش</th><th className="p-3">پرداخت‌شده</th><th className="p-3">بدهی</th></tr></thead><tbody>{selectedFlight.agencies.map((agency) => <tr key={agency.agencyId} className="border-t border-[#222e43]"><td className="p-3 font-bold">{agency.agencyName}</td><td className="font-num p-3">{faDigits(agency.soldSeats)}</td><td className="font-num p-3">{faMoney(agency.salesIrr)} تومان</td><td className="font-num p-3 text-[#34d399]">{faMoney(agency.paidIrr)} تومان</td><td className="font-num p-3 text-[#f59e0b]">{faMoney(agency.outstandingIrr)} تومان</td></tr>)}</tbody></table></div>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
