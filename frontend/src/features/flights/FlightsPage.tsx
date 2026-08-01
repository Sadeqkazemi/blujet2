import type { CSSProperties } from 'react';
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
import {
  StaffAlert,
  StaffKpiCard,
  StaffPanelCard,
  StaffPanelPageHeader,
  StaffPrimaryButton,
  staffSegmentedControl,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
import {
  staffInnerTile,
  staffInput,
  staffPage,
  staffStatusStyle,
  staffTableHeader,
  staffTableRow,
} from '../../lib/staff-panel-styles';
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

const STATUS_META: Record<DerivedFlightStatus, { label: string; style: CSSProperties }> = {
  ACTIVE: { label: 'فعال', style: { background: 'rgba(52,211,153,0.15)', color: STAFF_PANEL.success } },
  SELLING: { label: 'در حال فروش', style: { background: STAFF_PANEL.accentSoft, color: STAFF_PANEL.accent } },
  FULL: { label: 'تکمیل', style: { background: 'rgba(245,158,11,0.15)', color: STAFF_PANEL.warning } },
  CANCELLED: { label: 'لغو شده', style: { background: 'rgba(248,113,113,0.15)', color: STAFF_PANEL.danger } },
};

function StatusBadge({ status }: { status: DerivedFlightStatus }) {
  const st = STATUS_META[status];
  return (
    <span
      style={{
        borderRadius: 20,
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 800,
        ...st.style,
      }}
    >
      {st.label}
    </span>
  );
}

const CHANNEL_META = {
  SYSTEM: { label: 'فروش سیستمی', barColor: STAFF_PANEL.accent },
  CHARTER: { label: 'فروش چارتری', barColor: STAFF_PANEL.purple },
  AGENCY: { label: 'فروش آژانس همکار', barColor: STAFF_PANEL.success },
} as const;

function occupancyBarColor(pct: number) {
  if (pct >= 100) return STAFF_PANEL.warning;
  if (pct >= 60) return STAFF_PANEL.success;
  return STAFF_PANEL.accent;
}

const inputStyle: CSSProperties = {
  ...staffInput,
  height: 40,
  width: '100%',
  padding: '0 8px',
  fontSize: 12,
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 800,
  fontSize: 12,
  color: STAFF_PANEL.text,
};

const infoBlockStyle: CSSProperties = {
  ...staffInnerTile,
};

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${STAFF_PANEL.inputBorder}`,
  background: 'transparent',
  color: STAFF_PANEL.textMuted,
  padding: '8px 16px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

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
    <div style={staffPage}>
      <StaffPanelPageHeader
        title="مدیریت پروازها"
        subtitle="ایجاد پرواز، پایش موجودی و فروش، گزارش پروازهای انجام‌شده و برنامه‌ریزی پروازهای آینده"
      />

      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <StaffKpiCard label="پرواز فعال" value={faDigits(kpis.activeCount)} />
          <StaffKpiCard label="صندلی فروخته‌شده" value={faDigits(kpis.soldSeats)} />
          <StaffKpiCard
            label="میانگین ضریب اشغال"
            value={`${faDigits(kpis.meanOccupancyPct)}٪`}
            iconColor={STAFF_PANEL.warning}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          width: 'max-content',
          borderRadius: 12,
          border: `1px solid ${STAFF_PANEL.cardBorder}`,
          background: STAFF_PANEL.cardBg,
          padding: 4,
        }}
      >
        {subTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            style={staffSegmentedControl(subTab === key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>
          در حال بارگذاری…
        </p>
      ) : (
        <>
          {subTab === 'active' && data && (
            <StaffPanelCard
              title="مدیریت پروازها و موجودی"
              padding={0}
              headerAction={
                <StaffPrimaryButton
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
                >
                  + افزودن پرواز
                </StaffPrimaryButton>
              }
            >
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>
                  <div
                    style={{
                      ...staffTableHeader,
                      gridTemplateColumns: '1.7fr 1.1fr 1.4fr 1.5fr 1.2fr 0.9fr',
                    }}
                  >
                    <span>مسیر</span>
                    <span>شماره پرواز</span>
                    <span>تاریخ / ساعت</span>
                    <span>ظرفیت</span>
                    <span>قیمت پایه</span>
                    <span>وضعیت</span>
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {data.active.map((f) => {
                      const pct = f.capacity > 0 ? Math.round((f.sold / f.capacity) * 100) : 0;
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => void openDetail(f.id)}
                            style={{
                              ...staffTableRow,
                              gridTemplateColumns: '1.7fr 1.1fr 1.4fr 1.5fr 1.2fr 0.9fr',
                            }}
                          >
                            <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>
                              {routeLabel(f.originCode, f.destCode)}
                            </span>
                            <span className="ltr font-num" style={{ color: STAFF_PANEL.textMuted }}>
                              {f.flightNo}
                            </span>
                            <span className="font-num" style={{ color: STAFF_PANEL.textMuted }}>
                              {formatJalaliDateTime(f.departureAt)}
                            </span>
                            <span>
                              <span className="font-num" style={{ display: 'block', fontSize: 10, color: STAFF_PANEL.textMuted }}>
                                {faDigits(f.sold)} / {faDigits(f.capacity)}
                              </span>
                              <span
                                style={{
                                  marginTop: 4,
                                  display: 'block',
                                  height: 6,
                                  overflow: 'hidden',
                                  borderRadius: 4,
                                  background: STAFF_PANEL.inputBg,
                                }}
                              >
                                <span
                                  style={{
                                    display: 'block',
                                    height: '100%',
                                    background: occupancyBarColor(pct),
                                    width: `${Math.min(pct, 100)}%`,
                                  }}
                                />
                              </span>
                            </span>
                            <span className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>
                              {f.basePriceIrr != null ? `${faMoney(f.basePriceIrr)} تومان` : '—'}
                            </span>
                            <span>
                              <StatusBadge status={f.derivedStatus} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {data.active.length === 0 && (
                    <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
                      پروازی ثبت نشده است.
                    </p>
                  )}
                </div>
              </div>

              {isCommercial && (
                <div style={{ marginTop: 16, padding: '0 16px 16px' }}>
                  <PricingPage embedded />
                </div>
              )}
            </StaffPanelCard>
          )}

          {subTab === 'done' && data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <StaffKpiCard label="مجموع فروش بلیط" value={`${faMoney(data.completed.kpis.totalSalesIrr)} تومان`} />
                <StaffKpiCard
                  label="سود حاصله"
                  value={`${faMoney(data.completed.kpis.totalProfitIrr)} تومان`}
                  iconColor={STAFF_PANEL.success}
                />
                <StaffKpiCard label="بلیط فروخته‌شده" value={faDigits(data.completed.kpis.totalTickets)} />
                <StaffKpiCard label="پرواز انجام‌شده" value={faDigits(data.completed.kpis.flightCount)} />
              </div>

              <StaffPanelCard
                title="گزارش پروازهای انجام‌شده"
                padding={0}
                headerAction={
                  <button
                    type="button"
                    onClick={() => setNotice('خروجی Excel پروازهای انجام‌شده در حال آماده‌سازی…')}
                    style={{
                      borderRadius: 10,
                      border: `1px solid rgba(52,211,153,0.35)`,
                      background: 'rgba(52,211,153,0.12)',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: STAFF_PANEL.success,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ↓ خروجی Excel
                  </button>
                }
              >
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: isCommercial ? 920 : 900 }}>
                    {isCommercial ? (
                      <>
                        <div
                          style={{
                            ...staffTableHeader,
                            gridTemplateColumns: '1.5fr 0.9fr 0.8fr 1fr 1fr 1fr 1fr 1.1fr',
                            fontSize: 10,
                          }}
                        >
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
                            style={{
                              ...staffTableRow,
                              gridTemplateColumns: '1.5fr 0.9fr 0.8fr 1fr 1fr 1fr 1fr 1.1fr',
                              cursor: 'default',
                            }}
                          >
                            <span>
                              <span style={{ display: 'block', fontWeight: 800, color: STAFF_PANEL.text }}>
                                {routeLabel(d.originCode, d.destCode)}
                              </span>
                              <span className="font-num" style={{ display: 'block', fontSize: 10, color: STAFF_PANEL.textMuted }}>
                                {formatJalaliDateTime(d.departureAt)}
                              </span>
                            </span>
                            <span className="ltr font-num" style={{ color: STAFF_PANEL.textMuted }}>{d.flightNo}</span>
                            <span className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(d.tickets)}</span>
                            <span className="font-num" style={{ color: STAFF_PANEL.textMuted }}>{faMoney(d.basePriceIrr)}</span>
                            <span className="font-num" style={{ color: STAFF_PANEL.accent }}>{faMoney(d.channelRevenueIrr.SYSTEM)}</span>
                            <span className="font-num" style={{ color: STAFF_PANEL.purple }}>{faMoney(d.channelRevenueIrr.CHARTER)}</span>
                            <span className="font-num" style={{ color: STAFF_PANEL.success }}>{faMoney(d.channelRevenueIrr.AGENCY)}</span>
                            <span className="font-num" style={{ fontWeight: 900, color: STAFF_PANEL.success }}>
                              {Number(d.profitIrr) > 0 ? faMoney(d.profitIrr) : '—'}
                            </span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            ...staffTableHeader,
                            gridTemplateColumns: '1.5fr 0.8fr 0.6fr 1fr 1fr 1fr 1fr 1fr 1fr',
                            fontSize: 10,
                          }}
                        >
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
                              type="button"
                              onClick={() => setExpandedDone(expandedDone === d.id ? null : d.id)}
                              style={{
                                ...staffTableRow,
                                gridTemplateColumns: '1.5fr 0.8fr 0.6fr 1fr 1fr 1fr 1fr 1fr 1fr',
                              }}
                            >
                              <span>
                                <span style={{ display: 'block', fontWeight: 800, color: STAFF_PANEL.text }}>
                                  {routeLabel(d.originCode, d.destCode)}
                                </span>
                                <span className="font-num" style={{ display: 'block', fontSize: 10, color: STAFF_PANEL.textMuted }}>
                                  {formatJalaliDateTime(d.departureAt)}
                                </span>
                              </span>
                              <span className="ltr font-num" style={{ color: STAFF_PANEL.textMuted }}>{d.flightNo}</span>
                              <span className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(d.tickets)}</span>
                              <span className="font-num" style={{ color: STAFF_PANEL.textMuted }}>{faMoney(d.basePriceIrr)}</span>
                              <span className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faMoney(d.avgPriceIrr)}</span>
                              <span className="font-num" style={{ color: STAFF_PANEL.accent }}>{faMoney(d.channelRevenueIrr.SYSTEM)}</span>
                              <span className="font-num" style={{ color: STAFF_PANEL.purple }}>
                                {faMoney(d.channelRevenueIrr.CHARTER)} / {faMoney(d.channelRevenueIrr.AGENCY)}
                              </span>
                              <span className="font-num" style={{ fontWeight: 900, color: STAFF_PANEL.success }}>
                                {Number(d.profitIrr) > 0 ? `${faMoney(d.profitIrr)}` : '—'}
                              </span>
                              <span
                                className="font-num"
                                style={{
                                  fontWeight: 900,
                                  color: Number(d.lossIrr) > 0 ? STAFF_PANEL.danger : STAFF_PANEL.textMuted,
                                }}
                              >
                                {Number(d.lossIrr) > 0 ? faMoney(d.lossIrr) : '—'}
                              </span>
                            </button>
                            {expandedDone === d.id && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gap: 12,
                                  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
                                  background: STAFF_PANEL.inputBg,
                                  padding: '12px 16px',
                                  fontSize: 11,
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>تعداد صندلی فروخته‌شده</div>
                                  <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(d.tickets)} بلیط</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>نرخ اصلی بلیط</div>
                                  <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faMoney(d.basePriceIrr)} تومان</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>جمع فروش</div>
                                  <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faMoney(d.revenueIrr)} تومان</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>متوسط نرخ بلیط فروخته‌شده</div>
                                  <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faMoney(d.avgPriceIrr)} تومان</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>سود حاصله</div>
                                  <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.success }}>
                                    {Number(d.profitIrr) > 0 ? `${faMoney(d.profitIrr)} تومان` : '—'}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>ضرر</div>
                                  <div
                                    className="font-num"
                                    style={{
                                      fontWeight: 800,
                                      color: Number(d.lossIrr) > 0 ? STAFF_PANEL.danger : STAFF_PANEL.textMuted,
                                    }}
                                  >
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
                      <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted }}>
                        پرواز انجام‌شده‌ای ثبت نشده است.
                      </p>
                    )}
                  </div>
                </div>
              </StaffPanelCard>
            </div>
          )}

          {subTab === 'cities' && isCommercial && (
            <FlightCitiesTab
              airports={airports}
              onCreated={(a) => setAirports((prev) => [...prev, a].sort((x, y) => x.cityFa.localeCompare(y.cityFa, 'fa')))}
            />
          )}

          {showFuturePanel && data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p
                style={{
                  borderRadius: 12,
                  border: `1px solid rgba(59,130,246,0.25)`,
                  background: STAFF_PANEL.accentSoft,
                  padding: 12,
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: STAFF_PANEL.textMuted,
                  margin: 0,
                }}
              >
                برنامه‌ریزی پروازهای آینده: ظرفیت، تعهد چارتری و قیمت‌گذاری پیشنهادی هوش مصنوعی بر اساس تحلیل
                تقاضا و رقبا.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>فیلتر بر اساس روز:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCalOpen((v) => !v)}
                    style={{
                      ...inputStyle,
                      width: 'auto',
                      padding: '8px 12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {futureDay ? faDigits(futureDay) : 'همه‌ی روزها'} ▾
                  </button>
                  {calOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 44,
                        zIndex: 40,
                        width: 288,
                        borderRadius: 12,
                        border: `1px solid ${STAFF_PANEL.cardBorder}`,
                        background: STAFF_PANEL.cardBg,
                        padding: 12,
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                      }}
                    >
                      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: STAFF_PANEL.text }}>{calendar.monthLabel}</span>
                        <span style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>فقط روزهای دارای پرواز</span>
                      </div>
                      <div style={{ marginBottom: 4, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {WEEKDAYS_FA.map((w, i) => (
                          <span
                            key={w}
                            style={{
                              padding: '2px 0',
                              textAlign: 'center',
                              fontSize: 9,
                              fontWeight: 800,
                              color: i === 6 ? STAFF_PANEL.danger : STAFF_PANEL.textMuted,
                            }}
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
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
                              type="button"
                              disabled={key == null}
                              onClick={() => {
                                if (key != null) {
                                  setFutureDay(key);
                                  setCalOpen(false);
                                }
                              }}
                              style={{
                                aspectRatio: '1',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 800,
                                border: 'none',
                                fontFamily: 'inherit',
                                cursor: key != null ? 'pointer' : 'default',
                                background: selected
                                  ? STAFF_PANEL.accent
                                  : key != null
                                    ? STAFF_PANEL.accentSoft
                                    : 'transparent',
                                color: selected
                                  ? '#fff'
                                  : key != null
                                    ? STAFF_PANEL.accent
                                    : STAFF_PANEL.textMuted,
                                opacity: key == null ? 0.5 : 1,
                              }}
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
                    type="button"
                    onClick={() => setFutureDay(null)}
                    style={{
                      borderRadius: 10,
                      border: `1px solid rgba(248,113,113,0.3)`,
                      background: 'rgba(248,113,113,0.08)',
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: STAFF_PANEL.danger,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ✕ پاک‌کردن فیلتر
                  </button>
                )}
              </div>

              <StaffPanelCard
                title="پروازهای آینده (برنامه‌ریزی‌شده)"
                padding={16}
                headerAction={
                  <button
                    type="button"
                    onClick={() => void onAiAnalysis()}
                    style={{
                      borderRadius: 10,
                      background: `linear-gradient(to left, ${STAFF_PANEL.accent}, ${STAFF_PANEL.purple})`,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ✦ تحلیل قیمت‌گذاری با هوش مصنوعی
                  </button>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {visibleFuture.length === 0 && (
                    <p style={{ padding: '20px 0', textAlign: 'center', fontSize: 11, color: STAFF_PANEL.textMuted, margin: 0 }}>
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
                      <div
                        key={u.id}
                        style={{
                          borderRadius: 12,
                          border: `1px solid ${STAFF_PANEL.cardBorder}`,
                          background: STAFF_PANEL.inputBg,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <button
                            type="button"
                            onClick={() => setExpandedFuture(expanded ? null : u.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              textAlign: 'right',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              padding: 0,
                              color: STAFF_PANEL.text,
                            }}
                          >
                            <span style={{ color: STAFF_PANEL.textMuted }}>{expanded ? '▾' : '◂'}</span>
                            <span>
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 900, color: STAFF_PANEL.text }}>
                                {routeLabel(u.originCode, u.destCode)}
                              </span>
                              <span style={{ display: 'block', fontSize: 11, color: STAFF_PANEL.textMuted }}>
                                شماره پرواز <span className="ltr font-num">{u.flightNo}</span> · تاریخ پرواز{' '}
                                <span className="font-num">{formatJalaliDateTime(u.departureAt)}</span>
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPlan(u)}
                            style={
                              priced
                                ? {
                                    borderRadius: 10,
                                    padding: '8px 12px',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    border: `1px solid ${STAFF_PANEL.inputBorder}`,
                                    background: STAFF_PANEL.cardBg,
                                    color: STAFF_PANEL.textMuted,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }
                                : {
                                    borderRadius: 10,
                                    padding: '8px 12px',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    border: 'none',
                                    background: STAFF_PANEL.accent,
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                  }
                            }
                          >
                            {priced ? 'ویرایش نرخ' : 'نرخ‌گذاری'}
                          </button>
                        </div>

                        {expanded && (
                          <>
                            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11 }}>
                              <div style={infoBlockStyle}>
                                <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>ظرفیت صندلی</div>
                                <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>
                                  {faDigits(u.capacity)} صندلی
                                </div>
                              </div>
                              <div style={infoBlockStyle}>
                                <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>تعهد چارتری</div>
                                <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.purple }}>
                                  {faDigits(u.charterSeats)} صندلی
                                </div>
                              </div>
                              <div style={infoBlockStyle}>
                                <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>قیمت پیشنهادی AI</div>
                                {u.aiSuggestion ? (
                                  <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.success }}>
                                    {faMoney(u.aiSuggestion.priceIrr)} تومان{' '}
                                    <span style={{ ...staffStatusStyle('purple'), padding: '2px 4px', fontSize: 9 }}>AI</span>
                                  </div>
                                ) : (
                                  <div style={{ color: STAFF_PANEL.textMuted }}>در انتظار تحلیل</div>
                                )}
                              </div>
                              <div style={infoBlockStyle}>
                                <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>نرخ نهایی / تخصیص</div>
                                {priced ? (
                                  <>
                                    <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.success }}>
                                      {faMoney(u.basePriceIrr ?? 0)} تومان
                                    </div>
                                    <div className="font-num" style={{ fontSize: 9, color: STAFF_PANEL.textMuted }}>
                                      آژانس {faDigits(u.agencySeatsAllocated ?? 0)} · مستقیم {faDigits(direct)}
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ color: STAFF_PANEL.textMuted }}>تعیین نشده</div>
                                )}
                              </div>
                            </div>
                            {u.aiSuggestion && (
                              <div
                                style={{
                                  marginTop: 12,
                                  borderRadius: 10,
                                  border: `1px solid rgba(168,85,247,0.25)`,
                                  background: `linear-gradient(to left, ${STAFF_PANEL.accentSoft}, rgba(168,85,247,0.05))`,
                                  padding: 12,
                                }}
                              >
                                <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 900, color: STAFF_PANEL.purple }}>
                                  تحلیل هوش مصنوعی — چرا این قیمت؟
                                </div>
                                <p style={{ marginBottom: 8, fontSize: 11, lineHeight: 1.6, color: STAFF_PANEL.text }}>{u.aiSuggestion.reason}</p>
                                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {u.aiSuggestion.factors.map((fc) => (
                                    <li key={fc} style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>
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
              </StaffPanelCard>
            </div>
          )}
        </>
      )}

      {addOpen && (
        <Modal dark title="افزودن پرواز جدید" onClose={() => setAddOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="nf-origin" style={labelStyle}>
                  مبدأ
                </label>
                <select
                  id="nf-origin"
                  value={addForm.originCode}
                  onChange={(e) => setAddForm((f) => ({ ...f, originCode: e.target.value }))}
                  style={inputStyle}
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
                <label htmlFor="nf-dest" style={labelStyle}>
                  مقصد
                </label>
                <select
                  id="nf-dest"
                  value={addForm.destCode}
                  onChange={(e) => setAddForm((f) => ({ ...f, destCode: e.target.value }))}
                  style={inputStyle}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label htmlFor="nf-no" style={labelStyle}>
                  شماره پرواز
                </label>
                <input
                  id="nf-no"
                  dir="ltr"
                  placeholder="EP-901"
                  value={addForm.flightNo}
                  onChange={(e) => setAddForm((f) => ({ ...f, flightNo: e.target.value }))}
                  className="font-num"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="nf-date" style={labelStyle}>
                  تاریخ (جلالی)
                </label>
                <input
                  id="nf-date"
                  placeholder="۱۴۰۵/۰۴/۲۵"
                  value={addForm.date}
                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                  className="font-num"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="nf-time" style={labelStyle}>
                  ساعت
                </label>
                <input
                  id="nf-time"
                  dir="ltr"
                  placeholder="08:30"
                  value={addForm.time}
                  onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))}
                  className="font-num"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="nf-cap" style={labelStyle}>
                  ظرفیت (صندلی)
                </label>
                <input
                  id="nf-cap"
                  dir="ltr"
                  placeholder="180"
                  value={addForm.capacity}
                  onChange={(e) => setAddForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="font-num"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="nf-price" style={labelStyle}>
                  قیمت بلیط (تومان)
                </label>
                <input
                  id="nf-price"
                  dir="ltr"
                  placeholder="3800000"
                  value={addForm.priceToman}
                  onChange={(e) => setAddForm((f) => ({ ...f, priceToman: e.target.value }))}
                  className="font-num"
                  style={inputStyle}
                />
              </div>
            </div>
            {addError && (
              <p role="alert" style={{ fontSize: 11, color: STAFF_PANEL.danger, margin: 0 }}>
                {addError}
              </p>
            )}
            <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
              <StaffPrimaryButton onClick={() => void onSubmitAdd()} style={{ flex: 1, padding: '10px 16px' }}>
                افزودن پرواز
              </StaffPrimaryButton>
              <button type="button" onClick={() => setAddOpen(false)} style={secondaryButtonStyle}>
                انصراف
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          dark
          title={`${routeLabel(detail.originCode, detail.destCode)} · ${detail.flightNo}`}
          onClose={() => setDetail(null)}
        >
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
            <div style={infoBlockStyle}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>صندلی فروخته‌شده</div>
              <div className="font-num" style={{ fontWeight: 900, color: STAFF_PANEL.text }}>
                {faDigits(detail.sold)} / {faDigits(detail.capacity)}
              </div>
            </div>
            <div style={infoBlockStyle}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>ضریب اشغال</div>
              <div className="font-num" style={{ fontWeight: 900, color: STAFF_PANEL.success }}>{faDigits(detail.occupancyPct)}٪</div>
            </div>
            <div style={infoBlockStyle}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>قیمت پایه</div>
              <div className="font-num" style={{ fontWeight: 900, color: STAFF_PANEL.accent }}>
                {detail.basePriceIrr != null ? `${faMoney(detail.basePriceIrr)} تومان` : '—'}
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: 8, fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>تفکیک کانال فروش صندلی</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {detail.channels.map((c) => {
              const meta = CHANNEL_META[c.channel];
              const pct = detail.sold > 0 ? Math.round((c.seats / detail.sold) * 100) : 0;
              return (
                <div key={c.channel}>
                  <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: STAFF_PANEL.textMuted }}>{meta.label}</span>
                    <span className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>
                      {faDigits(c.seats)} صندلی · {faMoney(c.revenueIrr)} تومان
                    </span>
                  </div>
                  <div style={{ height: 6, overflow: 'hidden', borderRadius: 4, background: STAFF_PANEL.inputBg }}>
                    <div style={{ height: '100%', background: meta.barColor, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 10,
              background: STAFF_PANEL.inputBg,
              padding: 12,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>مجموع درآمد پرواز</span>
            <span className="font-num" style={{ fontSize: 13, fontWeight: 900, color: STAFF_PANEL.accent }}>
              {faMoney(detail.totalRevenueIrr)} تومان
            </span>
          </div>

          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: `1px solid ${STAFF_PANEL.inputBorder}`,
              padding: 12,
            }}
          >
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>نوع هواپیما</span>
              {!aircraftChangeOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAircraftType(detail.aircraftType);
                    setAircraftChangeError(null);
                    setAircraftChangeOpen(true);
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: STAFF_PANEL.accent,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  تغییر
                </button>
              )}
            </div>
            {!aircraftChangeOpen ? (
              <div style={{ fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>{detail.aircraftType}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  value={selectedAircraftType}
                  onChange={(e) => setSelectedAircraftType(e.target.value)}
                  style={{ ...inputStyle, padding: 8, fontSize: 12 }}
                >
                  {aircraftTypes.map((t) => (
                    <option key={t.aircraftType} value={t.aircraftType}>
                      {t.aircraftType} (ظرفیت {faDigits(t.capacity)})
                    </option>
                  ))}
                </select>
                {aircraftChangeError && (
                  <p role="alert" style={{ fontSize: 11, color: STAFF_PANEL.danger, margin: 0 }}>
                    {aircraftChangeError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <StaffPrimaryButton disabled={aircraftChangeBusy} onClick={() => void onChangeAircraft()}>
                    {aircraftChangeBusy ? 'در حال ثبت…' : 'ثبت تغییر'}
                  </StaffPrimaryButton>
                  <button type="button" onClick={() => setAircraftChangeOpen(false)} style={secondaryButtonStyle}>
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
          dark
          title={`نرخ‌گذاری و تخصیص · ${routeLabel(plan.originCode, plan.destCode)}`}
          onClose={() => setPlan(null)}
        >
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div style={infoBlockStyle}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>ظرفیت</div>
              <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(plan.capacity)} صندلی</div>
            </div>
            <div style={infoBlockStyle}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>تعهد چارتری</div>
              <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.purple }}>{faDigits(plan.charterSeats)} صندلی</div>
            </div>
          </div>

          <label htmlFor="plan-price" style={labelStyle}>
            نرخ نهایی (تومان)
          </label>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <input
              id="plan-price"
              dir="ltr"
              value={planPrice}
              onChange={(e) => setPlanPrice(e.target.value)}
              className="font-num"
              style={{ ...inputStyle, flex: 1 }}
            />
            {plan.aiSuggestion && (
              <button
                type="button"
                onClick={() => setPlanPrice(String(Math.round(plan.aiSuggestion!.priceIrr / 10)))}
                style={{
                  borderRadius: 10,
                  border: `1px solid rgba(168,85,247,0.35)`,
                  background: 'rgba(168,85,247,0.08)',
                  padding: '0 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: STAFF_PANEL.purple,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                استفاده از قیمت AI
              </button>
            )}
          </div>

          <label htmlFor="plan-agency" style={labelStyle}>
            تخصیص صندلی آژانس (حداکثر {faDigits(maxAgencySeats)})
          </label>
          <input
            id="plan-agency"
            type="range"
            min={0}
            max={maxAgencySeats}
            value={Math.min(agencySeatsNum, maxAgencySeats)}
            onChange={(e) => setPlanAgency(e.target.value)}
            style={{ marginBottom: 8, width: '100%', accentColor: STAFF_PANEL.accent }}
          />
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
            <div style={{ ...infoBlockStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>چارتری</div>
              <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.purple }}>{faDigits(plan.charterSeats)}</div>
            </div>
            <div style={{ ...infoBlockStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>آژانس</div>
              <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.success }}>{faDigits(agencySeatsNum)}</div>
            </div>
            <div style={{ ...infoBlockStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>مستقیم</div>
              <div className="font-num" style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{faDigits(directSeats)}</div>
            </div>
          </div>
          <div style={{ marginBottom: 12, display: 'flex', height: 8, overflow: 'hidden', borderRadius: 4, background: STAFF_PANEL.inputBg }}>
            <div
              style={{ background: STAFF_PANEL.purple, width: `${plan.capacity > 0 ? (plan.charterSeats / plan.capacity) * 100 : 0}%` }}
            />
            <div
              style={{ background: STAFF_PANEL.success, width: `${plan.capacity > 0 ? (agencySeatsNum / plan.capacity) * 100 : 0}%` }}
            />
            <div
              style={{ background: STAFF_PANEL.accent, width: `${plan.capacity > 0 ? (directSeats / plan.capacity) * 100 : 0}%` }}
            />
          </div>

          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ borderRadius: 10, border: `1px solid ${STAFF_PANEL.inputBorder}` }}>
              <JalaliDatePicker
                label="شروع فروش"
                value={planSaleStart}
                onChange={setPlanSaleStart}
                testId="plan-sale-start"
              />
            </div>
            <div style={{ borderRadius: 10, border: `1px solid ${STAFF_PANEL.inputBorder}` }}>
              <JalaliDatePicker
                label="پایان فروش"
                value={planSaleEnd}
                onChange={setPlanSaleEnd}
                minDate={planSaleStart ?? undefined}
                testId="plan-sale-end"
              />
            </div>
          </div>

          <StaffPrimaryButton onClick={() => void onSubmitPlan()} style={{ width: '100%', padding: '10px 16px' }}>
            ثبت نرخ و تخصیص صندلی
          </StaffPrimaryButton>

          <div style={{ marginTop: 20, borderTop: `1px solid ${STAFF_PANEL.sidebarBorder}`, paddingTop: 16 }}>
            <h3 style={{ marginBottom: 8, fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>سهمیه‌های صندلی آژانس‌ها</h3>
            {allotments.length === 0 && (
              <p style={{ marginBottom: 8, fontSize: 11, color: STAFF_PANEL.textMuted }}>هنوز سهمیه‌ای برای این پرواز ثبت نشده است.</p>
            )}
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allotments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 10,
                    background: STAFF_PANEL.inputBg,
                    padding: '8px 10px',
                    fontSize: 11,
                  }}
                >
                  <span style={{ fontWeight: 800, color: STAFF_PANEL.text }}>{a.agencyName}</span>
                  <span className="font-num" style={{ color: STAFF_PANEL.textMuted }}>{faDigits(a.seatsAllocated)} صندلی</span>
                  <span style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>{a.type === 'SOFT' ? 'نرم' : 'سخت'}</span>
                  <button
                    type="button"
                    onClick={() => void onDeleteAllotment(a.id)}
                    style={{ color: STAFF_PANEL.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    aria-label={`حذف سهمیه ${a.agencyName}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <select
                aria-label="آژانس"
                value={newAllotmentAgencyId}
                onChange={(e) => setNewAllotmentAgencyId(e.target.value)}
                style={{ ...inputStyle, minWidth: 120, flex: 1 }}
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
                className="font-num"
                style={{ ...inputStyle, width: 80 }}
              />
              <select
                aria-label="نوع سهمیه"
                value={newAllotmentType}
                onChange={(e) => setNewAllotmentType(e.target.value as 'HARD' | 'SOFT')}
                style={inputStyle}
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
                className="font-num"
                style={{ ...inputStyle, width: 96 }}
              />
              <button
                type="button"
                onClick={() => void onAddAllotment()}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${STAFF_PANEL.accent}`,
                  background: 'transparent',
                  padding: '0 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: STAFF_PANEL.accent,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + افزودن
              </button>
            </div>
            {newAllotmentType === 'SOFT' && (
              <div style={{ marginTop: 8, maxWidth: 320, borderRadius: 10, border: `1px solid ${STAFF_PANEL.inputBorder}` }}>
                <JalaliDatePicker
                  label="موعد آزادسازی"
                  value={newAllotmentReleaseAt}
                  onChange={setNewAllotmentReleaseAt}
                  testId="allotment-release"
                />
              </div>
            )}
            {allotmentError && <p style={{ marginTop: 8, fontSize: 11, color: STAFF_PANEL.danger }}>{allotmentError}</p>}
          </div>

          <FareRulesSection instanceId={plan.id} />
        </Modal>
      )}
    </div>
  );
}
