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
import PanelAlert from '../panel/PanelAlert';
import PanelModal from '../panel/PanelModal';
import PanelStatCard from '../panel/PanelStatCard';
import {
  panelBtnGhost,
  panelBtnPrimary,
  panelCard,
  panelCardPadded,
  panelElevated,
  panelInput,
  panelLink,
  panelMuted,
  panelMuted2,
  panelSegmentBtn,
  panelSegmented,
  panelText,
  panelTitle,
  panelValue,
} from '../panel/panel-theme';
import type {
  FlightSearchResult,
  PnrDetail,
  PnrGroup,
  ReservationDashboardStats,
  SeatMap,
} from '../../types/reservation';
import BoardChairPlaneMode from './BoardChairPlaneMode';

type SubTab = 'dashboard' | 'pnr' | 'seatmap' | 'new';

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

const SEAT_STATUS_STYLE: Record<string, string> = {
  FREE: 'bg-panel-elevated text-panel-muted-2 border-panel-border-2',
  SOLD: 'bg-[#8a3d4d] text-white border-[#8a3d4d]',
  LOCKED: 'bg-[#f59e0b] text-[#1a1305] border-[#f59e0b]',
};

const SUB_TABS: [SubTab, string][] = [
  ['dashboard', 'داشبورد'],
  ['pnr', 'مدیریت رزروها'],
  ['seatmap', 'نقشهٔ صندلی'],
  ['new', 'رزرو جدید'],
];

export default function ReservationPage() {
  const { user } = useAuth();
  // Design: BOARD_CHAIR embeds ReservationSystem with lock-only=true → plane view only.
  if (user?.role === 'BOARD_CHAIR') {
    return <BoardChairPlaneMode />;
  }

  return <ReservationTabs canLock={user?.role === 'CEO' || user?.role === 'IT_MANAGER'} />;
}

function ReservationTabs({ canLock }: { canLock: boolean }) {
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
    <div className="flex flex-col gap-[15px]">
      {error && <PanelAlert>{error}</PanelAlert>}
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      <div className={panelSegmented}>
        {SUB_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={panelSegmentBtn(subTab === key)}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'dashboard' && stats && (
        <div className="grid grid-cols-2 gap-[13px] md:grid-cols-4">
          <PanelStatCard
            label="رزرو امروز"
            value={faDigits(stats.todayBookings)}
            valueClass={panelValue}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            iconClass="bg-[rgba(59,130,246,.16)] text-[#60a5fa]"
          />
          <PanelStatCard
            label="PNR فعال"
            value={faDigits(stats.activePnrs)}
            valueClass="font-num text-[22.5px] font-black text-panel-link"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            }
            iconClass="bg-[rgba(124,58,237,.16)] text-[#a78bfa]"
          />
          <PanelStatCard
            label="صندلی فروخته‌شده"
            value={faDigits(stats.seatsSold)}
            valueClass="font-num text-[22.5px] font-black text-[#34d399]"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            }
            iconClass="bg-[rgba(16,185,129,.14)] text-[#34d399]"
          />
          <PanelStatCard
            label="درآمد امروز (تومان)"
            value={faMoney(stats.revenueIrr)}
            valueClass="font-num text-[22.5px] font-black text-[#fbbf24]"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            iconClass="bg-[rgba(245,158,11,.16)] text-[#fbbf24]"
          />
        </div>
      )}

      {subTab === 'pnr' && (
        <section className={panelCardPadded}>
          <input
            value={pnrQuery}
            onChange={(e) => setPnrQuery(e.target.value)}
            placeholder="جستجو با کد PNR یا نام مسافر…"
            className={`mb-4 h-[42px] w-full px-4 ${panelInput}`}
          />
          {pnrGroups.length === 0 ? (
            <p className={`py-6 text-center text-xs ${panelMuted}`}>رزروی یافت نشد.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {pnrGroups.map((g) => (
                <div key={g.flightInstanceId} className={`overflow-hidden ${panelCard}`}>
                  <div className={`flex items-center gap-3 px-4 py-2.5 text-xs ${panelElevated}`}>
                    <span className={`ltr font-num font-bold ${panelLink}`}>{g.flightNo}</span>
                    <span className={`flex-1 font-bold ${panelText}`}>{g.route}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void loadSeatMap(g.flightInstanceId);
                        setSubTab('seatmap');
                      }}
                      className={`text-[11px] ${panelLink}`}
                    >
                      نقشهٔ صندلی {g.flightNo}
                    </button>
                    <span className={panelMuted}>{formatJalaliDate(g.departureAt)}</span>
                  </div>
                  <ul className="divide-y divide-panel-border">
                    {g.rows.map((r) => {
                      const st = STATUS_LABEL[r.status] ?? {
                        label: r.status,
                        className: 'bg-panel-elevated text-panel-muted-2',
                      };
                      return (
                        <li key={r.pnr} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                          <button
                            type="button"
                            onClick={() => void openPnrDetail(r.pnr)}
                            className={`ltr font-num font-bold ${panelMuted2} underline decoration-dashed underline-offset-4`}
                          >
                            {r.pnr}
                          </button>
                          <span className={`flex-1 ${panelText}`}>{r.passenger}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>
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

      {subTab === 'seatmap' && (
        <section className={panelCardPadded}>
          {!activeFlightInstanceId || !seatMap ? (
            <p className={`py-6 text-center text-xs ${panelMuted}`}>
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
          <section className={panelCardPadded}>
            <h2 className={`mb-4 ${panelTitle}`}>جستجوی پرواز</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
          </section>

          {searchResults.length > 0 && (
            <section className="flex flex-col gap-2">
              {searchResults.map((f) => (
                <div
                  key={f.flightInstanceId}
                  className={`flex items-center gap-4 p-4 text-xs ${panelCard}`}
                >
                  <span className={`ltr font-num font-bold ${panelLink}`}>{f.flightNo}</span>
                  <span className={`flex-1 ${panelText}`}>
                    {f.originCode} → {f.destCode} · {formatJalaliDateTime(f.departureAt)}
                  </span>
                  <span className="font-bold text-[#34d399]">{faMoney(f.priceIrr)} تومان</span>
                  <span className={panelMuted}>{faDigits(f.seatsLeft)} صندلی</span>
                  <button
                    type="button"
                    onClick={() => void loadSeatMap(f.flightInstanceId)}
                    className={panelBtnPrimary}
                  >
                    انتخاب صندلی
                  </button>
                </div>
              ))}
            </section>
          )}

          {activeFlightInstanceId && seatMap && (
            <section className={panelCardPadded}>
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
        <PanelModal
          title={seatFormMode === 'lock' ? `لاک مدیریتی صندلی ${selectedSeat}` : `صدور PNR — صندلی ${selectedSeat}`}
          onClose={() => setSeatFormOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSeatFormOpen(false)} className={panelBtnGhost}>
                انصراف
              </button>
              <button type="button" onClick={() => void onSubmitSeatForm()} className={panelBtnPrimary}>
                {seatFormMode === 'lock' ? 'لاک صندلی' : 'صدور PNR و بلیط'}
              </button>
            </div>
          }
        >
          <label className={`mb-1 block text-xs font-bold ${panelText}`} htmlFor="seat-pname">
            نام و نام خانوادگی{seatFormMode === 'issue' ? '' : ' (اختیاری)'}
          </label>
          <input
            id="seat-pname"
            value={seatForm.name}
            onChange={(e) => setSeatForm({ ...seatForm, name: e.target.value })}
            className={`mb-3 w-full p-3 ${panelInput}`}
          />
          <label className={`mb-1 block text-xs font-bold ${panelText}`} htmlFor="seat-nid">
            کد ملی (اختیاری)
          </label>
          <input
            id="seat-nid"
            dir="ltr"
            value={seatForm.nid}
            onChange={(e) => setSeatForm({ ...seatForm, nid: e.target.value })}
            className={`font-num mb-3 w-full p-3 ${panelInput}`}
          />
        </PanelModal>
      )}

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

          {canLock && detail.status !== 'CANCELLED' && (
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
      <div className={`mb-4 flex flex-wrap items-center gap-4 text-[11px] ${panelMuted2}`}>
        <span className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded border ${SEAT_STATUS_STYLE.FREE}`} />
          آزاد
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#8a3d4d]" />
          فروخته‌شده
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#f59e0b]" />
          لاک مدیریتی
        </span>
        <span className={`mr-auto font-num ${panelMuted}`}>
          {faDigits(seatMap.soldCount + seatMap.lockedCount)}/{faDigits(seatMap.capacity)} اشغال (
          {faDigits(seatMap.occupancyPct)}٪)
        </span>
      </div>

      <div className="flex max-h-[480px] flex-col gap-2 overflow-auto">
        {seatMap.rows.map((row) => {
          const aisleAfterIndex = seatMap.cabinLayout[row.cabin].aisleAfterIndex;
          return (
            <div key={row.row} className="flex items-center justify-center gap-1.5">
              <span className={`font-num w-6 text-center text-[10px] font-bold ${panelMuted}`}>
                {faDigits(row.row)}
              </span>
              {row.seats.map((s, idx) => (
                <span key={s.seatCode} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSeatClick(s.seatCode, s.status)}
                    disabled={s.status === 'SOLD' || !canLock}
                    aria-label={s.seatCode}
                    className={`ltr font-num flex h-7 w-7 items-center justify-center rounded border text-[9px] font-bold transition ${
                      SEAT_STATUS_STYLE[s.status]
                    } ${canLock && s.status !== 'SOLD' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {s.seatCode.replace(String(row.row), '')}
                  </button>
                  {idx === aisleAfterIndex - 1 && (
                    <span data-testid={`aisle-gap-${row.row}`} className="w-3" />
                  )}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {canLock && lockedChips.length > 0 && (
        <div className="mt-4 border-t border-panel-border pt-3">
          <div className={`mb-2 text-[10.5px] font-bold ${panelMuted}`}>
            صندلی‌های رزرو مدیریتی ({faDigits(lockedChips.length)})
          </div>
          <div className="flex flex-wrap gap-2">
            {lockedChips.map((s) => (
              <button
                key={s.seatCode}
                type="button"
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
