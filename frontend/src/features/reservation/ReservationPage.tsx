import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelBooking,
  changeSeat,
  fetchPnrDetail,
  fetchPnrList,
  fetchReservationDashboardStats,
  fetchReservationFlights,
  fetchSeatMap,
  issuePnr,
  lockSeat,
  markNoShow,
  releaseLock,
  searchFlights,
} from '../../api/reservation';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime, parseJalaliDateToIso } from '../../lib/jalali';
import Modal from '../../components/Modal';
import type {
  FlightSearchResult,
  PnrDetail,
  PnrGroup,
  ReservationDashboardStats,
  ReservationFlightRow,
  SeatCell,
  SeatMap,
} from '../../types/reservation';

type SubTab = 'dash' | 'pnr' | 'flights' | 'new';

const STATUS_LABEL: Record<string, { label: string; className: string; darkClass: string }> = {
  TICKETED: {
    label: 'صادرشده',
    className: 'bg-[#10b98124] text-[#059669]',
    darkClass: 'bg-[rgba(16,185,129,.14)] text-[#34d399]',
  },
  CANCELLED: {
    label: 'لغوشده',
    className: 'bg-danger/15 text-danger',
    darkClass: 'bg-[rgba(248,113,113,.14)] text-[#f87171]',
  },
  DRAFT: {
    label: 'پیش‌نویس',
    className: 'bg-surface text-text-2',
    darkClass: 'bg-[#18223a] text-[#9fb0c7]',
  },
  HELD: {
    label: 'در انتظار',
    className: 'bg-[#f59e0b24] text-[#b45309]',
    darkClass: 'bg-[rgba(245,158,11,.14)] text-[#fbbf24]',
  },
  PAID: {
    label: 'پرداخت‌شده',
    className: 'bg-[#3b82f624] text-[#1d4ed8]',
    darkClass: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]',
  },
  EXPIRED: {
    label: 'منقضی',
    className: 'bg-surface text-muted',
    darkClass: 'bg-[#18223a] text-[#6b7b94]',
  },
  REFUNDED: {
    label: 'مستردشده',
    className: 'bg-surface text-muted',
    darkClass: 'bg-[#18223a] text-[#6b7b94]',
  },
  FLOWN: {
    label: 'پرواز شده',
    className: 'bg-[#3b82f624] text-[#1d4ed8]',
    darkClass: 'bg-[rgba(59,130,246,.14)] text-[#60a5fa]',
  },
  NO_SHOW: {
    label: 'عدم حضور',
    className: 'bg-danger/15 text-danger',
    darkClass: 'bg-[rgba(248,113,113,.14)] text-[#f87171]',
  },
};

const AIRCRAFT_LABEL: Record<string, string> = {
  'MD-80': 'مک‌دانل داگلاس MD-80',
  'MD-88': 'مک‌دانل داگلاس MD-88',
  A320: 'ایرباس A320',
  'Airbus A320': 'ایرباس A320',
};

function aircraftLabel(type: string): string {
  return AIRCRAFT_LABEL[type] ?? type;
}

function remainingMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${faDigits(String(m).padStart(2, '0'))}:${faDigits(String(s).padStart(2, '0'))}`;
}

export default function ReservationPage() {
  const { user } = useAuth();
  const dark =
    user?.role === 'CEO' ||
    user?.role === 'BOARD_CHAIR' ||
    user?.role === 'SENIOR_MANAGER';
  const canLock = user?.role === 'CEO' || user?.role === 'BOARD_CHAIR' || user?.role === 'IT_MANAGER';

  const [subTab, setSubTab] = useState<SubTab>('pnr');
  const [stats, setStats] = useState<ReservationDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [pnrGroups, setPnrGroups] = useState<PnrGroup[]>([]);
  const [pnrQuery, setPnrQuery] = useState('');
  const [detailPnr, setDetailPnr] = useState<string | null>(null);
  const [detail, setDetail] = useState<PnrDetail | null>(null);
  const [changeSeatInput, setChangeSeatInput] = useState('');

  const [flightRows, setFlightRows] = useState<ReservationFlightRow[]>([]);
  const [flightQ, setFlightQ] = useState('');

  const [activeFlightInstanceId, setActiveFlightInstanceId] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [seatMapOpen, setSeatMapOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<SeatCell | null>(null);
  const [seatFormMode, setSeatFormMode] = useState<'lock' | 'issue' | 'sold'>('lock');
  const [seatForm, setSeatForm] = useState({ name: '', nid: '', mobile: '', emergency: false });
  const [tick, setTick] = useState(0);

  const [searchForm, setSearchForm] = useState({ origin: '', dest: '', date: '' });
  const [searchResults, setSearchResults] = useState<FlightSearchResult[]>([]);

  const loadStats = useCallback(() => {
    fetchReservationDashboardStats().then(setStats).catch(() => undefined);
  }, []);

  const loadPnrList = useCallback(async () => {
    try {
      setPnrGroups(await fetchPnrList(pnrQuery || undefined));
    } catch {
      setError('خطا در دریافت فهرست رزروها.');
    }
  }, [pnrQuery]);

  const loadFlights = useCallback(async () => {
    try {
      setFlightRows(await fetchReservationFlights(flightQ || undefined));
    } catch {
      setError('خطا در دریافت فهرست پروازها.');
    }
  }, [flightQ]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPnrList(), 250);
    return () => clearTimeout(timer);
  }, [loadPnrList]);

  useEffect(() => {
    if (subTab !== 'flights' && subTab !== 'dash') return;
    const timer = setTimeout(() => void loadFlights(), 250);
    return () => clearTimeout(timer);
  }, [loadFlights, subTab]);

  useEffect(() => {
    if (!seatMapOpen) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [seatMapOpen]);

  const loadSeatMap = useCallback(async (flightInstanceId: string, openModal = true) => {
    try {
      const map = await fetchSeatMap(flightInstanceId);
      setSeatMap(map);
      setActiveFlightInstanceId(flightInstanceId);
      setSelectedSeat(null);
      if (openModal) setSeatMapOpen(true);
    } catch {
      setError('خطا در دریافت نقشهٔ صندلی.');
    }
  }, []);

  async function openPnrDetail(pnr: string) {
    setDetailPnr(pnr);
    try {
      setDetail(await fetchPnrDetail(pnr));
    } catch {
      setError('خطا در دریافت جزئیات رزرو.');
    }
  }

  async function onCancel() {
    if (!detailPnr) return;
    try {
      await cancelBooking(detailPnr);
      setNotice('رزرو لغو شد.');
      setDetailPnr(null);
      await loadPnrList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در لغو رزرو.');
    }
  }

  async function onChangeSeat() {
    if (!detailPnr || !changeSeatInput.trim()) return;
    try {
      await changeSeat(detailPnr, changeSeatInput.trim());
      setNotice('صندلی رزرو تغییر کرد.');
      setDetail(await fetchPnrDetail(detailPnr));
      setChangeSeatInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در تغییر صندلی.');
    }
  }

  async function onMarkNoShow() {
    if (!detailPnr) return;
    try {
      await markNoShow(detailPnr);
      setNotice('عدم حضور مسافر ثبت شد.');
      setDetail(await fetchPnrDetail(detailPnr));
      await loadPnrList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت عدم حضور.');
    }
  }

  function onSeatClick(seat: SeatCell) {
    setSelectedSeat(seat);
    setSeatForm({ name: '', nid: '', mobile: '', emergency: false });
    if (seat.status === 'SOLD' && seat.occupant) {
      setSeatFormMode('sold');
      return;
    }
    if (!canLock) return;
    if (seat.status === 'LOCKED') {
      // Release via the countdown chips; selecting the seat only highlights it.
      setSeatFormMode('lock');
      setSelectedSeat(seat);
      return;
    }
    setSeatFormMode(subTab === 'new' ? 'issue' : 'lock');
  }

  async function onReleaseChip(lockId: string) {
    try {
      await releaseLock(lockId);
      if (activeFlightInstanceId) await loadSeatMap(activeFlightInstanceId, false);
    } catch {
      setError('خطا در آزادسازی صندلی.');
    }
  }

  async function onSubmitSeatForm() {
    if (!selectedSeat || !activeFlightInstanceId) return;
    try {
      if (seatFormMode === 'lock') {
        await lockSeat(activeFlightInstanceId, {
          seatCode: selectedSeat.seatCode,
          reason: seatForm.emergency
            ? 'لاک اضطراری بدون مسافر'
            : seatForm.name.trim()
              ? `رزرو مدیریتی برای ${seatForm.name.trim()}`
              : 'لاک مدیریتی از پنل هواپیما',
          classification: 'PAYABLE',
          passengerName: seatForm.emergency ? undefined : seatForm.name || undefined,
          passengerNationalId: seatForm.emergency ? undefined : seatForm.nid || undefined,
          passengerMobile: seatForm.emergency ? undefined : seatForm.mobile || undefined,
        });
        setNotice(`صندلی ${selectedSeat.seatCode} لاک شد ✓`);
      } else if (seatFormMode === 'issue') {
        if (!seatForm.name.trim()) {
          setError('نام مسافر الزامی است.');
          return;
        }
        const pnr = await issuePnr({
          flightInstanceId: activeFlightInstanceId,
          seatCode: selectedSeat.seatCode,
          passengerName: seatForm.name.trim(),
          passengerNationalId: seatForm.nid || undefined,
          passengerMobile: seatForm.mobile || undefined,
        });
        setNotice(`رزرو ${pnr.pnr} صادر شد ✓`);
      }
      setSelectedSeat(null);
      await loadSeatMap(activeFlightInstanceId, false);
      await loadPnrList();
      await loadFlights();
      loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت.');
    }
  }

  async function onSearch() {
    if (!searchForm.origin.trim() || !searchForm.dest.trim() || !searchForm.date.trim()) {
      setError('مبدأ، مقصد و تاریخ الزامی است.');
      return;
    }
    const iso = parseJalaliDateToIso(searchForm.date) ?? searchForm.date;
    try {
      setSearchResults(await searchFlights(searchForm.origin.trim(), searchForm.dest.trim(), iso));
    } catch {
      setError('خطا در جستجوی پرواز.');
    }
  }

  const lockedSeats = useMemo(() => {
    void tick;
    if (!seatMap) return [];
    return seatMap.rows
      .flatMap((r) => r.seats)
      .filter((s) => s.status === 'LOCKED' && s.lockId);
  }, [seatMap, tick]);

  const shell = dark ? 'px-[21px] pb-[34px] pt-[18px]' : 'p-8';
  const tabs: [SubTab, string][] = dark
    ? [
        ['dash', 'داشبورد'],
        ['pnr', 'مدیریت رزروها'],
        ['flights', 'پروازها'],
        ['new', 'رزرو جدید'],
      ]
    : [
        ['pnr', 'مدیریت رزروها'],
        ['flights', 'پروازها'],
        ['new', 'رزرو جدید'],
      ];

  return (
    <div className={shell}>
      <div className={dark ? 'mb-5' : 'mb-6'}>
        <h1 className={dark ? 'text-[20.5px] font-black text-white' : 'text-xl font-black text-ink'}>
          سامانه رزرواسیون{dark ? ' پرواز' : ''}
        </h1>
        <p className={dark ? 'mt-1 text-[11.5px] text-[#6b7b94]' : 'mt-1 text-sm text-muted'}>
          {dark
            ? 'جستجو و رزرو، مدیریت PNRها، صدور بلیط و دسترسی API آژانس‌ها'
            : 'مدیریت رزروها، نقشهٔ صندلی و صدور دستی PNR'}
        </p>
      </div>

      {error && (
        <p
          className={`mb-4 rounded-lg p-3 text-sm ${
            dark ? 'bg-[rgba(248,113,113,.12)] text-[#f87171]' : 'bg-danger/10 text-danger'
          }`}
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className={`mb-4 rounded-lg p-3 text-sm ${
            dark ? 'bg-[rgba(16,185,129,.12)] text-[#34d399]' : 'bg-[#10b98115] text-[#059669]'
          }`}
        >
          {notice}
        </p>
      )}

      <div
        className={
          dark
            ? 'mb-[18px] flex w-max max-w-full flex-wrap gap-1 rounded-[13px] border border-[#28344c] bg-[#18223a] p-1'
            : 'mb-6 flex w-max gap-1 rounded-xl border border-border bg-surface p-1'
        }
      >
        {tabs.map(([key, label]) => {
          const on = subTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSubTab(key)}
              className={
                dark
                  ? `rounded-[9px] px-[13px] py-[7px] text-[11.5px] transition ${
                      on ? 'bg-[#3b82f6] font-extrabold text-white' : 'font-medium text-[#9fb0c7]'
                    }`
                  : `rounded-lg px-4 py-2 text-xs font-bold transition ${
                      on ? 'bg-white text-ink shadow-sm' : 'text-text-2'
                    }`
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {subTab === 'dash' && (
        <DashboardTab dark={dark} stats={stats} />
      )}

      {subTab === 'pnr' && (
        <section
          className={
            dark
              ? 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]'
              : 'rounded-xl border border-border bg-white p-5'
          }
        >
          <div className={dark ? 'mb-3.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]' : ''}>
            {dark && (
              <>
                <input
                  value={pnrQuery}
                  onChange={(e) => setPnrQuery(e.target.value)}
                  placeholder="کد رزرو (PNR)"
                  className="h-[42px] rounded-[10px] border border-[#28344c] bg-[#0f1623] px-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
                />
                <input
                  value=""
                  readOnly
                  placeholder="نام خانوادگی مسافر"
                  className="h-[42px] rounded-[10px] border border-[#28344c] bg-[#0f1623] px-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94]"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => void loadPnrList()}
                  className="h-[42px] rounded-[10px] bg-[#3b82f6] px-5 text-xs font-extrabold text-white"
                >
                  جستجو
                </button>
              </>
            )}
            {!dark && (
              <input
                value={pnrQuery}
                onChange={(e) => setPnrQuery(e.target.value)}
                placeholder="جستجو با کد PNR یا نام مسافر…"
                className="mb-4 h-[42px] w-full rounded-xl border border-border bg-white px-4 text-xs outline-none transition focus:border-accent"
              />
            )}
          </div>
          {dark && (
            <h3 className="mb-3 text-[13.5px] font-extrabold text-white">آخرین رزروهای ثبت‌شده</h3>
          )}
          {pnrGroups.length === 0 ? (
            <p className={`py-6 text-center text-xs ${dark ? 'text-[#6b7b94]' : 'text-muted'}`}>
              رزروی یافت نشد.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {pnrGroups.map((g) => (
                <div
                  key={g.flightInstanceId}
                  className={
                    dark
                      ? 'overflow-hidden rounded-[12px] border border-[#1f2a3d]'
                      : 'overflow-hidden rounded-xl border border-border'
                  }
                >
                  <div
                    className={
                      dark
                        ? 'flex items-center gap-3 bg-[#0f1623] px-4 py-2.5 text-xs'
                        : 'flex items-center gap-3 bg-surface px-4 py-2.5 text-xs'
                    }
                  >
                    <span className="ltr font-num font-bold text-[#60a5fa]">{g.flightNo}</span>
                    <span className={`flex-1 font-bold ${dark ? 'text-white' : 'text-ink'}`}>
                      {g.route}
                    </span>
                    <button
                      type="button"
                      onClick={() => void loadSeatMap(g.flightInstanceId)}
                      className="text-[11px] font-bold text-[#60a5fa]"
                    >
                      نقشهٔ صندلی {g.flightNo}
                    </button>
                    <span className={dark ? 'text-[#6b7b94]' : 'text-muted'}>
                      {formatJalaliDate(g.departureAt)}
                    </span>
                  </div>
                  {dark ? (
                    <div className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-2 border-b border-[#1f2a3d] px-4 py-2 text-[10px] text-[#6b7b94]">
                      <span>PNR</span>
                      <span>مسیر</span>
                      <span>مسافر</span>
                      <span>وضعیت</span>
                    </div>
                  ) : null}
                  <ul className={dark ? 'divide-y divide-[#1f2a3d]' : 'divide-y divide-border'}>
                    {g.rows.map((r) => {
                      const st = STATUS_LABEL[r.status] ?? {
                        label: r.status,
                        className: 'bg-surface text-text-2',
                        darkClass: 'bg-[#18223a] text-[#9fb0c7]',
                      };
                      return (
                        <li
                          key={r.pnr}
                          className={
                            dark
                              ? 'grid grid-cols-[1fr_1.2fr_1.2fr_auto] items-center gap-2 px-4 py-2.5 text-xs'
                              : 'flex items-center gap-3 px-4 py-2.5 text-xs'
                          }
                        >
                          <button
                            type="button"
                            onClick={() => void openPnrDetail(r.pnr)}
                            className={`ltr font-num font-bold underline decoration-dashed underline-offset-4 ${
                              dark ? 'text-[#60a5fa]' : 'text-text-2'
                            }`}
                          >
                            {r.pnr}
                          </button>
                          {dark && <span className="text-[#9fb0c7]">{g.route}</span>}
                          <span className={dark ? 'text-[#e7ecf3]' : 'flex-1 text-ink'}>
                            {r.passenger}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              dark ? st.darkClass : st.className
                            }`}
                          >
                            {st.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {subTab === 'flights' && (
        <FlightsTab
          dark={dark}
          rows={flightRows}
          q={flightQ}
          onQ={setFlightQ}
          onOpenSeatMap={(id) => void loadSeatMap(id)}
        />
      )}

      {subTab === 'new' && (
        <div className="flex flex-col gap-4">
          <section
            className={
              dark
                ? 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]'
                : 'rounded-xl border border-border bg-white p-5'
            }
          >
            <h2 className={`mb-4 text-sm font-bold ${dark ? 'text-white' : 'text-ink'}`}>
              جستجوی پرواز
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {(
                [
                  ['origin', 'مبدأ'],
                  ['dest', 'مقصد'],
                  ['date', '۱۴۰۵/۰۵/۱۲'],
                ] as const
              ).map(([key, ph]) => (
                <input
                  key={key}
                  value={searchForm[key]}
                  onChange={(e) => setSearchForm({ ...searchForm, [key]: e.target.value })}
                  placeholder={ph}
                  className={
                    dark
                      ? 'font-num h-[42px] rounded-[10px] border border-[#28344c] bg-[#0f1623] px-3 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]'
                      : 'font-num h-[42px] rounded-lg border border-border px-3 text-xs outline-none focus:border-accent'
                  }
                />
              ))}
              <button
                type="button"
                onClick={() => void onSearch()}
                className="rounded-[10px] bg-[#3b82f6] px-4 text-xs font-bold text-white"
              >
                جستجو
              </button>
            </div>
          </section>

          {searchResults.length > 0 && (
            <section className="flex flex-col gap-2">
              {searchResults.map((f) => (
                <div
                  key={f.flightInstanceId}
                  className={
                    dark
                      ? 'flex flex-wrap items-center gap-4 rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-4 text-xs'
                      : 'flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-xs'
                  }
                >
                  <span className="ltr font-num font-bold text-[#60a5fa]">{f.flightNo}</span>
                  <span className={`flex-1 ${dark ? 'text-[#e7ecf3]' : 'text-ink'}`}>
                    {f.originCode} → {f.destCode} · {formatJalaliDateTime(f.departureAt)}
                  </span>
                  <span className="font-bold text-[#34d399]">{faMoney(f.priceIrr)} تومان</span>
                  <span className={dark ? 'text-[#6b7b94]' : 'text-muted'}>
                    {faDigits(f.seatsLeft)} صندلی
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadSeatMap(f.flightInstanceId)}
                    className="rounded-[10px] bg-[#3b82f6] px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    انتخاب صندلی
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {seatMapOpen && seatMap && (
        <SeatMapModal
          dark={dark}
          seatMap={seatMap}
          canLock={canLock}
          selectedSeat={selectedSeat}
          seatFormMode={seatFormMode}
          seatForm={seatForm}
          lockedSeats={lockedSeats}
          onClose={() => {
            setSeatMapOpen(false);
            setSelectedSeat(null);
          }}
          onSeatClick={onSeatClick}
          onReleaseChip={(id) => void onReleaseChip(id)}
          onFormChange={setSeatForm}
          onSubmit={() => void onSubmitSeatForm()}
          onOpenSoldPnr={(pnr) => void openPnrDetail(pnr)}
          onClearSelection={() => setSelectedSeat(null)}
        />
      )}

      {detailPnr && detail && (
        <Modal
          title={`رزرو ${detail.pnr}`}
          onClose={() => setDetailPnr(null)}
          variant={dark ? 'dark' : 'light'}
        >
          <div className="mb-4 rounded-xl bg-[#0f1726] p-4 text-white">
            <div className="mb-2 flex items-center justify-between">
              <span className="ltr font-num text-xs">PNR {detail.pnr}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  dark
                    ? STATUS_LABEL[detail.status]?.darkClass
                    : STATUS_LABEL[detail.status]?.className
                }`}
              >
                {STATUS_LABEL[detail.status]?.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-lg font-black">
              <span className="ltr">{detail.originCode}</span>
              <span>✈</span>
              <span className="ltr">{detail.destCode}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 border-t border-white/15 pt-3 text-[11px]">
              <div>
                <div className="text-white/50">مسافر</div>
                <div className="font-bold">{detail.passenger?.fullName ?? '—'}</div>
              </div>
              <div>
                <div className="text-white/50">صندلی</div>
                <div className="font-num font-bold text-[#fcd34d]">
                  {detail.passenger?.seatCode ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-white/50">تاریخ</div>
                <div className="font-bold">{formatJalaliDateTime(detail.departureAt)}</div>
              </div>
              <div>
                <div className="text-white/50">مبلغ</div>
                <div className="font-bold text-[#34d399]">{faMoney(detail.priceIrr)} تومان</div>
              </div>
            </div>
          </div>

          {canLock && detail.status !== 'CANCELLED' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={changeSeatInput}
                  onChange={(e) => setChangeSeatInput(e.target.value)}
                  placeholder="شماره صندلی جدید"
                  dir="ltr"
                  className={`font-num flex-1 rounded-lg p-2.5 text-xs outline-none ${
                    dark
                      ? 'border border-[#28344c] bg-[#0f1623] text-white focus:border-[#3b82f6]'
                      : 'border border-border focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => void onChangeSeat()}
                  className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-bold text-white"
                >
                  ثبت تغییر
                </button>
              </div>
              <button
                type="button"
                onClick={() => void onCancel()}
                className="rounded-lg bg-danger/10 px-4 py-2 text-xs font-bold text-danger"
              >
                لغو رزرو
              </button>
              {(detail.status === 'TICKETED' || detail.status === 'FLOWN') && (
                <button
                  type="button"
                  onClick={() => void onMarkNoShow()}
                  className={`rounded-lg px-4 py-2 text-xs font-bold ${
                    dark ? 'bg-[#18223a] text-[#9fb0c7]' : 'bg-surface text-text-2'
                  }`}
                >
                  ثبت عدم حضور مسافر
                </button>
              )}
            </div>
          )}
          {detail.status === 'CANCELLED' && (
            <p className="rounded-lg bg-danger/10 p-3 text-xs font-bold text-danger">
              این رزرو لغو شده است.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function DashboardTab({
  dark,
  stats,
}: {
  dark: boolean;
  stats: ReservationDashboardStats | null;
}) {
  if (!stats) {
    return <p className={`text-sm ${dark ? 'text-[#6b7b94]' : 'text-muted'}`}>در حال بارگذاری…</p>;
  }
  const cards = [
    { label: 'رزروهای امروز', value: faDigits(stats.todayBookings), color: 'text-white' },
    { label: 'PNRهای فعال', value: faDigits(stats.activePnrs), color: 'text-[#60a5fa]' },
    { label: 'صندلی فروخته‌شده', value: faDigits(stats.seatsSold), color: 'text-[#34d399]' },
    {
      label: 'درآمد رزروها',
      value: `${faMoney(stats.revenueIrr)} تومان`,
      color: 'text-[#fcd34d]',
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-[11px] sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            dark
              ? 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[13px]'
              : 'rounded-xl border border-border bg-white p-4'
          }
        >
          <div className={`mb-2 text-[11px] ${dark ? 'text-[#6b7b94]' : 'text-muted'}`}>
            {c.label}
          </div>
          <div className={`font-num text-[21px] font-black ${dark ? c.color : 'text-ink'}`}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlightsTab({
  dark,
  rows,
  q,
  onQ,
  onOpenSeatMap,
}: {
  dark: boolean;
  rows: ReservationFlightRow[];
  q: string;
  onQ: (v: string) => void;
  onOpenSeatMap: (id: string) => void;
}) {
  return (
    <section
      className={
        dark
          ? 'rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]'
          : 'rounded-xl border border-border bg-white p-5'
      }
    >
      <input
        value={q}
        onChange={(e) => onQ(e.target.value)}
        placeholder="جستجوی پرواز — مسیر یا شماره پرواز"
        className={
          dark
            ? 'mb-4 h-[42px] w-full rounded-[10px] border border-[#28344c] bg-[#0f1623] px-3 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]'
            : 'mb-4 h-[42px] w-full rounded-xl border border-border px-4 text-xs outline-none focus:border-accent'
        }
      />
      {rows.length === 0 ? (
        <p className={`py-6 text-center text-xs ${dark ? 'text-[#6b7b94]' : 'text-muted'}`}>
          پروازی یافت نشد.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((f) => {
            const occ = f.capacity === 0 ? 0 : Math.round((f.soldCount / f.capacity) * 100);
            return (
              <button
                key={f.flightInstanceId}
                type="button"
                onClick={() => onOpenSeatMap(f.flightInstanceId)}
                className={
                  dark
                    ? 'grid grid-cols-1 gap-3 rounded-[13px] border border-[#1f2a3d] bg-[#0f1623] px-3.5 py-3 text-start transition hover:border-[#3b82f6]/50 sm:grid-cols-[1.3fr_.7fr_.9fr_1.2fr_.9fr_auto]'
                    : 'flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 text-start text-xs hover:border-accent'
                }
              >
                <div>
                  <div className={`text-[13px] font-extrabold ${dark ? 'text-white' : 'text-ink'}`}>
                    {f.originCityFa} ↔ {f.destCityFa}
                  </div>
                  <div className={`ltr mt-0.5 text-[10px] ${dark ? 'text-[#6b7b94]' : 'text-muted'}`}>
                    {f.originCode} → {f.destCode}
                  </div>
                </div>
                <div className="ltr font-num font-bold text-[#60a5fa]">{f.flightNo}</div>
                <div className={`font-num text-[11px] ${dark ? 'text-[#cdd9ec]' : 'text-ink'}`}>
                  {formatJalaliDateTime(f.departureAt)}
                </div>
                <div className={`text-[11px] ${dark ? 'text-[#9fb0c7]' : 'text-text-2'}`}>
                  {aircraftLabel(f.aircraftType)}
                </div>
                <div>
                  <div className={`font-num text-[11px] font-bold ${dark ? 'text-white' : 'text-ink'}`}>
                    {faDigits(f.soldCount)} / {faDigits(f.capacity)}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#1a2436]">
                    <div
                      className="h-full rounded-full bg-[#34d399]"
                      style={{ width: `${Math.min(100, occ)}%` }}
                    />
                  </div>
                </div>
                <span className="rounded-full bg-[rgba(59,130,246,.16)] px-2.5 py-1 text-[10px] font-bold text-[#60a5fa]">
                  در حال فروش
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SeatMapModal({
  dark,
  seatMap,
  canLock,
  selectedSeat,
  seatFormMode,
  seatForm,
  lockedSeats,
  onClose,
  onSeatClick,
  onReleaseChip,
  onFormChange,
  onSubmit,
  onOpenSoldPnr,
  onClearSelection,
}: {
  dark: boolean;
  seatMap: SeatMap;
  canLock: boolean;
  selectedSeat: SeatCell | null;
  seatFormMode: 'lock' | 'issue' | 'sold';
  seatForm: { name: string; nid: string; mobile: string; emergency: boolean };
  lockedSeats: SeatCell[];
  onClose: () => void;
  onSeatClick: (seat: SeatCell) => void;
  onReleaseChip: (lockId: string) => void;
  onFormChange: (v: { name: string; nid: string; mobile: string; emergency: boolean }) => void;
  onSubmit: () => void;
  onOpenSoldPnr: (pnr: string) => void;
  onClearSelection: () => void;
}) {
  const route =
    seatMap.originCityFa && seatMap.destCityFa
      ? `${seatMap.originCityFa} ← ${seatMap.destCityFa}`
      : `${seatMap.originCode ?? ''} ← ${seatMap.destCode ?? ''}`;

  const cabinSections = useMemo(() => {
    const sections: { cabin: 'BUSINESS' | 'ECONOMY'; label: string; rows: SeatMap['rows'] }[] = [];
    for (const row of seatMap.rows) {
      const last = sections[sections.length - 1];
      if (!last || last.cabin !== row.cabin) {
        sections.push({
          cabin: row.cabin,
          label:
            row.cabin === 'BUSINESS'
              ? 'کلاس بیزینس (Business)'
              : 'کلاس اقتصادی (Economy)',
          rows: [row],
        });
      } else {
        last.rows.push(row);
      }
    }
    return sections;
  }, [seatMap.rows]);

  const freeCount =
    seatMap.freeCount ??
    Math.max(0, seatMap.capacity - seatMap.soldCount - seatMap.lockedCount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[#060a12]/72 p-[22px] backdrop-blur-[3px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`نقشه صندلی‌ها – ${seatMap.flightNo ?? ''}`}
        className="w-full max-w-[600px] overflow-hidden rounded-[18px] border border-[#22304a] bg-[#0f1725] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#1f2a3d] bg-gradient-to-l from-[#15233c] to-[#131c30] px-[18px] py-4">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-extrabold text-white">
              نقشه صندلی‌ها – <span className="ltr font-num">{seatMap.flightNo}</span>
            </h3>
            <div className="mt-0.5 text-[11px] text-[#9fb0c7]">
              {route} • {aircraftLabel(seatMap.aircraftType)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-white/10 text-lg text-[#cdd9ec]"
            aria-label="بستن"
          >
            ×
          </button>
        </div>

        <div className="px-[18px] py-[15px]">
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Legend chip="free" label={`آزاد (${faDigits(freeCount)})`} />
            <Legend chip="locked" label={`قفل موقت (${faDigits(seatMap.lockedCount)})`} />
            <Legend chip="sold" label={`رزرو قطعی (${faDigits(seatMap.soldCount)})`} />
          </div>

          <div className="mb-4 max-h-[350px] overflow-auto">
            {cabinSections.map((section) => (
              <div key={section.cabin} className="mb-3">
                <div className="mb-2 text-[11px] font-bold text-[#9fb0c7]">{section.label}</div>
                <div className="flex flex-col gap-1.5">
                  {section.rows.map((row) => {
                    const aisleAfterIndex = seatMap.cabinLayout[row.cabin].aisleAfterIndex;
                    return (
                      <div key={row.row} className="flex items-center justify-center gap-1.5">
                        <span className="font-num w-5 text-center text-[9px] font-bold text-[#6b7b94]">
                          {faDigits(row.row)}
                        </span>
                        {row.seats.map((s, idx) => {
                          const selected = selectedSeat?.seatCode === s.seatCode;
                          return (
                            <span key={s.seatCode} className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSeatClick(s)}
                                disabled={s.status !== 'SOLD' && !canLock}
                                aria-label={s.seatCode}
                                className={`ltr font-num flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border-[1.5px] text-[8.5px] font-bold transition ${seatTone(s.status, selected)} ${
                                  s.status === 'SOLD' || canLock
                                    ? 'cursor-pointer'
                                    : 'cursor-default'
                                }`}
                              >
                                {s.seatCode.replace(String(row.row), '')}
                              </button>
                              {idx === aisleAfterIndex - 1 && (
                                <span data-testid={`aisle-gap-${row.row}`} className="w-4" />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedSeat && seatFormMode === 'sold' && selectedSeat.occupant && (
            <div className="mb-3 rounded-[14px] border border-[#2a3550] bg-[#141d2e] p-[14px]">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[13px] font-extrabold text-white">
                  لاک دستی صندلی {selectedSeat.seatCode}
                </div>
                <button type="button" onClick={onClearSelection} className="text-[#9fb0c7]">
                  ×
                </button>
              </div>
              <div className="space-y-1.5 text-[12px] text-[#cdd9ec]">
                <div>
                  مسافر: <span className="font-bold">{selectedSeat.occupant.passengerName}</span>
                </div>
                <div>
                  وضعیت:{' '}
                  <span className="font-bold text-[#34d399]">
                    {STATUS_LABEL[selectedSeat.occupant.bookingStatus]?.label ??
                      selectedSeat.occupant.bookingStatus}
                  </span>
                </div>
                {seatMap.departureAt && (
                  <div>تاریخ پرواز: {formatJalaliDateTime(seatMap.departureAt)}</div>
                )}
                <div className="ltr font-num text-[#60a5fa]">PNR {selectedSeat.occupant.pnr}</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenSoldPnr(selectedSeat.occupant!.pnr)}
                className="mt-3 text-[11.5px] font-extrabold text-[#60a5fa]"
              >
                مشاهده جزئیات رزرو
              </button>
            </div>
          )}

          {selectedSeat &&
            seatFormMode !== 'sold' &&
            selectedSeat.status === 'FREE' &&
            canLock && (
            <div className="mb-3 rounded-[14px] border border-[#2a3550] bg-[#141d2e] p-[14px]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[13px] font-extrabold text-white">
                  {seatFormMode === 'issue'
                    ? `صدور PNR — صندلی ${selectedSeat.seatCode}`
                    : `لاک دستی صندلی ${selectedSeat.seatCode}`}
                </div>
                <button type="button" onClick={onClearSelection} className="text-[#9fb0c7]">
                  ×
                </button>
              </div>
              <label className="mb-1 block text-[11px] text-[#9fb0c7]" htmlFor="seat-pname">
                نام مسافر{seatFormMode === 'issue' ? '' : ' (اختیاری)'}
              </label>
              <input
                id="seat-pname"
                value={seatForm.name}
                onChange={(e) => onFormChange({ ...seatForm, name: e.target.value })}
                placeholder="مثلاً علی رضایی"
                disabled={seatForm.emergency}
                className="mb-2 h-10 w-full rounded-[9px] border border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none focus:border-[#3b82f6] disabled:opacity-50"
              />
              <label className="mb-1 block text-[11px] text-[#9fb0c7]" htmlFor="seat-nid">
                کد ملی (اختیاری)
              </label>
              <input
                id="seat-nid"
                dir="ltr"
                value={seatForm.nid}
                onChange={(e) => onFormChange({ ...seatForm, nid: e.target.value })}
                placeholder="مثلاً 0012345678"
                disabled={seatForm.emergency}
                className="font-num mb-3 h-10 w-full rounded-[9px] border border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none focus:border-[#3b82f6] disabled:opacity-50"
              />
              {seatFormMode === 'lock' && (
                <label className="mb-3 flex items-center gap-2 text-[11px] text-[#9fb0c7]">
                  <input
                    type="checkbox"
                    checked={seatForm.emergency}
                    onChange={(e) =>
                      onFormChange({
                        ...seatForm,
                        emergency: e.target.checked,
                        name: '',
                        nid: '',
                      })
                    }
                  />
                  قفل بدون نام مسافر (لاک اضطراری / نگه‌داشت صندلی)
                </label>
              )}
              <button
                type="button"
                onClick={onSubmit}
                className="mb-2 w-full rounded-[11px] bg-[#f59e0b] py-3 text-[12px] font-extrabold text-[#1a1206]"
              >
                {seatFormMode === 'issue' ? 'صدور PNR و بلیط' : 'لاک صندلی'}
              </button>
            </div>
          )}

          {canLock && lockedSeats.length > 0 && (
            <div className="border-t border-[#1f2a3d] pt-3">
              <div className="mb-2 text-[11px] font-bold text-[#9fb0c7]">
                صندلی‌های قفل‌شده – شمارش معکوس آزادسازی خودکار
              </div>
              <div className="flex flex-col gap-1.5">
                {lockedSeats.map((s) => (
                  <div
                    key={s.seatCode}
                    className="flex items-center justify-between rounded-[10px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.1)] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => s.lockId && onReleaseChip(s.lockId)}
                      className="ltr font-num text-[12px] font-extrabold text-[#fcd34d]"
                      title="برای آزادسازی کلیک کنید"
                    >
                      {s.seatCode} ×
                    </button>
                    <span className="font-num text-[12px] font-bold text-[#f59e0b]">
                      {formatCountdown(remainingMs(s.lockExpiresAt))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!dark && (
            <p className="mt-3 text-[10px] text-[#6b7b94]">
              لاک صندلی فقط توسط مدیر عامل یا رئیس هیئت مدیره / مدیر IT مجاز است.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ chip, label }: { chip: 'free' | 'locked' | 'sold'; label: string }) {
  const styles = {
    free: 'border-[#28344c] bg-[#18223a]',
    locked: 'border-[#f59e0b] bg-[#f59e0b]',
    sold: 'border-[#3b82f6] bg-[#3b82f6]',
  };
  return (
    <span className="flex items-center gap-1.5 rounded-[13px] border border-[#22304a] bg-[#0f1623] px-2.5 py-1 text-[10.5px] text-[#9fb0c7]">
      <span className={`h-3 w-3 rounded-[4px] border ${styles[chip]}`} />
      {label}
    </span>
  );
}

function seatTone(status: string, selected: boolean): string {
  if (selected) return 'border-white bg-[#f59e0b] text-[#1a1206]';
  if (status === 'SOLD') return 'border-[#3b82f6] bg-[#3b82f6] text-white';
  if (status === 'LOCKED') return 'border-[#f59e0b] bg-[#f59e0b] text-[#1a1206]';
  return 'border-[#28344c] bg-[#18223a] text-[#9fb0c7]';
}
