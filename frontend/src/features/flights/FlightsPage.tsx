import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  changeFlightAircraft,
  createAllotment,
  createFlight,
  deleteAllotment,
  fetchAircraftTypes,
  fetchAirports,
  fetchAllotments,
  fetchFlightDetail,
  fetchFlightsOverview,
  planFlight,
  runFlightsAiAnalysis,
} from '../../api/flights';
import { fetchAgencies } from '../../api/agencies';
import { useStepUp } from '../../hooks/useStepUp';
import { faDigits, faMoney, latinDigits, parseTomanToRial } from '../../lib/fa-format';
import { dayjs, formatJalaliDateTime, parseJalaliDateToIso } from '../../lib/jalali';
import Modal from '../../components/Modal';
import FareRulesSection from '../../components/FareRulesSection';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import PricingPage from '../pricing/PricingPage';
import FlightCitiesTab from './FlightCitiesTab';
import type {
  AircraftTypeOption,
  AirportEntry,
  AllotmentRow,
  CompletedFlightRow,
  DerivedFlightStatus,
  FlightDetail,
  FlightsOverview,
  FutureFlightRow,
} from '../../types/flights';
import type { AgencyListRow } from '../../types/agencies';

const STATUS_META: Record<DerivedFlightStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'فعال', className: 'bg-[#34d39924] text-[#34d399]' },
  SELLING: { label: 'در حال فروش', className: 'bg-[#60a5fa2e] text-[#1d4ed8]' },
  FULL: { label: 'تکمیل', className: 'bg-[#f59e0b24] text-[#b45309]' },
  CANCELLED: { label: 'لغو شده', className: 'bg-[#f8717124] text-[#dc2626]' },
};

const CHANNEL_META = {
  SYSTEM: { label: 'فروش سیستمی', barClass: 'bg-accent' },
  CHARTER: { label: 'فروش چارتری', barClass: 'bg-[#a855f7]' },
  AGENCY: { label: 'فروش آژانس همکار', barClass: 'bg-[#34d399]' },
} as const;

function occupancyBarClass(pct: number) {
  if (pct >= 100) return 'bg-[#f59e0b]';
  if (pct >= 60) return 'bg-[#34d399]';
  return 'bg-[#60a5fa]';
}

const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export default function FlightsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<FlightsOverview | null>(null);
  const [airports, setAirports] = useState<AirportEntry[]>([]);
  const [subTab, setSubTab] = useState<'active' | 'done' | 'future' | 'cities'>('active');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    originCode: '',
    destCode: '',
    flightNo: '',
    date: '',
    time: '',
    capacity: '',
    priceToman: '',
  });
  const [addError, setAddError] = useState<string | null>(null);

  const [detail, setDetail] = useState<FlightDetail | null>(null);
  const [expandedDone, setExpandedDone] = useState<string | null>(null);

  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeOption[]>([]);
  const [aircraftChangeOpen, setAircraftChangeOpen] = useState(false);
  const [selectedAircraftType, setSelectedAircraftType] = useState('');
  const [aircraftChangeError, setAircraftChangeError] = useState<string | null>(null);
  const [aircraftChangeBusy, setAircraftChangeBusy] = useState(false);
  const aircraftStepUp = useStepUp('PRICE_CAPACITY_CHANGE');

  const [futureDay, setFutureDay] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [expandedFuture, setExpandedFuture] = useState<string | null>(null);
  const [plan, setPlan] = useState<FutureFlightRow | null>(null);
  const [planPrice, setPlanPrice] = useState('');
  const [planAgency, setPlanAgency] = useState('');
  const [planSaleStart, setPlanSaleStart] = useState<string | null>(null);
  const [planSaleEnd, setPlanSaleEnd] = useState<string | null>(null);

  const [allotments, setAllotments] = useState<AllotmentRow[]>([]);
  const [agencyOptions, setAgencyOptions] = useState<AgencyListRow[]>([]);
  const [newAllotmentAgencyId, setNewAllotmentAgencyId] = useState('');
  const [newAllotmentSeats, setNewAllotmentSeats] = useState('');
  const [newAllotmentType, setNewAllotmentType] = useState<'HARD' | 'SOFT'>('HARD');
  const [newAllotmentContractToman, setNewAllotmentContractToman] = useState('');
  const [newAllotmentReleaseAt, setNewAllotmentReleaseAt] = useState<string | null>(null);
  const [allotmentError, setAllotmentError] = useState<string | null>(null);

  const cityByCode = useMemo(
    () => new Map(airports.map((a) => [a.code, a.cityFa])),
    [airports],
  );
  const routeLabel = useCallback(
    (originCode: string, destCode: string) =>
      `${cityByCode.get(originCode) ?? originCode} ← ${cityByCode.get(destCode) ?? destCode}`,
    [cityByCode],
  );

  const load = useCallback(async () => {
    try {
      setData(await fetchFlightsOverview());
    } catch {
      setError('خطا در دریافت اطلاعات پروازها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, [load]);

  async function onSubmitAdd() {
    setAddError(null);
    const { originCode, destCode, flightNo, date, time, capacity, priceToman } = addForm;
    if (!originCode || !destCode || !flightNo || !date || !time || !capacity || !priceToman) {
      setAddError('لطفاً همه فیلدها را تکمیل کنید.');
      return;
    }
    const dateIso = parseJalaliDateToIso(date);
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(latinDigits(time.trim()));
    if (!dateIso || !timeMatch) {
      setAddError('تاریخ (۱۴۰۵/۰۴/۲۵) و ساعت (08:30) را درست وارد کنید.');
      return;
    }
    const basePriceIrr = parseTomanToRial(priceToman);
    if (basePriceIrr == null) {
      setAddError('قیمت بلیط را به تومان و با رقم وارد کنید.');
      return;
    }
    const departure = new Date(dateIso);
    departure.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    try {
      await createFlight({
        originCode,
        destCode,
        flightNo: latinDigits(flightNo.trim()).toUpperCase(),
        departureAt: departure.toISOString(),
        capacity: Number(latinDigits(capacity)),
        basePriceIrr,
      });
      setAddOpen(false);
      setNotice(`پرواز جدید «${routeLabel(originCode, destCode)}» اضافه شد ✓`);
      setSubTab('active');
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'خطا در ثبت پرواز.');
    }
  }

  async function openDetail(id: string) {
    setError(null);
    setAircraftChangeOpen(false);
    setAircraftChangeError(null);
    try {
      const d = await fetchFlightDetail(id);
      setDetail(d);
      setSelectedAircraftType(d.aircraftType);
    } catch {
      setError('خطا در دریافت جزئیات پرواز.');
    }
    if (aircraftTypes.length === 0) {
      try {
        setAircraftTypes(await fetchAircraftTypes());
      } catch {
        // silently unavailable — the change control just won't render options
      }
    }
  }

  async function onChangeAircraft() {
    if (!detail || !selectedAircraftType || selectedAircraftType === detail.aircraftType) return;
    setAircraftChangeError(null);
    setAircraftChangeBusy(true);
    try {
      const fields = await aircraftStepUp.confirm();
      const result = await changeFlightAircraft(detail.id, selectedAircraftType, fields);
      setDetail({ ...detail, aircraftType: result.aircraftType, capacity: result.capacity });
      setAircraftChangeOpen(false);
      await load();
    } catch (err) {
      if (err instanceof Error && err.message === 'CANCELLED') return;
      setAircraftChangeError(err instanceof Error ? err.message : 'خطا در تغییر نوع هواپیما.');
    } finally {
      setAircraftChangeBusy(false);
    }
  }

  function openPlan(row: FutureFlightRow) {
    setPlan(row);
    const initial = row.basePriceIrr ?? row.aiSuggestion?.priceIrr ?? null;
    setPlanPrice(initial != null ? String(Math.round(Number(initial) / 10)) : '');
    setPlanAgency(
      String(
        row.agencySeatsAllocated ??
          Math.round((row.capacity - row.charterSeats) / 2),
      ),
    );
    setAllotmentError(null);
    setNewAllotmentAgencyId('');
    setNewAllotmentSeats('');
    setNewAllotmentType('HARD');
    setNewAllotmentContractToman('');
    setNewAllotmentReleaseAt(null);
    setPlanSaleStart(null);
    setPlanSaleEnd(null);
    fetchAllotments(row.id)
      .then(setAllotments)
      .catch(() => setAllotments([]));
    fetchAgencies({})
      .then((r) => setAgencyOptions(r.agencies))
      .catch(() => setAgencyOptions([]));
  }

  async function onAddAllotment() {
    if (!plan) return;
    setAllotmentError(null);
    const seats = Number(latinDigits(newAllotmentSeats));
    if (!newAllotmentAgencyId || !Number.isInteger(seats) || seats < 1) {
      setAllotmentError('آژانس و تعداد صندلی معتبر را انتخاب کنید.');
      return;
    }
    try {
      const contractPriceIrr = newAllotmentContractToman.trim()
        ? parseTomanToRial(newAllotmentContractToman)
        : undefined;
      if (newAllotmentContractToman.trim() && contractPriceIrr == null) {
        setAllotmentError('نرخ قراردادی معتبر وارد کنید.');
        return;
      }
      await createAllotment(plan.id, {
        agencyId: newAllotmentAgencyId,
        seatsAllocated: seats,
        type: newAllotmentType,
        contractPriceIrr: contractPriceIrr ?? undefined,
        releaseAt: newAllotmentType === 'SOFT' ? newAllotmentReleaseAt ?? undefined : undefined,
      });
      setNewAllotmentAgencyId('');
      setNewAllotmentSeats('');
      setNewAllotmentType('HARD');
      setNewAllotmentContractToman('');
      setNewAllotmentReleaseAt(null);
      setAllotments(await fetchAllotments(plan.id));
    } catch (e) {
      setAllotmentError(e instanceof Error ? e.message : 'خطا در ثبت سهمیه.');
    }
  }

  async function onDeleteAllotment(allotmentId: string) {
    if (!plan) return;
    try {
      await deleteAllotment(plan.id, allotmentId);
      setAllotments(await fetchAllotments(plan.id));
    } catch (e) {
      setAllotmentError(e instanceof Error ? e.message : 'خطا در حذف سهمیه.');
    }
  }

  async function onSubmitPlan() {
    if (!plan) return;
    setError(null);
    const priceIrr = parseTomanToRial(planPrice);
    if (priceIrr == null) {
      setError('نرخ نهایی را به تومان و با رقم وارد کنید.');
      return;
    }
    try {
      const result = await planFlight(plan.id, {
        priceIrr,
        agencySeats: Number(latinDigits(planAgency)),
        saleStartsAt: planSaleStart ?? undefined,
        saleEndsAt: planSaleEnd ?? undefined,
      });
      setPlan(null);
      setNotice(
        result.proposalPending
          ? `نرخ و تخصیص صندلی ${routeLabel(plan.originCode, plan.destCode)} ثبت شد و برای تأیید مدیر عامل ارسال شد ✓`
          : `نرخ و تخصیص صندلی ${routeLabel(plan.originCode, plan.destCode)} ثبت شد ✓`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت نرخ.');
    }
  }

  async function onAiAnalysis() {
    setError(null);
    try {
      const result = await runFlightsAiAnalysis();
      if (!result.available) {
        setNotice(null);
        setError('سرویس تحلیل هوش مصنوعی در دسترس نیست؛ نرخ‌گذاری دستی همچنان ممکن است.');
        return;
      }
      setNotice('تحلیل هوش مصنوعی پروازهای آینده انجام و قیمت پیشنهادی ثبت شد ✓');
      await load();
    } catch {
      setError('خطا در اجرای تحلیل هوش مصنوعی.');
    }
  }

  const future = useMemo(() => data?.future ?? [], [data]);

  // Jalali calendar for the month of the first future flight (falls back to
  // today's month) — only days that actually have flights are clickable.
  const calendar = useMemo(() => {
    const anchor = future.length > 0 ? dayjs(future[0].departureAt) : dayjs();
    const jAnchor = anchor.calendar('jalali');
    const monthStart = jAnchor.startOf('month');
    const daysInMonth = jAnchor.daysInMonth();
    const monthLabel = faDigits(jAnchor.format('MMMM YYYY'));
    // Jalali weeks start on شنبه; dayjs .day() → 0=Sunday … 6=Saturday.
    const offset = (monthStart.day() + 1) % 7;
    const flightDays = new Map<string, string>(); // day-of-month → key date
    for (const f of future) {
      const j = dayjs(f.departureAt).calendar('jalali');
      if (j.format('YYYY/MM') === jAnchor.format('YYYY/MM')) {
        flightDays.set(j.format('D'), j.format('YYYY/MM/DD'));
      }
    }
    return { monthLabel, daysInMonth, offset, flightDays };
  }, [future]);

  const visibleFuture = futureDay
    ? future.filter(
        (f) => dayjs(f.departureAt).calendar('jalali').format('YYYY/MM/DD') === futureDay,
      )
    : future;

  const kpis = data?.kpis;
  const isCommercial = user?.role === 'COMMERCIAL_MANAGER';
  const showFuturePanel = subTab === 'future' || (isCommercial && subTab === 'active');
  const subTabs = isCommercial
    ? ([
        ['active', 'پروازهای فعال'],
        ['done', 'پروازهای انجام‌شده'],
        ['cities', 'شهرهای پروازی'],
      ] as const)
    : ([
        ['active', 'پروازهای فعال'],
        ['done', 'پروازهای انجام‌شده'],
        ['future', 'پروازهای آینده'],
      ] as const);
  const maxAgencySeats = plan ? plan.capacity - plan.charterSeats : 0;
  const agencySeatsNum = plan ? Number(latinDigits(planAgency)) || 0 : 0;
  const directSeats = plan ? Math.max(maxAgencySeats - agencySeatsNum, 0) : 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-black text-panel-ink">مدیریت پروازها</h1>
        <p className="mt-1 text-sm text-panel-muted">
          ایجاد پرواز، پایش موجودی و فروش، گزارش پروازهای انجام‌شده و برنامه‌ریزی پروازهای آینده
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#34d39915] p-3 text-sm text-[#34d399]">{notice}</p>}

      {kpis && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
            <div className="font-num text-lg font-black text-panel-ink">{faDigits(kpis.activeCount)}</div>
            <div className="text-[11px] text-panel-muted">پرواز فعال</div>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
            <div className="font-num text-lg font-black text-panel-ink">{faDigits(kpis.soldSeats)}</div>
            <div className="text-[11px] text-panel-muted">صندلی فروخته‌شده</div>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
            <div className="font-num text-lg font-black text-[#b45309]">
              {faDigits(kpis.meanOccupancyPct)}٪
            </div>
            <div className="text-[11px] text-panel-muted">میانگین ضریب اشغال</div>
          </div>
        </div>
      )}

      <div className="mb-4 flex w-max gap-1 rounded-xl border border-panel-border bg-panel-surface p-1">
        {subTabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              subTab === key ? 'bg-accent text-white' : 'text-panel-muted hover:text-panel-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-panel-muted">در حال بارگذاری…</p>
      ) : (
        <>
          {subTab === 'active' && data && (
            <section className="rounded-xl border border-panel-border bg-panel-surface">
              <div className="flex items-center justify-between border-b border-panel-border px-5 py-3">
                <h2 className="text-sm font-bold text-panel-ink">مدیریت پروازها و موجودی</h2>
                <button
                  onClick={() => {
                    setAddError(null);
                    setAddForm({
                      originCode: '',
                      destCode: '',
                      flightNo: '',
                      date: '',
                      time: '',
                      capacity: '',
                      priceToman: '',
                    });
                    setAddOpen(true);
                  }}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
                >
                  + افزودن پرواز
                </button>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1.7fr_1.1fr_1.4fr_1.5fr_1.2fr_0.9fr] gap-3 border-b border-panel-border px-5 py-2 text-[11px] font-bold text-panel-muted">
                    <span>مسیر</span>
                    <span>شماره پرواز</span>
                    <span>تاریخ / ساعت</span>
                    <span>ظرفیت</span>
                    <span>قیمت پایه</span>
                    <span>وضعیت</span>
                  </div>
                  <ul>
                    {data.active.map((f) => {
                      const pct = f.capacity > 0 ? Math.round((f.sold / f.capacity) * 100) : 0;
                      const st = STATUS_META[f.derivedStatus];
                      return (
                        <li key={f.id}>
                          <button
                            onClick={() => void openDetail(f.id)}
                            className="grid w-full grid-cols-[1.7fr_1.1fr_1.4fr_1.5fr_1.2fr_0.9fr] items-center gap-3 border-b border-panel-border px-5 py-3 text-right text-xs transition hover:bg-panel-surface-2/50"
                          >
                            <span className="font-bold text-panel-ink">
                              {routeLabel(f.originCode, f.destCode)}
                            </span>
                            <span className="ltr font-num text-panel-muted">{f.flightNo}</span>
                            <span className="font-num text-panel-muted">
                              {formatJalaliDateTime(f.departureAt)}
                            </span>
                            <span>
                              <span className="font-num block text-[10px] text-panel-muted">
                                {faDigits(f.sold)} / {faDigits(f.capacity)}
                              </span>
                              <span className="mt-1 block h-1.5 overflow-hidden rounded bg-panel-surface-2">
                                <span
                                  className={`block h-full ${occupancyBarClass(pct)}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </span>
                            </span>
                            <span className="font-num font-bold text-panel-ink">
                              {f.basePriceIrr != null ? `${faMoney(f.basePriceIrr)} تومان` : '—'}
                            </span>
                            <span>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${st.className}`}>
                                {st.label}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {data.active.length === 0 && (
                    <p className="py-6 text-center text-xs text-panel-muted">پروازی ثبت نشده است.</p>
                  )}
                </div>
              </div>

              {isCommercial && (
                <div className="mt-4 rounded-xl border border-panel-border bg-panel-surface p-5">
                  <PricingPage embedded />
                </div>
              )}
            </section>
          )}

          {subTab === 'done' && data && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
                  <div className="text-[11px] text-panel-muted">مجموع فروش بلیط</div>
                  <div className="font-num mt-1 text-sm font-black text-panel-ink">
                    {faMoney(data.completed.kpis.totalSalesIrr)} تومان
                  </div>
                </div>
                <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
                  <div className="text-[11px] text-panel-muted">سود حاصله</div>
                  <div className="font-num mt-1 text-sm font-black text-[#34d399]">
                    {faMoney(data.completed.kpis.totalProfitIrr)} تومان
                  </div>
                </div>
                <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
                  <div className="text-[11px] text-panel-muted">بلیط فروخته‌شده</div>
                  <div className="font-num mt-1 text-sm font-black text-panel-ink">
                    {faDigits(data.completed.kpis.totalTickets)}
                  </div>
                </div>
                <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
                  <div className="text-[11px] text-panel-muted">پرواز انجام‌شده</div>
                  <div className="font-num mt-1 text-sm font-black text-panel-ink">
                    {faDigits(data.completed.kpis.flightCount)}
                  </div>
                </div>
              </div>

              <section className="rounded-xl border border-panel-border bg-panel-surface">
                <div className="flex items-center justify-between border-b border-panel-border px-5 py-3">
                  <h2 className="text-sm font-bold text-panel-ink">گزارش پروازهای انجام‌شده</h2>
                  <button
                    type="button"
                    onClick={() => setNotice('خروجی Excel پروازهای انجام‌شده در حال آماده‌سازی…')}
                    className="rounded-lg border border-[#34d399]/40 bg-[#34d39915] px-3 py-1.5 text-[11px] font-bold text-[#34d399]"
                  >
                    ↓ خروجی Excel
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div className={isCommercial ? 'min-w-[920px]' : 'min-w-[900px]'}>
                    {isCommercial ? (
                      <>
                        <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_1fr_1fr_1fr_1fr_1.1fr] gap-2 border-b border-panel-border px-5 py-2 text-[10px] font-bold text-panel-muted">
                          <span>مسیر</span>
                          <span>پرواز</span>
                          <span>بلیط</span>
                          <span>قیمت استاندارد</span>
                          <span>فروش سیستمی</span>
                          <span>فروش چارتری</span>
                          <span>فروش آژانس</span>
                          <span>سود حاصله</span>
                        </div>
                        {data.completed.rows.map((d: CompletedFlightRow) => (
                          <div
                            key={d.id}
                            className="grid grid-cols-[1.5fr_0.9fr_0.8fr_1fr_1fr_1fr_1fr_1.1fr] items-center gap-2 border-b border-panel-border px-5 py-3 text-[11px]"
                          >
                            <span>
                              <span className="block font-bold text-panel-ink">
                                {routeLabel(d.originCode, d.destCode)}
                              </span>
                              <span className="font-num block text-[10px] text-panel-muted">
                                {formatJalaliDateTime(d.departureAt)}
                              </span>
                            </span>
                            <span className="ltr font-num text-panel-muted">{d.flightNo}</span>
                            <span className="font-num font-bold text-panel-ink">{faDigits(d.tickets)}</span>
                            <span className="font-num text-panel-muted">{faMoney(d.basePriceIrr)}</span>
                            <span className="font-num text-accent">{faMoney(d.channelRevenueIrr.SYSTEM)}</span>
                            <span className="font-num text-[#7c3aed]">{faMoney(d.channelRevenueIrr.CHARTER)}</span>
                            <span className="font-num text-[#34d399]">{faMoney(d.channelRevenueIrr.AGENCY)}</span>
                            <span className="font-num font-black text-[#34d399]">
                              {Number(d.profitIrr) > 0 ? faMoney(d.profitIrr) : '—'}
                            </span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-[1.5fr_0.8fr_0.6fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-panel-border px-5 py-2 text-[10px] font-bold text-panel-muted">
                          <span>مسیر</span>
                          <span>پرواز</span>
                          <span>بلیط</span>
                          <span>نرخ اصلی</span>
                          <span>متوسط نرخ</span>
                          <span>سیستمی</span>
                          <span>چارتری / آژانس</span>
                          <span>سود حاصله</span>
                          <span>ضرر</span>
                        </div>
                        {data.completed.rows.map((d: CompletedFlightRow) => (
                          <div key={d.id}>
                            <button
                              onClick={() => setExpandedDone(expandedDone === d.id ? null : d.id)}
                              className="grid w-full grid-cols-[1.5fr_0.8fr_0.6fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-panel-border px-5 py-3 text-right text-[11px] transition hover:bg-panel-surface-2/50"
                            >
                              <span>
                                <span className="block font-bold text-panel-ink">
                                  {routeLabel(d.originCode, d.destCode)}
                                </span>
                                <span className="font-num block text-[10px] text-panel-muted">
                                  {formatJalaliDateTime(d.departureAt)}
                                </span>
                              </span>
                              <span className="ltr font-num text-panel-muted">{d.flightNo}</span>
                              <span className="font-num font-bold text-panel-ink">{faDigits(d.tickets)}</span>
                              <span className="font-num text-panel-muted">{faMoney(d.basePriceIrr)}</span>
                              <span className="font-num font-bold text-panel-ink">{faMoney(d.avgPriceIrr)}</span>
                              <span className="font-num text-accent">{faMoney(d.channelRevenueIrr.SYSTEM)}</span>
                              <span className="font-num text-[#7c3aed]">
                                {faMoney(d.channelRevenueIrr.CHARTER)} / {faMoney(d.channelRevenueIrr.AGENCY)}
                              </span>
                              <span className="font-num font-black text-[#34d399]">
                                {Number(d.profitIrr) > 0 ? `${faMoney(d.profitIrr)}` : '—'}
                              </span>
                              <span className={`font-num font-black ${Number(d.lossIrr) > 0 ? 'text-danger' : 'text-panel-muted'}`}>
                                {Number(d.lossIrr) > 0 ? faMoney(d.lossIrr) : '—'}
                              </span>
                            </button>
                            {expandedDone === d.id && (
                              <div className="grid grid-cols-2 gap-3 border-b border-panel-border bg-panel-canvas px-5 py-3 text-[11px] md:grid-cols-3">
                                <div>
                                  <div className="text-[10px] text-panel-muted">تعداد صندلی فروخته‌شده</div>
                                  <div className="font-num font-bold text-panel-ink">{faDigits(d.tickets)} بلیط</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-panel-muted">نرخ اصلی بلیط</div>
                                  <div className="font-num font-bold text-panel-ink">{faMoney(d.basePriceIrr)} تومان</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-panel-muted">جمع فروش</div>
                                  <div className="font-num font-bold text-panel-ink">{faMoney(d.revenueIrr)} تومان</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-panel-muted">متوسط نرخ بلیط فروخته‌شده</div>
                                  <div className="font-num font-bold text-panel-ink">{faMoney(d.avgPriceIrr)} تومان</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-panel-muted">سود حاصله</div>
                                  <div className="font-num font-bold text-[#34d399]">
                                    {Number(d.profitIrr) > 0 ? `${faMoney(d.profitIrr)} تومان` : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-panel-muted">ضرر</div>
                                  <div className={`font-num font-bold ${Number(d.lossIrr) > 0 ? 'text-danger' : 'text-panel-muted'}`}>
                                    {Number(d.lossIrr) > 0 ? `${faMoney(d.lossIrr)} تومان` : '—'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    {data.completed.rows.length === 0 && (
                      <p className="py-6 text-center text-xs text-panel-muted">پرواز انجام‌شده‌ای ثبت نشده است.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {subTab === 'cities' && isCommercial && (
            <FlightCitiesTab
              airports={airports}
              onCreated={(a) => setAirports((prev) => [...prev, a].sort((x, y) => x.cityFa.localeCompare(y.cityFa, 'fa')))}
            />
          )}

          {showFuturePanel && data && (
            <div className="flex flex-col gap-4">
              <p className="rounded-xl border border-accent/25 bg-accent/5 p-3 text-[11px] leading-6 text-panel-muted">
                برنامه‌ریزی پروازهای آینده: ظرفیت، تعهد چارتری و قیمت‌گذاری پیشنهادی هوش مصنوعی بر اساس تحلیل
                تقاضا و رقبا.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] text-panel-muted">فیلتر بر اساس روز:</span>
                <div className="relative">
                  <button
                    onClick={() => setCalOpen((v) => !v)}
                    className="rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-xs font-bold text-panel-ink"
                  >
                    {futureDay ? faDigits(futureDay) : 'همه‌ی روزها'} ▾
                  </button>
                  {calOpen && (
                    <div className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-panel-border bg-panel-surface p-3 shadow-xl">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black text-panel-ink">{calendar.monthLabel}</span>
                        <span className="text-[10px] text-panel-muted">فقط روزهای دارای پرواز</span>
                      </div>
                      <div className="mb-1 grid grid-cols-7 gap-1">
                        {WEEKDAYS_FA.map((w, i) => (
                          <span
                            key={w}
                            className={`py-0.5 text-center text-[9px] font-bold ${i === 6 ? 'text-danger' : 'text-panel-muted'}`}
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: calendar.offset }).map((_, i) => (
                          <span key={`b${i}`} />
                        ))}
                        {Array.from({ length: calendar.daysInMonth }).map((_, i) => {
                          const day = String(i + 1);
                          const key = calendar.flightDays.get(day);
                          const selected = key != null && futureDay === key;
                          return (
                            <button
                              key={day}
                              disabled={key == null}
                              onClick={() => {
                                if (key != null) {
                                  setFutureDay(key);
                                  setCalOpen(false);
                                }
                              }}
                              className={`aspect-square rounded-lg text-[11px] font-bold ${
                                selected
                                  ? 'bg-accent text-white'
                                  : key != null
                                    ? 'bg-accent/10 text-accent'
                                    : 'cursor-default text-panel-muted/50'
                              }`}
                            >
                              {faDigits(day)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {futureDay && (
                  <button
                    onClick={() => setFutureDay(null)}
                    className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] font-bold text-danger"
                  >
                    ✕ پاک‌کردن فیلتر
                  </button>
                )}
              </div>

              <section className="rounded-xl border border-panel-border bg-panel-surface">
                <div className="flex items-center justify-between border-b border-panel-border px-5 py-3">
                  <h2 className="text-sm font-bold text-panel-ink">پروازهای آینده (برنامه‌ریزی‌شده)</h2>
                  <button
                    onClick={() => void onAiAnalysis()}
                    className="rounded-lg bg-gradient-to-l from-accent to-[#9333ea] px-3 py-2 text-xs font-bold text-white"
                  >
                    ✦ تحلیل قیمت‌گذاری با هوش مصنوعی
                  </button>
                </div>
                <div className="flex flex-col gap-3 p-4">
                  {visibleFuture.length === 0 && (
                    <p className="py-5 text-center text-[11px] text-panel-muted">
                      برای روز انتخاب‌شده پروازی برنامه‌ریزی نشده است.
                    </p>
                  )}
                  {visibleFuture.map((u) => {
                    const expanded = expandedFuture === u.id;
                    const priced = u.agencySeatsAllocated != null;
                    const direct = priced
                      ? Math.max(u.capacity - u.charterSeats - (u.agencySeatsAllocated ?? 0), 0)
                      : 0;
                    return (
                      <div key={u.id} className="rounded-xl border border-panel-border bg-panel-canvas p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            onClick={() => setExpandedFuture(expanded ? null : u.id)}
                            className="flex items-center gap-3 text-right"
                          >
                            <span className="text-panel-muted">{expanded ? '▾' : '◂'}</span>
                            <span>
                              <span className="block text-sm font-black text-panel-ink">
                                {routeLabel(u.originCode, u.destCode)}
                              </span>
                              <span className="block text-[11px] text-panel-muted">
                                شماره پرواز <span className="ltr font-num">{u.flightNo}</span> · تاریخ پرواز{' '}
                                <span className="font-num">{formatJalaliDateTime(u.departureAt)}</span>
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => openPlan(u)}
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                              priced
                                ? 'border border-panel-border bg-panel-surface text-panel-muted'
                                : 'bg-accent text-white hover:bg-accent/90'
                            }`}
                          >
                            {priced ? 'ویرایش نرخ' : 'نرخ‌گذاری'}
                          </button>
                        </div>

                        {expanded && (
                          <>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                              <div className="rounded-lg border border-panel-border bg-panel-surface p-2.5">
                                <div className="text-[10px] text-panel-muted">ظرفیت صندلی</div>
                                <div className="font-num font-bold text-panel-ink">
                                  {faDigits(u.capacity)} صندلی
                                </div>
                              </div>
                              <div className="rounded-lg border border-panel-border bg-panel-surface p-2.5">
                                <div className="text-[10px] text-panel-muted">تعهد چارتری</div>
                                <div className="font-num font-bold text-[#7c3aed]">
                                  {faDigits(u.charterSeats)} صندلی
                                </div>
                              </div>
                              <div className="rounded-lg border border-panel-border bg-panel-surface p-2.5">
                                <div className="text-[10px] text-panel-muted">قیمت پیشنهادی AI</div>
                                {u.aiSuggestion ? (
                                  <div className="font-num font-bold text-[#34d399]">
                                    {faMoney(u.aiSuggestion.priceIrr)} تومان{' '}
                                    <span className="rounded bg-[#9333ea1f] px-1 text-[9px] font-bold text-[#7c3aed]">
                                      AI
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-panel-muted">در انتظار تحلیل</div>
                                )}
                              </div>
                              <div className="rounded-lg border border-panel-border bg-panel-surface p-2.5">
                                <div className="text-[10px] text-panel-muted">نرخ نهایی / تخصیص</div>
                                {priced ? (
                                  <>
                                    <div className="font-num font-bold text-[#34d399]">
                                      {faMoney(u.basePriceIrr ?? 0)} تومان
                                    </div>
                                    <div className="font-num text-[9px] text-panel-muted">
                                      آژانس {faDigits(u.agencySeatsAllocated ?? 0)} · مستقیم {faDigits(direct)}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-panel-muted">تعیین نشده</div>
                                )}
                              </div>
                            </div>
                            {u.aiSuggestion && (
                              <div className="mt-3 rounded-lg border border-[#9333ea40] bg-gradient-to-l from-accent/5 to-[#9333ea0d] p-3">
                                <div className="mb-1 text-[11px] font-black text-[#7c3aed]">
                                  تحلیل هوش مصنوعی — چرا این قیمت؟
                                </div>
                                <p className="mb-2 text-[11px] leading-6 text-panel-ink">{u.aiSuggestion.reason}</p>
                                <ul className="flex flex-col gap-1">
                                  {u.aiSuggestion.factors.map((fc) => (
                                    <li key={fc} className="text-[10px] text-panel-muted">
                                      • {fc}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {addOpen && (
        <Modal title="افزودن پرواز جدید" onClose={() => setAddOpen(false)}>
          <div className="flex flex-col gap-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="nf-origin" className="mb-1 block font-bold text-panel-ink">
                  مبدأ
                </label>
                <select
                  id="nf-origin"
                  value={addForm.originCode}
                  onChange={(e) => setAddForm((f) => ({ ...f, originCode: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                >
                  <option value="">— انتخاب شهر —</option>
                  {airports.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.cityFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="nf-dest" className="mb-1 block font-bold text-panel-ink">
                  مقصد
                </label>
                <select
                  id="nf-dest"
                  value={addForm.destCode}
                  onChange={(e) => setAddForm((f) => ({ ...f, destCode: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                >
                  <option value="">— انتخاب شهر —</option>
                  {airports.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.cityFa}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="nf-no" className="mb-1 block font-bold text-panel-ink">
                  شماره پرواز
                </label>
                <input
                  id="nf-no"
                  dir="ltr"
                  placeholder="EP-901"
                  value={addForm.flightNo}
                  onChange={(e) => setAddForm((f) => ({ ...f, flightNo: e.target.value }))}
                  className="font-num h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                />
              </div>
              <div>
                <label htmlFor="nf-date" className="mb-1 block font-bold text-panel-ink">
                  تاریخ (جلالی)
                </label>
                <input
                  id="nf-date"
                  placeholder="۱۴۰۵/۰۴/۲۵"
                  value={addForm.date}
                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                  className="font-num h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                />
              </div>
              <div>
                <label htmlFor="nf-time" className="mb-1 block font-bold text-panel-ink">
                  ساعت
                </label>
                <input
                  id="nf-time"
                  dir="ltr"
                  placeholder="08:30"
                  value={addForm.time}
                  onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))}
                  className="font-num h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="nf-cap" className="mb-1 block font-bold text-panel-ink">
                  ظرفیت (صندلی)
                </label>
                <input
                  id="nf-cap"
                  dir="ltr"
                  placeholder="180"
                  value={addForm.capacity}
                  onChange={(e) => setAddForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="font-num h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                />
              </div>
              <div>
                <label htmlFor="nf-price" className="mb-1 block font-bold text-panel-ink">
                  قیمت بلیط (تومان)
                </label>
                <input
                  id="nf-price"
                  dir="ltr"
                  placeholder="3800000"
                  value={addForm.priceToman}
                  onChange={(e) => setAddForm((f) => ({ ...f, priceToman: e.target.value }))}
                  className="font-num h-10 w-full rounded-lg border border-panel-border-2 bg-panel-canvas px-2 outline-none text-panel-ink"
                />
              </div>
            </div>
            {addError && (
              <p role="alert" className="text-[11px] text-danger">
                {addError}
              </p>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => void onSubmitAdd()}
                className="flex-1 rounded-lg bg-accent py-2.5 text-xs font-bold text-white transition hover:bg-accent/90"
              >
                افزودن پرواز
              </button>
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-panel-border px-4 text-xs text-panel-muted"
              >
                انصراف
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          title={`${routeLabel(detail.originCode, detail.destCode)} · ${detail.flightNo}`}
          onClose={() => setDetail(null)}
        >
          <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-panel-canvas p-2.5">
              <div className="text-[10px] text-panel-muted">صندلی فروخته‌شده</div>
              <div className="font-num font-black text-panel-ink">
                {faDigits(detail.sold)} / {faDigits(detail.capacity)}
              </div>
            </div>
            <div className="rounded-lg bg-panel-canvas p-2.5">
              <div className="text-[10px] text-panel-muted">ضریب اشغال</div>
              <div className="font-num font-black text-[#34d399]">{faDigits(detail.occupancyPct)}٪</div>
            </div>
            <div className="rounded-lg bg-panel-canvas p-2.5">
              <div className="text-[10px] text-panel-muted">قیمت پایه</div>
              <div className="font-num font-black text-accent">
                {detail.basePriceIrr != null ? `${faMoney(detail.basePriceIrr)} تومان` : '—'}
              </div>
            </div>
          </div>

          <h3 className="mb-2 text-xs font-bold text-panel-ink">تفکیک کانال فروش صندلی</h3>
          <div className="flex flex-col gap-2.5">
            {detail.channels.map((c) => {
              const meta = CHANNEL_META[c.channel];
              const pct = detail.sold > 0 ? Math.round((c.seats / detail.sold) * 100) : 0;
              return (
                <div key={c.channel}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-panel-muted">{meta.label}</span>
                    <span className="font-num font-bold text-panel-ink">
                      {faDigits(c.seats)} صندلی · {faMoney(c.revenueIrr)} تومان
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-panel-surface-2">
                    <div className={`h-full ${meta.barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-panel-canvas p-3">
            <span className="text-xs font-bold text-panel-ink">مجموع درآمد پرواز</span>
            <span className="font-num text-sm font-black text-accent">
              {faMoney(detail.totalRevenueIrr)} تومان
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-panel-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-panel-ink">نوع هواپیما</span>
              {!aircraftChangeOpen && (
                <button
                  onClick={() => {
                    setSelectedAircraftType(detail.aircraftType);
                    setAircraftChangeError(null);
                    setAircraftChangeOpen(true);
                  }}
                  className="text-[11px] font-bold text-accent"
                >
                  تغییر
                </button>
              )}
            </div>
            {!aircraftChangeOpen ? (
              <div className="text-xs font-bold text-panel-ink">{detail.aircraftType}</div>
            ) : (
              <div className="flex flex-col gap-2">
                <select
                  value={selectedAircraftType}
                  onChange={(e) => setSelectedAircraftType(e.target.value)}
                  className="rounded-lg border border-panel-border-2 bg-panel-canvas p-2 text-xs text-panel-ink outline-none"
                >
                  {aircraftTypes.map((t) => (
                    <option key={t.aircraftType} value={t.aircraftType}>
                      {t.aircraftType} (ظرفیت {faDigits(t.capacity)})
                    </option>
                  ))}
                </select>
                {aircraftChangeError && (
                  <p role="alert" className="text-[11px] text-danger">
                    {aircraftChangeError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={aircraftChangeBusy}
                    onClick={() => void onChangeAircraft()}
                    className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {aircraftChangeBusy ? 'در حال ثبت…' : 'ثبت تغییر'}
                  </button>
                  <button
                    onClick={() => setAircraftChangeOpen(false)}
                    className="rounded-lg bg-panel-canvas px-3 py-1.5 text-[11px] font-bold text-panel-muted"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}
          </div>

          <FareRulesSection instanceId={detail.id} />
        </Modal>
      )}
      {aircraftStepUp.modal}

      {plan && (
        <Modal
          title={`نرخ‌گذاری و تخصیص · ${routeLabel(plan.originCode, plan.destCode)}`}
          onClose={() => setPlan(null)}
        >
          <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-panel-canvas p-2.5">
              <div className="text-[10px] text-panel-muted">ظرفیت</div>
              <div className="font-num font-bold text-panel-ink">{faDigits(plan.capacity)} صندلی</div>
            </div>
            <div className="rounded-lg bg-panel-canvas p-2.5">
              <div className="text-[10px] text-panel-muted">تعهد چارتری</div>
              <div className="font-num font-bold text-[#7c3aed]">{faDigits(plan.charterSeats)} صندلی</div>
            </div>
          </div>

          <label htmlFor="plan-price" className="mb-1 block text-xs font-bold text-panel-ink">
            نرخ نهایی (تومان)
          </label>
          <div className="mb-3 flex gap-2">
            <input
              id="plan-price"
              dir="ltr"
              value={planPrice}
              onChange={(e) => setPlanPrice(e.target.value)}
              className="font-num h-10 flex-1 rounded-lg border border-panel-border-2 bg-panel-canvas px-2 text-xs outline-none text-panel-ink"
            />
            {plan.aiSuggestion && (
              <button
                onClick={() => setPlanPrice(String(Math.round(plan.aiSuggestion!.priceIrr / 10)))}
                className="rounded-lg border border-[#9333ea55] bg-[#9333ea14] px-3 text-[11px] font-bold text-[#7c3aed]"
              >
                استفاده از قیمت AI
              </button>
            )}
          </div>

          <label htmlFor="plan-agency" className="mb-1 block text-xs font-bold text-panel-ink">
            تخصیص صندلی آژانس (حداکثر {faDigits(maxAgencySeats)})
          </label>
          <input
            id="plan-agency"
            type="range"
            min={0}
            max={maxAgencySeats}
            value={Math.min(agencySeatsNum, maxAgencySeats)}
            onChange={(e) => setPlanAgency(e.target.value)}
            className="mb-2 w-full accent-accent"
          />
          <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-panel-canvas p-2.5 text-center">
              <div className="text-[10px] text-panel-muted">چارتری</div>
              <div className="font-num font-bold text-[#7c3aed]">{faDigits(plan.charterSeats)}</div>
            </div>
            <div className="rounded-lg bg-panel-canvas p-2.5 text-center">
              <div className="text-[10px] text-panel-muted">آژانس</div>
              <div className="font-num font-bold text-[#34d399]">{faDigits(agencySeatsNum)}</div>
            </div>
            <div className="rounded-lg bg-panel-canvas p-2.5 text-center">
              <div className="text-[10px] text-panel-muted">مستقیم</div>
              <div className="font-num font-bold text-panel-ink">{faDigits(directSeats)}</div>
            </div>
          </div>
          <div className="mb-3 flex h-2 overflow-hidden rounded bg-panel-surface-2">
            <div
              className="bg-[#7c3aed]"
              style={{ width: `${plan.capacity > 0 ? (plan.charterSeats / plan.capacity) * 100 : 0}%` }}
            />
            <div
              className="bg-[#34d399]"
              style={{ width: `${plan.capacity > 0 ? (agencySeatsNum / plan.capacity) * 100 : 0}%` }}
            />
            <div
              className="bg-accent"
              style={{ width: `${plan.capacity > 0 ? (directSeats / plan.capacity) * 100 : 0}%` }}
            />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-panel-border">
              <JalaliDatePicker
                label="شروع فروش"
                value={planSaleStart}
                onChange={setPlanSaleStart}
                testId="plan-sale-start"
              />
            </div>
            <div className="rounded-lg border border-panel-border">
              <JalaliDatePicker
                label="پایان فروش"
                value={planSaleEnd}
                onChange={setPlanSaleEnd}
                minDate={planSaleStart ?? undefined}
                testId="plan-sale-end"
              />
            </div>
          </div>

          <button
            onClick={() => void onSubmitPlan()}
            className="w-full rounded-lg bg-accent py-2.5 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            ثبت نرخ و تخصیص صندلی
          </button>

          <div className="mt-5 border-t border-panel-border pt-4">
            <h3 className="mb-2 text-xs font-bold text-panel-ink">سهمیه‌های صندلی آژانس‌ها</h3>
            {allotments.length === 0 && (
              <p className="mb-2 text-[11px] text-panel-muted">هنوز سهمیه‌ای برای این پرواز ثبت نشده است.</p>
            )}
            <div className="mb-3 flex flex-col gap-1.5">
              {allotments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-panel-canvas px-2.5 py-2 text-[11px]"
                >
                  <span className="font-bold text-panel-ink">{a.agencyName}</span>
                  <span className="font-num text-panel-muted">{faDigits(a.seatsAllocated)} صندلی</span>
                  <span className="text-[10px] text-panel-muted">{a.type === 'SOFT' ? 'نرم' : 'سخت'}</span>
                  <button
                    onClick={() => void onDeleteAllotment(a.id)}
                    className="text-danger"
                    aria-label={`حذف سهمیه ${a.agencyName}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="آژانس"
                value={newAllotmentAgencyId}
                onChange={(e) => setNewAllotmentAgencyId(e.target.value)}
                className="h-10 min-w-[120px] flex-1 rounded-lg border border-panel-border-2 bg-panel-canvas px-2 text-xs outline-none text-panel-ink"
              >
                <option value="">انتخاب آژانس</option>
                {agencyOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
              <input
                aria-label="تعداد صندلی سهمیه"
                dir="ltr"
                value={newAllotmentSeats}
                onChange={(e) => setNewAllotmentSeats(e.target.value)}
                placeholder="تعداد"
                className="font-num h-10 w-20 rounded-lg border border-panel-border-2 bg-panel-canvas px-2 text-xs outline-none text-panel-ink"
              />
              <select
                aria-label="نوع سهمیه"
                value={newAllotmentType}
                onChange={(e) => setNewAllotmentType(e.target.value as 'HARD' | 'SOFT')}
                className="h-10 rounded-lg border border-panel-border-2 bg-panel-canvas px-2 text-xs outline-none text-panel-ink"
              >
                <option value="HARD">سخت</option>
                <option value="SOFT">نرم</option>
              </select>
              <input
                aria-label="نرخ قراردادی تومان"
                dir="ltr"
                value={newAllotmentContractToman}
                onChange={(e) => setNewAllotmentContractToman(e.target.value)}
                placeholder="نرخ قرارداد"
                className="font-num h-10 w-24 rounded-lg border border-panel-border-2 bg-panel-canvas px-2 text-xs outline-none text-panel-ink"
              />
              <button
                onClick={() => void onAddAllotment()}
                className="rounded-lg border border-accent px-3 text-[11px] font-bold text-accent"
              >
                + افزودن
              </button>
            </div>
            {newAllotmentType === 'SOFT' && (
              <div className="mt-2 max-w-xs rounded-lg border border-panel-border">
                <JalaliDatePicker
                  label="موعد آزادسازی"
                  value={newAllotmentReleaseAt}
                  onChange={setNewAllotmentReleaseAt}
                  testId="allotment-release"
                />
              </div>
            )}
            {allotmentError && <p className="mt-2 text-[11px] text-danger">{allotmentError}</p>}
          </div>

          <FareRulesSection instanceId={plan.id} />
        </Modal>
      )}
    </div>
  );
}
