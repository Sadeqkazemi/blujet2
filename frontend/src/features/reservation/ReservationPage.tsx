import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  cancelBooking,
  changeSeat,
  fetchPnrDetail,
  fetchPnrList,
  fetchReservationDashboardStats,
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
  SeatMap,
} from '../../types/reservation';

type SubTab = 'pnr' | 'seatmap' | 'new';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  TICKETED: { label: 'صادرشده', className: 'bg-[#10b98124] text-[#059669]' },
  CANCELLED: { label: 'لغوشده', className: 'bg-danger/15 text-danger' },
  DRAFT: { label: 'پیش‌نویس', className: 'bg-surface text-text-2' },
  HELD: { label: 'در انتظار', className: 'bg-[#f59e0b24] text-[#b45309]' },
  PAID: { label: 'پرداخت‌شده', className: 'bg-[#3b82f624] text-[#1d4ed8]' },
  EXPIRED: { label: 'منقضی', className: 'bg-surface text-muted' },
  REFUNDED: { label: 'مستردشده', className: 'bg-surface text-muted' },
  FLOWN: { label: 'پرواز شده', className: 'bg-[#3b82f624] text-[#1d4ed8]' },
  NO_SHOW: { label: 'عدم حضور', className: 'bg-danger/15 text-danger' },
};

const SEAT_STATUS_STYLE: Record<string, string> = {
  FREE: 'bg-surface-2 text-text-2 border-border',
  SOLD: 'bg-[#8a3d4d] text-white border-[#8a3d4d]',
  LOCKED: 'bg-[#f59e0b] text-[#1a1305] border-[#f59e0b]',
};

export default function ReservationPage() {
  const { user } = useAuth();
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

  const [activeFlightInstanceId, setActiveFlightInstanceId] = useState<string | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [seatFormOpen, setSeatFormOpen] = useState(false);
  const [seatFormMode, setSeatFormMode] = useState<'lock' | 'issue'>('lock');
  const [seatForm, setSeatForm] = useState({ name: '', nid: '', mobile: '' });

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

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPnrList(), 250);
    return () => clearTimeout(timer);
  }, [loadPnrList]);

  const loadSeatMap = useCallback(async (flightInstanceId: string) => {
    try {
      setSeatMap(await fetchSeatMap(flightInstanceId));
      setActiveFlightInstanceId(flightInstanceId);
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

  function onSeatClick(seatCode: string, status: string) {
    if (status === 'SOLD') return;
    if (!canLock) return;
    setSelectedSeat(seatCode);
    setSeatForm({ name: '', nid: '', mobile: '' });
    setSeatFormMode(subTab === 'new' ? 'issue' : 'lock');
    setSeatFormOpen(true);
  }

  async function onReleaseChip(lockId: string) {
    try {
      await releaseLock(lockId);
      if (activeFlightInstanceId) await loadSeatMap(activeFlightInstanceId);
    } catch {
      setError('خطا در آزادسازی صندلی.');
    }
  }

  async function onSubmitSeatForm() {
    if (!selectedSeat || !activeFlightInstanceId) return;
    try {
      if (seatFormMode === 'lock') {
        await lockSeat(activeFlightInstanceId, {
          seatCode: selectedSeat,
          passengerName: seatForm.name || undefined,
          passengerNationalId: seatForm.nid || undefined,
          passengerMobile: seatForm.mobile || undefined,
        });
        setNotice(`صندلی ${selectedSeat} لاک شد ✓`);
      } else {
        if (!seatForm.name.trim()) {
          setError('نام مسافر الزامی است.');
          return;
        }
        const pnr = await issuePnr({
          flightInstanceId: activeFlightInstanceId,
          seatCode: selectedSeat,
          passengerName: seatForm.name.trim(),
          passengerNationalId: seatForm.nid || undefined,
          passengerMobile: seatForm.mobile || undefined,
        });
        setNotice(`رزرو ${pnr.pnr} صادر شد ✓`);
      }
      setSeatFormOpen(false);
      await loadSeatMap(activeFlightInstanceId);
      await loadPnrList();
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

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">سامانه رزرواسیون</h1>
          <p className="mt-1 text-sm text-muted">مدیریت رزروها، نقشهٔ صندلی و صدور دستی PNR</p>
        </div>
        {stats && (
          <div className="flex gap-3 text-xs">
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <div className="font-num font-black text-ink">{faDigits(stats.todayBookings)}</div>
              <div className="text-[10px] text-muted">رزرو امروز</div>
            </div>
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <div className="font-num font-black text-accent">{faDigits(stats.activePnrs)}</div>
              <div className="text-[10px] text-muted">PNR فعال</div>
            </div>
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <div className="font-num font-black text-[#059669]">{faDigits(stats.seatsSold)}</div>
              <div className="text-[10px] text-muted">صندلی فروخته‌شده</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <div className="mb-6 flex w-max gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ['pnr', 'مدیریت رزروها'],
            ['seatmap', 'نقشهٔ صندلی'],
            ['new', 'رزرو جدید'],
          ] as [SubTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              subTab === key ? 'bg-white text-ink shadow-sm' : 'text-text-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'pnr' && (
        <section className="rounded-xl border border-border bg-white p-5">
          <input
            value={pnrQuery}
            onChange={(e) => setPnrQuery(e.target.value)}
            placeholder="جستجو با کد PNR یا نام مسافر…"
            className="mb-4 h-[42px] w-full rounded-xl border border-border bg-white px-4 text-xs outline-none transition focus:border-accent"
          />
          {pnrGroups.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">رزروی یافت نشد.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {pnrGroups.map((g) => (
                <div key={g.flightInstanceId} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center gap-3 bg-surface px-4 py-2.5 text-xs">
                    <span className="ltr font-num font-bold text-accent">{g.flightNo}</span>
                    <span className="flex-1 font-bold text-ink">{g.route}</span>
                    <button
                      onClick={() => { void loadSeatMap(g.flightInstanceId); setSubTab('seatmap'); }}
                      className="text-[11px] font-bold text-accent"
                    >
                      نقشهٔ صندلی {g.flightNo}
                    </button>
                    <span className="text-muted">{formatJalaliDate(g.departureAt)}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {g.rows.map((r) => {
                      const st = STATUS_LABEL[r.status] ?? { label: r.status, className: 'bg-surface text-text-2' };
                      return (
                        <li key={r.pnr} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                          <button
                            onClick={() => void openPnrDetail(r.pnr)}
                            className="ltr font-num font-bold text-text-2 underline decoration-dashed underline-offset-4"
                          >
                            {r.pnr}
                          </button>
                          <span className="flex-1 text-ink">{r.passenger}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
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

      {subTab === 'seatmap' && (
        <section className="rounded-xl border border-border bg-white p-5">
          {!activeFlightInstanceId || !seatMap ? (
            <p className="py-6 text-center text-xs text-muted">
              یک پرواز را از «مدیریت رزروها» یا «رزرو جدید» انتخاب کنید.
            </p>
          ) : (
            <SeatMapView
              seatMap={seatMap}
              canLock={canLock}
              onSeatClick={onSeatClick}
              onReleaseChip={onReleaseChip}
            />
          )}
        </section>
      )}

      {subTab === 'new' && (
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-4 text-sm font-bold text-ink">جستجوی پرواز</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                value={searchForm.origin}
                onChange={(e) => setSearchForm({ ...searchForm, origin: e.target.value })}
                placeholder="مبدأ"
                className="h-[42px] rounded-lg border border-border px-3 text-xs outline-none focus:border-accent"
              />
              <input
                value={searchForm.dest}
                onChange={(e) => setSearchForm({ ...searchForm, dest: e.target.value })}
                placeholder="مقصد"
                className="h-[42px] rounded-lg border border-border px-3 text-xs outline-none focus:border-accent"
              />
              <input
                value={searchForm.date}
                onChange={(e) => setSearchForm({ ...searchForm, date: e.target.value })}
                placeholder="۱۴۰۵/۰۵/۱۲"
                className="font-num h-[42px] rounded-lg border border-border px-3 text-xs outline-none focus:border-accent"
              />
              <button onClick={() => void onSearch()} className="rounded-lg bg-accent px-4 text-xs font-bold text-white">
                جستجو
              </button>
            </div>
          </section>

          {searchResults.length > 0 && (
            <section className="flex flex-col gap-2">
              {searchResults.map((f) => (
                <div key={f.flightInstanceId} className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-xs">
                  <span className="ltr font-num font-bold text-accent">{f.flightNo}</span>
                  <span className="flex-1 text-ink">
                    {f.originCode} → {f.destCode} · {formatJalaliDateTime(f.departureAt)}
                  </span>
                  <span className="font-bold text-[#059669]">{faMoney(f.priceIrr)} تومان</span>
                  <span className="text-muted">{faDigits(f.seatsLeft)} صندلی</span>
                  <button
                    onClick={() => void loadSeatMap(f.flightInstanceId)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    انتخاب صندلی
                  </button>
                </div>
              ))}
            </section>
          )}

          {activeFlightInstanceId && seatMap && (
            <section className="rounded-xl border border-border bg-white p-5">
              <SeatMapView
                seatMap={seatMap}
                canLock={canLock}
                onSeatClick={onSeatClick}
                onReleaseChip={onReleaseChip}
              />
            </section>
          )}
        </div>
      )}

      {seatFormOpen && (
        <Modal
          title={seatFormMode === 'lock' ? `لاک مدیریتی صندلی ${selectedSeat}` : `صدور PNR — صندلی ${selectedSeat}`}
          onClose={() => setSeatFormOpen(false)}
        >
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="seat-pname">
            نام و نام خانوادگی{seatFormMode === 'issue' ? '' : ' (اختیاری)'}
          </label>
          <input
            id="seat-pname"
            value={seatForm.name}
            onChange={(e) => setSeatForm({ ...seatForm, name: e.target.value })}
            className="mb-3 w-full rounded-lg border border-border p-3 text-xs outline-none focus:border-accent"
          />
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="seat-nid">
            کد ملی (اختیاری)
          </label>
          <input
            id="seat-nid"
            dir="ltr"
            value={seatForm.nid}
            onChange={(e) => setSeatForm({ ...seatForm, nid: e.target.value })}
            className="font-num mb-3 w-full rounded-lg border border-border p-3 text-xs outline-none focus:border-accent"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setSeatFormOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button onClick={() => void onSubmitSeatForm()} className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white">
              {seatFormMode === 'lock' ? 'لاک صندلی' : 'صدور PNR و بلیط'}
            </button>
          </div>
        </Modal>
      )}

      {detailPnr && detail && (
        <Modal title={`رزرو ${detail.pnr}`} onClose={() => setDetailPnr(null)}>
          <div className="mb-4 rounded-xl bg-[#0f1726] p-4 text-white">
            <div className="mb-2 flex items-center justify-between">
              <span className="ltr font-num text-xs">PNR {detail.pnr}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_LABEL[detail.status]?.className}`}>
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
                <div className="font-num font-bold text-[#fcd34d]">{detail.passenger?.seatCode ?? '—'}</div>
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
                  className="font-num flex-1 rounded-lg border border-border p-2.5 text-xs outline-none focus:border-accent"
                />
                <button onClick={() => void onChangeSeat()} className="rounded-lg bg-[#f59e0b] px-4 py-2 text-xs font-bold text-white">
                  ثبت تغییر
                </button>
              </div>
              <button onClick={() => void onCancel()} className="rounded-lg bg-danger/10 px-4 py-2 text-xs font-bold text-danger">
                لغو رزرو
              </button>
              {(detail.status === 'TICKETED' || detail.status === 'FLOWN') && (
                <button
                  onClick={() => void onMarkNoShow()}
                  className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2"
                >
                  ثبت عدم حضور مسافر
                </button>
              )}
            </div>
          )}
          {detail.status === 'CANCELLED' && (
            <p className="rounded-lg bg-danger/10 p-3 text-xs font-bold text-danger">این رزرو لغو شده است.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function SeatMapView({
  seatMap,
  canLock,
  onSeatClick,
  onReleaseChip,
}: {
  seatMap: SeatMap;
  canLock: boolean;
  onSeatClick: (seatCode: string, status: string) => void;
  onReleaseChip: (lockId: string) => void;
}) {
  const lockedChips = seatMap.rows.flatMap((r) => r.seats.filter((s) => s.status === 'LOCKED' && s.lockId));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-surface-2 border border-border" />آزاد</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#8a3d4d]" />فروخته‌شده</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#f59e0b]" />لاک مدیریتی</span>
        <span className="mr-auto font-num text-muted">
          {faDigits(seatMap.soldCount + seatMap.lockedCount)}/{faDigits(seatMap.capacity)} اشغال ({faDigits(seatMap.occupancyPct)}٪)
        </span>
      </div>

      <div className="flex max-h-[480px] flex-col gap-2 overflow-auto">
        {seatMap.rows.map((row) => {
          // Aisle position varies by cabin layout (e.g. business 2-2 vs
          // economy 2-3) — read from the aircraft's real seat map config
          // instead of assuming a fixed seat index.
          const aisleAfterIndex = seatMap.cabinLayout[row.cabin].aisleAfterIndex;
          return (
            <div key={row.row} className="flex items-center justify-center gap-1.5">
              <span className="font-num w-6 text-center text-[10px] font-bold text-muted">{faDigits(row.row)}</span>
              {row.seats.map((s, idx) => (
                <span key={s.seatCode} className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSeatClick(s.seatCode, s.status)}
                    disabled={s.status === 'SOLD' || !canLock}
                    aria-label={s.seatCode}
                    className={`ltr font-num flex h-7 w-7 items-center justify-center rounded border text-[9px] font-bold transition ${
                      SEAT_STATUS_STYLE[s.status]
                    } ${canLock && s.status !== 'SOLD' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {s.seatCode.replace(String(row.row), '')}
                  </button>
                  {idx === aisleAfterIndex - 1 && <span data-testid={`aisle-gap-${row.row}`} className="w-3" />}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {canLock && lockedChips.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-[10.5px] font-bold text-muted">صندلی‌های رزرو مدیریتی ({faDigits(lockedChips.length)})</div>
          <div className="flex flex-wrap gap-2">
            {lockedChips.map((s) => (
              <button
                key={s.seatCode}
                onClick={() => s.lockId && onReleaseChip(s.lockId)}
                className="ltr font-num rounded-lg bg-[#f59e0b] px-2.5 py-1 text-[11px] font-bold text-[#1a1305]"
              >
                {s.seatCode} ×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
