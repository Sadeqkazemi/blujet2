import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelBooking,
  changeSeat,
  fetchPnrDetail,
  fetchPnrList,
  fetchSeatMap,
  issuePnr,
  lockSeat,
  markNoShow,
  releaseLock,
  searchFlights,
  type LockClassification,
} from '../../api/reservation';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime, parseJalaliDateToIso } from '../../lib/jalali';
import PanelAlert from '../panel/PanelAlert';
import PanelModal from '../panel/PanelModal';
import {
  panelBtnGhost,
  panelBtnPrimary,
  panelInput,
  panelMuted,
  panelMuted2,
  panelText,
} from '../panel/panel-theme';
import type {
  FlightSearchResult,
  PnrDetail,
  PnrGroup,
  SeatMap,
  SeatStatus,
} from '../../types/reservation';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  TICKETED: { label: 'صادرشده', className: 'bg-[rgba(52,211,153,.16)] text-[#34d399]' },
  CANCELLED: { label: 'لغوشده', className: 'bg-[rgba(248,113,113,.16)] text-[#f87171]' },
  DRAFT: { label: 'پیش‌نویس', className: 'bg-panel-elevated text-panel-muted-2' },
  HELD: { label: 'در انتظار', className: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]' },
  PAID: { label: 'پرداخت‌شده', className: 'bg-[rgba(59,130,246,.16)] text-[#60a5fa]' },
  EXPIRED: { label: 'منقضی', className: 'bg-panel-elevated text-panel-muted' },
  REFUNDED: { label: 'مستردشده', className: 'bg-panel-elevated text-panel-muted' },
  FLOWN: { label: 'پرواز شده', className: 'bg-[rgba(59,130,246,.16)] text-[#60a5fa]' },
  NO_SHOW: { label: 'عدم حضور', className: 'bg-[rgba(248,113,113,.16)] text-[#f87171]' },
};

function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeSeatCode(raw: string): string {
  return toLatinDigits(raw).toUpperCase().replace(/\s/g, '');
}

function findSeat(seatMap: SeatMap, seatCode: string) {
  for (const row of seatMap.rows) {
    const seat = row.seats.find((s) => s.seatCode === seatCode);
    if (seat) return { seat, cabin: row.cabin, row: row.row };
  }
  return null;
}

export default function BoardChairPlaneMode() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [flights, setFlights] = useState<PnrGroup[]>([]);
  const [activeFlightInstanceId, setActiveFlightInstanceId] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);

  const [lockInput, setLockInput] = useState('');
  const [lockReason, setLockReason] = useState('لاک مدیریتی رئیس هیئت مدیره');
  const [classification, setClassification] = useState<LockClassification>('FREE');
  const [discountPct, setDiscountPct] = useState('20');
  const [passengerName, setPassengerName] = useState('');
  const [passengerNid, setPassengerNid] = useState('');
  const [passengerMobile, setPassengerMobile] = useState('');

  const [paxQuery, setPaxQuery] = useState('');
  const [paxGroups, setPaxGroups] = useState<PnrGroup[]>([]);

  const [detailPnr, setDetailPnr] = useState<string | null>(null);
  const [detail, setDetail] = useState<PnrDetail | null>(null);
  const [changeSeatInput, setChangeSeatInput] = useState('');

  const [searchForm, setSearchForm] = useState({ origin: '', dest: '', date: '' });
  const [searchResults, setSearchResults] = useState<FlightSearchResult[]>([]);

  const activeFlight = flights.find((f) => f.flightInstanceId === activeFlightInstanceId) ?? null;
  const selectedSeatCode = normalizeSeatCode(lockInput);

  const loadFlights = useCallback(async () => {
    try {
      const groups = await fetchPnrList();
      setFlights(groups);
      return groups;
    } catch {
      setError('خطا در دریافت فهرست پروازها.');
      return [] as PnrGroup[];
    }
  }, []);

  const loadSeatMap = useCallback(async (flightInstanceId: string) => {
    try {
      setSeatMap(await fetchSeatMap(flightInstanceId));
      setActiveFlightInstanceId(flightInstanceId);
    } catch {
      setError('خطا در دریافت نقشهٔ صندلی.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const groups = await loadFlights();
      if (groups[0]) await loadSeatMap(groups[0].flightInstanceId);
    })();
  }, [loadFlights, loadSeatMap]);

  useEffect(() => {
    const q = paxQuery.trim();
    if (!q) {
      setPaxGroups([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetchPnrList(q)
        .then(setPaxGroups)
        .catch(() => setError('خطا در جستجوی مسافر.'));
    }, 250);
    return () => clearTimeout(timer);
  }, [paxQuery]);

  const paxResults = useMemo(() => {
    return paxGroups.flatMap((g) =>
      g.rows.map((r) => ({
        ...r,
        flightNo: g.flightNo,
        route: g.route,
        flightInstanceId: g.flightInstanceId,
      })),
    );
  }, [paxGroups]);

  const selectedSeatInfo = seatMap && selectedSeatCode ? findSeat(seatMap, selectedSeatCode) : null;

  const preview = useMemo(() => {
    if (!selectedSeatCode) return null;
    if (!seatMap) {
      return {
        text: 'ابتدا یک پرواز را انتخاب کنید.',
        color: 'text-[#fbbf24]',
        bg: 'bg-[rgba(245,158,11,.12)] border-[rgba(245,158,11,.35)]',
      };
    }
    if (!selectedSeatInfo) {
      return {
        text: 'شمارهٔ صندلی در این نقشه یافت نشد.',
        color: 'text-[#f87171]',
        bg: 'bg-[rgba(248,113,113,.12)] border-[rgba(248,113,113,.35)]',
      };
    }
    if (selectedSeatInfo.seat.status === 'SOLD') {
      return {
        text: `صندلی ${selectedSeatCode} فروخته شده و قابل تغییر نیست`,
        color: 'text-[#f0a8b4]',
        bg: 'bg-[rgba(138,61,77,.16)] border-[rgba(138,61,77,.5)]',
      };
    }
    if (selectedSeatInfo.seat.status === 'LOCKED') {
      return {
        text: `صندلی ${selectedSeatCode} هم‌اکنون لاک است — با تأیید آزاد می‌شود`,
        color: 'text-[#fcd34d]',
        bg: 'bg-[rgba(245,158,11,.14)] border-[rgba(245,158,11,.4)]',
      };
    }
    return {
      text: `صندلی ${selectedSeatCode} آزاد است — با تأیید لاک مدیریتی می‌شود`,
      color: 'text-[#9db8e0]',
      bg: 'bg-[rgba(59,130,246,.12)] border-[rgba(59,130,246,.4)]',
    };
  }, [seatMap, selectedSeatCode, selectedSeatInfo]);

  const actionLabel = passengerName.trim()
    ? 'رزرو صندلی برای مسافر'
    : 'لاک صندلی (بدون مسافر)';
  const actionColor = passengerName.trim() ? 'text-[#34d399]' : 'text-[#f59e0b]';

  const primaryBtn = useMemo(() => {
    if (!selectedSeatCode || !selectedSeatInfo) {
      return { label: 'لاک / آزادسازی', bg: 'bg-[#2a3346]', color: 'text-[#6b7b94]', disabled: true };
    }
    if (selectedSeatInfo.seat.status === 'SOLD') {
      return { label: 'فروخته‌شده', bg: 'bg-[#2a3346]', color: 'text-[#6b7b94]', disabled: true };
    }
    if (selectedSeatInfo.seat.status === 'LOCKED') {
      return {
        label: `آزادسازی ${selectedSeatCode}`,
        bg: 'bg-[#34d399]',
        color: 'text-[#06231a]',
        disabled: false,
      };
    }
    if (passengerName.trim()) {
      return {
        label: `رزرو صندلی ${selectedSeatCode}`,
        bg: 'bg-[#1668c4]',
        color: 'text-white',
        disabled: false,
      };
    }
    return {
      label: `لاک صندلی ${selectedSeatCode}`,
      bg: 'bg-[#f59e0b]',
      color: 'text-[#1a1206]',
      disabled: false,
    };
  }, [selectedSeatCode, selectedSeatInfo, passengerName]);

  async function pickFlight(flightInstanceId: string) {
    setLockInput('');
    setPassengerName('');
    setPassengerNid('');
    setPassengerMobile('');
    await loadSeatMap(flightInstanceId);
  }

  async function onPrimaryAction() {
    if (!activeFlightInstanceId || !selectedSeatInfo || !selectedSeatCode) return;
    try {
      if (selectedSeatInfo.seat.status === 'LOCKED' && selectedSeatInfo.seat.lockId) {
        await releaseLock(selectedSeatInfo.seat.lockId);
        setNotice(`صندلی ${selectedSeatCode} آزاد شد ✓`);
        setLockInput('');
      } else if (passengerName.trim()) {
        const pnr = await issuePnr({
          flightInstanceId: activeFlightInstanceId,
          seatCode: selectedSeatCode,
          passengerName: passengerName.trim(),
          passengerNationalId: passengerNid || undefined,
          passengerMobile: passengerMobile || undefined,
        });
        setNotice(`صندلی ${selectedSeatCode} برای ${passengerName.trim()} رزرو شد ✓ (PNR ${pnr.pnr})`);
        setLockInput('');
        setPassengerName('');
        setPassengerNid('');
        setPassengerMobile('');
        await loadFlights();
      } else {
        const reason = lockReason.trim();
        if (reason.length < 3) {
          setError('دلیل لاک باید حداقل ۳ نویسه باشد.');
          return;
        }
        const pct =
          classification === 'DISCOUNTED' ? Number(toLatinDigits(discountPct)) : undefined;
        if (classification === 'DISCOUNTED' && (!pct || pct < 1 || pct > 100)) {
          setError('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
          return;
        }
        await lockSeat(activeFlightInstanceId, {
          seatCode: selectedSeatCode,
          reason,
          classification,
          discountPct: pct,
          passengerName: passengerName || undefined,
          passengerNationalId: passengerNid || undefined,
          passengerMobile: passengerMobile || undefined,
        });
        setNotice(`صندلی ${selectedSeatCode} لاک شد ✓`);
        setLockInput('');
      }
      await loadSeatMap(activeFlightInstanceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت.');
    }
  }

  async function onReleaseChip(lockId: string) {
    if (!activeFlightInstanceId) return;
    try {
      await releaseLock(lockId);
      await loadSeatMap(activeFlightInstanceId);
    } catch {
      setError('خطا در آزادسازی صندلی.');
    }
  }

  async function onSearch() {
    if (!searchForm.origin.trim() || !searchForm.dest.trim() || !searchForm.date.trim()) {
      setError('مبدأ، مقصد و تاریخ الزامی است.');
      return;
    }
    const iso = parseJalaliDateToIso(searchForm.date) ?? searchForm.date;
    try {
      const results = await searchFlights(searchForm.origin.trim(), searchForm.dest.trim(), iso);
      setSearchResults(results);
      if (results[0] && !activeFlightInstanceId) {
        await pickFlight(results[0].flightInstanceId);
      }
    } catch {
      setError('خطا در جستجوی پرواز.');
    }
  }

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
      setPaxQuery((q) => q);
      await loadFlights();
      if (activeFlightInstanceId) await loadSeatMap(activeFlightInstanceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در لغو رزرو.');
    }
  }

  async function onChangeSeat() {
    if (!detailPnr || !changeSeatInput.trim()) return;
    try {
      await changeSeat(detailPnr, normalizeSeatCode(changeSeatInput));
      setNotice('صندلی رزرو تغییر کرد.');
      setDetail(await fetchPnrDetail(detailPnr));
      setChangeSeatInput('');
      if (activeFlightInstanceId) await loadSeatMap(activeFlightInstanceId);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت عدم حضور.');
    }
  }

  const lockedChips =
    seatMap?.rows.flatMap((r) => r.seats.filter((s) => s.status === 'LOCKED' && s.lockId)) ?? [];

  const columnLabels = useMemo(() => {
    if (!seatMap?.rows.length) return [] as string[];
    // Prefer economy row (more columns) for the header legend.
    const economy = seatMap.rows.find((r) => r.cabin === 'ECONOMY') ?? seatMap.rows[0];
    return economy.seats.map((s) => s.seatCode.replace(String(economy.row), ''));
  }, [seatMap]);

  return (
    <div className="flex flex-col gap-[14px]">
      {error && <PanelAlert>{error}</PanelAlert>}
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      <div className="flex flex-wrap items-center gap-[13px] rounded-2xl border border-[#22304a] bg-gradient-to-br from-[#15233c] to-[#131c30] px-[17px] py-[15px]">
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[rgba(96,165,250,.16)] text-[#60a5fa]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
          </svg>
        </span>
        <div className="min-w-[200px] flex-1 leading-relaxed">
          <h3 className="m-0 text-base font-black text-white">هواپیما — رزرو صندلی</h3>
          <div className="text-[11px] text-[#9fb0c7]">
            {activeFlight?.route ?? '—'} · پرواز{' '}
            <span dir="ltr" className="font-num">
              {activeFlight?.flightNo ?? '—'}
            </span>
            {seatMap ? ` · ${seatMap.aircraftType}` : ''}
          </div>
        </div>
        {seatMap && (
          <div className="flex flex-wrap gap-2">
            <div className="rounded-[11px] border border-[#28344c] bg-[#0f1725] px-[13px] py-2 text-center">
              <div className="text-[9px] text-[#6b7b94]">فروخته‌شده</div>
              <div className="text-[14.5px] font-black text-[#f0a8b4]">
                {faDigits(seatMap.soldCount)}{' '}
                <span className="text-[9px] font-semibold text-[#6b7b94]">
                  از {faDigits(seatMap.capacity)}
                </span>
              </div>
            </div>
            <div className="rounded-[11px] border border-[#28344c] bg-[#0f1725] px-[13px] py-2 text-center">
              <div className="text-[9px] text-[#6b7b94]">رزرو مدیریتی</div>
              <div className="text-[14.5px] font-black text-[#f59e0b]">{faDigits(seatMap.lockedCount)}</div>
            </div>
            <div className="rounded-[11px] border border-[#28344c] bg-[#0f1725] px-[13px] py-2 text-center">
              <div className="text-[9px] text-[#6b7b94]">اشغال</div>
              <div className="text-[14.5px] font-black text-[#60a5fa]">
                {faDigits(seatMap.occupancyPct)}٪
              </div>
            </div>
          </div>
        )}
      </div>

      {flights.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {flights.map((f) => {
            const active = f.flightInstanceId === activeFlightInstanceId;
            return (
              <button
                key={f.flightInstanceId}
                type="button"
                onClick={() => void pickFlight(f.flightInstanceId)}
                className={`rounded-xl border px-[14px] py-[9px] text-start leading-snug ${
                  active
                    ? 'border-[#1668c4] bg-[#1668c4]'
                    : 'border-[#28344c] bg-[#141d2e]'
                }`}
              >
                <div className={`text-[11.5px] font-extrabold ${active ? 'text-white' : 'text-[#9fb0c7]'}`}>
                  {f.route}
                </div>
                <div className={`text-[9.5px] ${active ? 'text-[#dbeafe]' : 'text-[#6b7b94]'}`}>
                  <span dir="ltr" className="font-num">
                    {f.flightNo}
                  </span>
                  {' · '}
                  {formatJalaliDate(f.departureAt)}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <section className="rounded-[15px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
          <div className={`mb-3 text-xs font-bold ${panelText}`}>جستجوی پرواز برای نقشهٔ صندلی</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              value={searchForm.origin}
              onChange={(e) => setSearchForm({ ...searchForm, origin: e.target.value })}
              placeholder="مبدأ"
              className={`h-[42px] px-3 ${panelInput}`}
            />
            <input
              value={searchForm.dest}
              onChange={(e) => setSearchForm({ ...searchForm, dest: e.target.value })}
              placeholder="مقصد"
              className={`h-[42px] px-3 ${panelInput}`}
            />
            <input
              value={searchForm.date}
              onChange={(e) => setSearchForm({ ...searchForm, date: e.target.value })}
              placeholder="۱۴۰۵/۰۵/۱۲"
              className={`font-num h-[42px] px-3 ${panelInput}`}
            />
            <button type="button" onClick={() => void onSearch()} className={panelBtnPrimary}>
              جستجو
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {searchResults.map((f) => (
                <button
                  key={f.flightInstanceId}
                  type="button"
                  onClick={() =>
                    void pickFlight(f.flightInstanceId).then(() =>
                      setFlights((prev) =>
                        prev.some((p) => p.flightInstanceId === f.flightInstanceId)
                          ? prev
                          : [
                              {
                                flightInstanceId: f.flightInstanceId,
                                flightNo: f.flightNo,
                                route: `${f.originCode} → ${f.destCode}`,
                                departureAt: f.departureAt,
                                rows: [],
                              },
                              ...prev,
                            ],
                      ),
                    )
                  }
                  className={`flex items-center gap-3 rounded-xl border border-[#22304a] bg-[#0f1725] px-3 py-2.5 text-xs ${panelText}`}
                >
                  <span className="font-num font-bold text-[#60a5fa]" dir="ltr">
                    {f.flightNo}
                  </span>
                  <span className="flex-1">
                    {f.originCode} → {f.destCode} · {formatJalaliDateTime(f.departureAt)}
                  </span>
                  <span className={panelMuted}>{faDigits(f.seatsLeft)} صندلی</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-[14px] xl:grid-cols-[minmax(300px,390px)_1fr]">
        <div className="flex flex-col gap-[13px]">
          <div className="rounded-[15px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
            <div className="mb-3 flex items-center gap-[9px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[rgba(245,158,11,.14)] text-[#f59e0b]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <div className="leading-snug">
                <div className="text-[13.5px] font-extrabold text-white">رزرو صندلی</div>
                <div className="text-[10px] text-[#6b7b94]">صندلی را از نقشه انتخاب کنید یا شماره‌اش را بنویسید</div>
              </div>
            </div>

            <div className="mb-1.5 text-[10.5px] font-bold text-[#8ea3c4]">شماره صندلی</div>
            <input
              value={lockInput}
              onChange={(e) => setLockInput(e.target.value)}
              placeholder="مثل 12D یا 4A"
              dir="ltr"
              className="font-num h-[46px] w-full rounded-[11px] border-[1.5px] border-[#28344c] bg-[#0b1220] px-[13px] text-sm text-white outline-none"
            />
            {preview && (
              <div className={`mt-2 rounded-[10px] border px-3 py-2 text-[11px] font-semibold leading-relaxed ${preview.bg} ${preview.color}`}>
                {preview.text}
              </div>
            )}

            <div className="mt-3 rounded-xl border border-[#22304a] bg-[#0b1220] p-3">
              <div className="mb-2 text-[10.5px] font-bold text-[#8ea3c4]">نوع لاک مدیریتی</div>
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['FREE', 'رایگان'],
                    ['DISCOUNTED', 'تخفیف‌دار'],
                    ['PAYABLE', 'قابل پرداخت'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setClassification(key)}
                    className={`rounded-lg px-2 py-2 text-[10.5px] font-bold ${
                      classification === key
                        ? 'bg-[#1668c4] text-white'
                        : 'bg-[#0f1725] text-[#9fb0c7] border border-[#28344c]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {classification === 'DISCOUNTED' && (
                <input
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="درصد تخفیف"
                  dir="ltr"
                  className="font-num mb-2 h-[42px] w-full rounded-[10px] border-[1.5px] border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none"
                />
              )}
              <input
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="دلیل لاک"
                className="mb-3 h-[42px] w-full rounded-[10px] border-[1.5px] border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none"
              />
              <div className="mb-2 text-[10.5px] font-bold text-[#8ea3c4]">اطلاعات مسافر</div>
              <div className="flex flex-col gap-2">
                <input
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="نام و نام خانوادگی"
                  className="h-[42px] rounded-[10px] border-[1.5px] border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={passengerNid}
                    onChange={(e) => setPassengerNid(e.target.value)}
                    placeholder="کد ملی"
                    dir="ltr"
                    className="font-num h-[42px] w-full min-w-0 rounded-[10px] border-[1.5px] border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none"
                  />
                  <input
                    value={passengerMobile}
                    onChange={(e) => setPassengerMobile(e.target.value)}
                    placeholder="شماره همراه"
                    dir="ltr"
                    className="font-num h-[42px] w-full min-w-0 rounded-[10px] border-[1.5px] border-[#28344c] bg-[#0f1725] px-3 text-xs text-white outline-none"
                  />
                </div>
              </div>
              <div className={`mt-2 text-[10.5px] font-bold ${actionColor}`}>{actionLabel}</div>
            </div>

            <button
              type="button"
              disabled={primaryBtn.disabled}
              onClick={() => void onPrimaryAction()}
              className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold ${primaryBtn.bg} ${primaryBtn.color} disabled:cursor-not-allowed`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {primaryBtn.label}
            </button>

            {lockedChips.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[10.5px] font-bold text-[#8ea3c4]">
                  صندلی‌های رزرو مدیریتی ({faDigits(lockedChips.length)})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lockedChips.map((s) => (
                    <button
                      key={s.seatCode}
                      type="button"
                      title="برای آزادسازی کلیک کنید"
                      onClick={() => s.lockId && void onReleaseChip(s.lockId)}
                      className="font-num inline-flex items-center gap-1 rounded-[9px] bg-[#f59e0b] px-2.5 py-1 text-[11px] font-extrabold text-[#1a1206]"
                      dir="ltr"
                    >
                      {s.seatCode} ×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[15px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
            <div className="mb-3 flex items-center gap-[9px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[rgba(52,211,153,.14)] text-[#34d399]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3.2" />
                  <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  <circle cx="17.5" cy="15.5" r="3" />
                  <path d="M21 19l-1.4-1.4" />
                </svg>
              </span>
              <div className="leading-snug">
                <div className="text-[13px] font-extrabold text-white">جستجوی مسافر</div>
                <div className="text-[10px] text-[#6b7b94]">نام، PNR، کد ملی یا شماره صندلی</div>
              </div>
            </div>
            <input
              value={paxQuery}
              onChange={(e) => setPaxQuery(e.target.value)}
              placeholder="مثلاً: نگار رضایی، BJ-4X2K9 یا 12D…"
              className="h-11 w-full rounded-[11px] border-[1.5px] border-[#28344c] bg-[#0b1220] px-[13px] text-xs text-white outline-none"
            />
            {paxQuery.trim() && paxResults.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {paxResults.slice(0, 6).map((pr) => {
                  const st = STATUS_LABEL[pr.status] ?? {
                    label: pr.status,
                    className: 'bg-panel-elevated text-panel-muted-2',
                  };
                  return (
                    <button
                      key={pr.pnr}
                      type="button"
                      onClick={() => void openPnrDetail(pr.pnr)}
                      className="rounded-[11px] border border-[#22304a] bg-[#0f1725] px-3 py-2.5 text-start"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(59,130,246,.16)] text-[11.5px] font-extrabold text-[#60a5fa]">
                          {(pr.passenger || '؟').trim().charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1 leading-snug">
                          <div className="text-xs font-extrabold text-[#e7ecf3]">{pr.passenger}</div>
                          <div className="text-[9.5px] text-[#6b7b94]">
                            PNR{' '}
                            <span dir="ltr" className="font-num">
                              {pr.pnr}
                            </span>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-[11px] px-2 py-0.5 text-[9.5px] font-bold ${st.className}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-3 border-t border-[#1c2740] pt-2 text-[10px] text-[#6b7b94]">
                        <span>
                          پرواز{' '}
                          <b className="font-num text-[#60a5fa]" dir="ltr">
                            {pr.flightNo}
                          </b>
                        </span>
                        <span>
                          مسیر <b className="text-[#cdd9ec]">{pr.route}</b>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {paxQuery.trim() && paxResults.length === 0 && (
              <div className="mt-2.5 rounded-[11px] border border-dashed border-[#28344c] bg-[#0f1725] px-3 py-3 text-center text-[11px] text-[#6b7b94]">
                مسافری با این مشخصات یافت نشد.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[15px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
          {!seatMap ? (
            <p className={`py-10 text-center text-xs ${panelMuted}`}>پروازی برای نمایش نقشهٔ صندلی انتخاب نشده است.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="flex items-center gap-1.5 rounded-[13px] border border-[#22304a] bg-[#0f1623] px-2.5 py-1 text-[10px] text-[#9fb0c7]">
                  <span className="h-[11px] w-[11px] rounded border-[1.5px] border-[#28344c] bg-[#18223a]" />
                  آزاد
                </span>
                <span className="flex items-center gap-1.5 rounded-[13px] bg-[rgba(59,130,246,.1)] px-2.5 py-1 text-[10px] text-[#9db8e0]">
                  <span className="h-[11px] w-[11px] rounded border-[1.5px] border-[#33507e] bg-[#16233f]" />
                  بیزینس
                </span>
                <span className="flex items-center gap-1.5 rounded-[13px] bg-[rgba(138,61,77,.14)] px-2.5 py-1 text-[10px] text-[#f0a8b4]">
                  <span className="h-[11px] w-[11px] rounded border-[1.5px] border-[#8a3d4d] bg-[#3a2330]" />
                  فروخته‌شده
                </span>
                <span className="flex items-center gap-1.5 rounded-[13px] bg-[rgba(245,158,11,.12)] px-2.5 py-1 text-[10px] text-[#f59e0b]">
                  <span className="h-[11px] w-[11px] rounded bg-[#f59e0b]" />
                  رزرو مدیریتی
                </span>
                <span className="flex items-center gap-1.5 rounded-[13px] bg-[rgba(59,130,246,.2)] px-2.5 py-1 text-[10px] text-white">
                  <span className="h-[11px] w-[11px] rounded bg-[#1668c4]" />
                  انتخاب شما
                </span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded bg-[#1a2436]">
                <div
                  className="h-full bg-gradient-to-l from-[#60a5fa] to-[#3b82f6]"
                  style={{ width: `${Math.min(100, seatMap.occupancyPct)}%` }}
                />
              </div>
              <div className="max-h-[520px] overflow-auto p-0.5">
                <div className="mx-auto w-max rounded-[34px] border border-[#1c2740] bg-gradient-to-b from-[#0d1626] to-[#0b1220] px-[22px] pb-4 pt-1.5">
                  <div className="mx-auto mb-2 flex h-[34px] w-[120px] items-end justify-center rounded-b-[60px] border-b-[1.5px] border-[#33415c] pb-1 text-[9px] text-[#5b6b83]">
                    دماغه
                  </div>
                  <div className="mb-1 flex items-center justify-center gap-1.5">
                    <span className="w-[18px]" />
                    {columnLabels.map((label, idx) => {
                      const aisleAfterIndex = seatMap.cabinLayout.ECONOMY.aisleAfterIndex;
                      return (
                        <span key={`${label}-${idx}`} className="flex items-center gap-1.5">
                          <span className="font-num w-[30px] text-center text-[9px] font-bold text-[#6b7b94]">
                            {label}
                          </span>
                          {idx === aisleAfterIndex - 1 && <span className="w-4" />}
                        </span>
                      );
                    })}
                    <span className="w-[18px]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {seatMap.rows.map((row, rowIdx) => {
                      const aisleAfterIndex = seatMap.cabinLayout[row.cabin].aisleAfterIndex;
                      const showBizDivider = row.cabin === 'BUSINESS' && (rowIdx === 0 || seatMap.rows[rowIdx - 1]?.cabin !== 'BUSINESS');
                      const showEcoDivider = row.cabin === 'ECONOMY' && (rowIdx === 0 || seatMap.rows[rowIdx - 1]?.cabin !== 'ECONOMY');
                      return (
                        <div key={row.row}>
                          {showBizDivider && (
                            <div className="mx-1 my-1.5 flex items-center gap-2">
                              <span className="h-px flex-1 bg-[#22304a]" />
                              <span className="whitespace-nowrap text-[8.5px] font-extrabold tracking-wide text-[#7aa2d6]">
                                بیزینس — FIRST CLASS
                              </span>
                              <span className="h-px flex-1 bg-[#22304a]" />
                            </div>
                          )}
                          {showEcoDivider && (
                            <div className="mx-1 my-1.5 flex items-center gap-2">
                              <span className="h-px flex-1 bg-[#22304a]" />
                              <span className="whitespace-nowrap text-[8.5px] font-extrabold tracking-wide text-[#6b7b94]">
                                اکونومی — MAIN CABIN
                              </span>
                              <span className="h-px flex-1 bg-[#22304a]" />
                            </div>
                          )}
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`font-num w-[18px] text-center text-[9px] font-bold ${
                                row.cabin === 'BUSINESS' ? 'text-[#7aa2d6]' : 'text-[#5b6b83]'
                              }`}
                            >
                              {faDigits(row.row)}
                            </span>
                            {row.seats.map((s, idx) => {
                              const selected = selectedSeatCode === s.seatCode && s.status !== 'SOLD';
                              return (
                                <span key={s.seatCode} className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    aria-label={s.seatCode}
                                    disabled={s.status === 'SOLD'}
                                    onClick={() => setLockInput(s.seatCode)}
                                    className={`font-num flex h-[30px] w-[30px] items-center justify-center rounded-[8px_8px_5px_5px] border-[1.5px] text-[8.5px] font-bold shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] ${seatButtonClass(s.status, selected, row.cabin)}`}
                                  >
                                    {s.seatCode}
                                  </button>
                                  {idx === aisleAfterIndex - 1 && (
                                    <span data-testid={`aisle-gap-${row.row}`} className="w-4" />
                                  )}
                                </span>
                              );
                            })}
                            <span className="w-[18px]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mx-auto mt-2.5 flex h-[26px] w-[150px] items-start justify-center rounded-t-[60px] border-t-[1.5px] border-[#33415c] pt-0.5 text-[9px] text-[#5b6b83]">
                    دُم
                  </div>
                </div>
              </div>
              <div className={`mt-3 text-center text-[10.5px] ${panelMuted2}`}>
                {faDigits(seatMap.soldCount + seatMap.lockedCount)}/{faDigits(seatMap.capacity)} اشغال (
                {faDigits(seatMap.occupancyPct)}٪)
              </div>
            </>
          )}
        </div>
      </div>

      {detailPnr && detail && (
        <PanelModal title={`رزرو ${detail.pnr}`} onClose={() => setDetailPnr(null)} wide>
          <div className="mb-4 rounded-xl bg-[#0f1726] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className={`ltr font-num text-xs ${panelMuted2}`}>PNR {detail.pnr}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_LABEL[detail.status]?.className}`}
              >
                {STATUS_LABEL[detail.status]?.label}
              </span>
            </div>
            <div className={`flex items-center justify-between text-lg font-black ${panelText}`}>
              <span className="ltr">{detail.originCode}</span>
              <span>✈</span>
              <span className="ltr">{detail.destCode}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 border-t border-panel-border pt-3 text-[11px]">
              <div>
                <div className={panelMuted}>مسافر</div>
                <div className={`font-bold ${panelText}`}>{detail.passenger?.fullName ?? '—'}</div>
              </div>
              <div>
                <div className={panelMuted}>صندلی</div>
                <div className="font-num font-bold text-[#fcd34d]">{detail.passenger?.seatCode ?? '—'}</div>
              </div>
              <div>
                <div className={panelMuted}>تاریخ</div>
                <div className={`font-bold ${panelText}`}>{formatJalaliDateTime(detail.departureAt)}</div>
              </div>
              <div>
                <div className={panelMuted}>مبلغ</div>
                <div className="font-bold text-[#34d399]">{faMoney(detail.priceIrr)} تومان</div>
              </div>
            </div>
          </div>

          {detail.status !== 'CANCELLED' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={changeSeatInput}
                  onChange={(e) => setChangeSeatInput(e.target.value)}
                  placeholder="شماره صندلی جدید"
                  dir="ltr"
                  className={`font-num flex-1 p-2.5 ${panelInput}`}
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
                className="rounded-lg bg-[rgba(248,113,113,.12)] px-4 py-2 text-xs font-bold text-[#f87171]"
              >
                لغو رزرو
              </button>
              {(detail.status === 'TICKETED' || detail.status === 'FLOWN') && (
                <button
                  type="button"
                  onClick={() => void onMarkNoShow()}
                  className={panelBtnGhost}
                >
                  ثبت عدم حضور مسافر
                </button>
              )}
            </div>
          )}
          {detail.status === 'CANCELLED' && (
            <p className="rounded-lg bg-[rgba(248,113,113,.12)] p-3 text-xs font-bold text-[#f87171]">
              این رزرو لغو شده است.
            </p>
          )}
        </PanelModal>
      )}
    </div>
  );
}

function seatButtonClass(status: SeatStatus, selected: boolean, cabin: 'BUSINESS' | 'ECONOMY'): string {
  if (selected) return 'border-[#60a5fa] bg-[#1668c4] text-white cursor-pointer';
  if (status === 'SOLD') return 'border-[#8a3d4d] bg-[#3a2330] text-[#f0a8b4] cursor-default';
  if (status === 'LOCKED') return 'border-[#f59e0b] bg-[#f59e0b] text-[#1a1206] cursor-pointer';
  if (cabin === 'BUSINESS') return 'border-[#33507e] bg-[#16233f] text-[#9db8e0] cursor-pointer';
  return 'border-[#28344c] bg-[#18223a] text-[#9fb0c7] cursor-pointer';
}
