import { useEffect, useMemo, useState } from 'react';
import {
  fetchPnrList,
  fetchSeatMap,
  issuePnr,
  lockSeat,
  releaseLock,
} from '../../api/reservation';
import { airportCityName } from '../../lib/airport-cities';
import { faDigits, faMoney } from '../../lib/fa-format';
import {
  md80SectionForRow,
  MD80_MAIN_CABIN_EXTRA_ROW_END,
} from '../public-site/checkout/md80-seat-layout';
import type { FlightRow } from '../../types/flights';
import type { SeatCell, SeatMap, SeatStatus } from '../../types/reservation';

type Props = {
  flight: FlightRow;
  onClose: () => void;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  onChanged: () => void;
};

type CabinBand = 'FIRST' | 'BUSINESS' | 'MCE' | 'ECONOMY';

const BAND_LABEL: Record<CabinBand, string> = {
  FIRST: 'کلاس یک (First Class)',
  BUSINESS: 'کلاس بیزینس (Business)',
  MCE: 'کابین اصلی با فضای پا بیشتر (Main Cabin Extra)',
  ECONOMY: 'کلاس اقتصادی (Economy)',
};

function bandForRow(row: number): CabinBand {
  if (row <= 6) return 'FIRST';
  if (row <= MD80_MAIN_CABIN_EXTRA_ROW_END) return 'BUSINESS';
  if (row <= 20) return 'MCE';
  return 'ECONOMY';
}

function routeFa(originCode: string, destCode: string): string {
  return `${airportCityName(originCode, 'fa')} ← ${airportCityName(destCode, 'fa')}`;
}

function aircraftLabel(type: string): string {
  const n = type.replace(/\s+/g, '').toUpperCase();
  if (n.includes('MD-80') || n.includes('MD80') || n.includes('MD-88') || n.includes('MD88')) {
    return 'مک‌دانل داگلاس MD-80';
  }
  return type;
}

function formatCountdown(expiresAt: string | null | undefined, now: number): string {
  if (!expiresAt) return '—';
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return '۰۰:۰۰';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return faDigits(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

function seatVisual(
  status: SeatStatus,
  classification: SeatCell['lockClassification'],
  selected: boolean,
  highlight: boolean,
): { bg: string; border: string } {
  if (selected) return { bg: '#f59e0b', border: '#fff' };
  if (highlight) return { bg: '#f59e0b', border: '#fbbf24' };
  if (status === 'SOLD') return { bg: '#3b82f6', border: '#3b82f6' };
  if (status === 'LOCKED') {
    if (classification === 'FREE') return { bg: '#a855f7', border: '#a855f7' };
    return { bg: '#f59e0b', border: '#f59e0b' };
  }
  return { bg: '#141d2e', border: '#3a4a66' };
}

export default function MdSeatMapModal({ flight, onClose, onNotice, onError, onChanged }: Props) {
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lockSeatCode, setLockSeatCode] = useState<string | null>(null);
  const [paxName, setPaxName] = useState('');
  const [paxNid, setPaxNid] = useState('');
  const [lockWithoutName, setLockWithoutName] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setSeatMap(await fetchSeatMap(flight.id));
    } catch {
      onError('خطا در دریافت نقشهٔ صندلی.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per flight
  }, [flight.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    let free = 0;
    let tempLock = 0;
    let sold = 0;
    let blocked = 0;
    for (const row of seatMap?.rows ?? []) {
      for (const s of row.seats) {
        if (s.status === 'FREE') free += 1;
        else if (s.status === 'SOLD') sold += 1;
        else if (s.status === 'LOCKED' && s.lockClassification === 'FREE') blocked += 1;
        else if (s.status === 'LOCKED') tempLock += 1;
      }
    }
    return { free, tempLock, sold, blocked };
  }, [seatMap]);

  const lockedList = useMemo(() => {
    return (seatMap?.rows ?? [])
      .flatMap((r) => r.seats)
      .filter((s) => s.status === 'LOCKED' && s.lockId)
      .sort((a, b) => a.seatCode.localeCompare(b.seatCode, 'en'));
  }, [seatMap]);

  const rowsWithBands = useMemo(() => {
    const rows = seatMap?.rows ?? [];
    return rows.map((row, idx) => {
      const band = bandForRow(row.row);
      const prevBand = idx > 0 ? bandForRow(rows[idx - 1].row) : null;
      return { row, band, showDivider: band !== prevBand };
    });
  }, [seatMap]);

  async function onSearch() {
    const q = query.trim();
    if (!q) {
      setHighlightCode(null);
      return;
    }
    const asSeat = q.toUpperCase().replace(/\s/g, '');
    const foundSeat = seatMap?.rows.some((r) => r.seats.some((s) => s.seatCode === asSeat));
    if (foundSeat) {
      setHighlightCode(asSeat);
      return;
    }
    try {
      const groups = await fetchPnrList(q);
      const hit = groups
        .filter((g) => g.flightInstanceId === flight.id)
        .flatMap((g) => g.rows);
      // Passenger search: open detail isn't available here; highlight first matching
      // booking's seat if the API later exposes seat on list — for now scroll by name match notice.
      if (hit.length === 0) {
        onError('مسافر یا صندلی‌ای با این مشخصات یافت نشد.');
        setHighlightCode(null);
        return;
      }
      onNotice(`رزرو ${hit[0].pnr} برای ${hit[0].passenger} یافت شد.`);
    } catch {
      onError('خطا در جستجو.');
    }
  }

  function onSeatClick(seat: SeatCell) {
    if (seat.status === 'SOLD') return;
    if (seat.status === 'LOCKED') {
      setHighlightCode(seat.seatCode);
      return;
    }
    setLockSeatCode(seat.seatCode);
    setPaxName('');
    setPaxNid('');
    setLockWithoutName(false);
  }

  async function onIssueOrTempLock() {
    if (!lockSeatCode) return;
    setBusy(true);
    try {
      if (paxName.trim()) {
        const pnr = await issuePnr({
          flightInstanceId: flight.id,
          seatCode: lockSeatCode,
          passengerName: paxName.trim(),
          passengerNationalId: paxNid || undefined,
        });
        onNotice(`صندلی ${lockSeatCode} رزرو شد ✓ (PNR ${pnr.pnr})`);
      } else if (lockWithoutName) {
        await lockSeat(flight.id, {
          seatCode: lockSeatCode,
          reason: 'قفل موقت مدیریتی / نگهداری صندلی',
          classification: 'PAYABLE',
        });
        onNotice(`صندلی ${lockSeatCode} به‌صورت موقت قفل شد ✓`);
      } else {
        onError('نام مسافر را وارد کنید یا گزینهٔ «لاک بدون نام» را فعال کنید.');
        setBusy(false);
        return;
      }
      setLockSeatCode(null);
      await reload();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'خطا در ثبت.');
    } finally {
      setBusy(false);
    }
  }

  async function onCompanyBlock() {
    if (!lockSeatCode) return;
    setBusy(true);
    try {
      await lockSeat(flight.id, {
        seatCode: lockSeatCode,
        reason: 'مسدود توسط شرکت هواپیمایی',
        classification: 'FREE',
        passengerName: paxName.trim() || undefined,
        passengerNationalId: paxNid || undefined,
      });
      onNotice(`صندلی ${lockSeatCode} توسط شرکت مسدود شد ✓`);
      setLockSeatCode(null);
      await reload();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'خطا در مسدودسازی.');
    } finally {
      setBusy(false);
    }
  }

  async function onRelease(lockId: string) {
    try {
      await releaseLock(lockId);
      await reload();
      onChanged();
    } catch {
      onError('خطا در آزادسازی صندلی.');
    }
  }

  const baseToman = flight.basePriceIrr ? faMoney(flight.basePriceIrr) : '—';
  const taxHint = flight.basePriceIrr
    ? faMoney(String(Math.round(Number(flight.basePriceIrr) * 0.09)))
    : '—';
  const lockBand = lockSeatCode
    ? BAND_LABEL[bandForRow(Number.parseInt(lockSeatCode, 10) || 0)]
    : '';

  return (
    <div
      className="fixed inset-0 z-[8000] flex items-start justify-center overflow-auto bg-[rgba(7,11,20,.78)] p-4 backdrop-blur-[3px] sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="md-seatmap-title"
        className="relative my-4 w-full max-w-[720px] overflow-hidden rounded-2xl border border-[#22304a] bg-[#0f1623] shadow-[0_40px_100px_-25px_rgba(0,0,0,.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#1f2a3d] px-4 py-3.5">
          <div>
            <h2 id="md-seatmap-title" className="m-0 text-[15.5px] font-extrabold text-white">
              نقشه صندلی‌ها —{' '}
              <span className="font-num" dir="ltr">
                {flight.flightNo}
              </span>
            </h2>
            <div className="mt-1 text-[11px] text-[#9fb0c7]">
              {routeFa(flight.originCode, flight.destCode)} •{' '}
              {aircraftLabel(seatMap?.aircraftType ?? flight.flightNo)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="text-lg leading-none text-[#6b7b94] hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="max-h-[min(78vh,820px)] overflow-y-auto px-4 py-3.5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='جستجو بر اساس نام مسافر یا شماره صندلی — مثلاً «رضایی» یا «12A»'
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#28344c] bg-[#0b1220] px-3 text-xs text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void onSearch()}
              className="h-11 shrink-0 rounded-[10px] bg-[#1668c4] px-4 text-xs font-extrabold text-white"
            >
              جستجوی صندلی
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <LegendChip
              color="#141d2e"
              border="#3a4a66"
              label={`آزاد ${faDigits(counts.free)}`}
            />
            <LegendChip
              color="#f59e0b"
              border="#f59e0b"
              label={`قفل موقت (تا ۱۰ دقیقه) ${faDigits(counts.tempLock)}`}
            />
            <LegendChip
              color="#3b82f6"
              border="#3b82f6"
              label={`رزرو قطعی ${faDigits(counts.sold)}`}
            />
            <LegendChip
              color="#a855f7"
              border="#a855f7"
              label={`مسدود توسط شرکت ${faDigits(counts.blocked)}`}
            />
          </div>

          {loading || !seatMap ? (
            <p className="py-10 text-center text-xs text-[#6b7b94]">در حال بارگذاری نقشهٔ صندلی…</p>
          ) : (
            <div className="mx-auto w-max max-w-full">
              {rowsWithBands.map(({ row, band, showDivider }) => {
                const aisleAfter = seatMap.cabinLayout[row.cabin].aisleAfterIndex;
                return (
                  <div key={row.row}>
                    {showDivider && (
                      <div className="my-2.5 flex items-center gap-2 px-1">
                        <span className="h-px flex-1 bg-[#22304a]" />
                        <span className="whitespace-nowrap text-[9.5px] font-extrabold tracking-wide text-[#8ea3c4]">
                          {BAND_LABEL[band]}
                        </span>
                        <span className="h-px flex-1 bg-[#22304a]" />
                      </div>
                    )}
                    <div className="mb-1.5 flex items-center justify-center gap-1.5">
                      {row.seats.map((s, idx) => {
                        const selected = lockSeatCode === s.seatCode;
                        const highlight = highlightCode === s.seatCode;
                        const v = seatVisual(s.status, s.lockClassification, selected, highlight);
                        return (
                          <span key={s.seatCode} className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={s.seatCode}
                              disabled={s.status === 'SOLD'}
                              onClick={() => onSeatClick(s)}
                              className="h-[28px] w-[28px] rounded-[7px] border-[1.5px] disabled:cursor-default"
                              style={{ background: v.bg, borderColor: v.border }}
                              title={s.seatCode}
                            />
                            {idx === aisleAfter - 1 && (
                              <span
                                data-testid={`aisle-gap-${row.row}`}
                                className="font-num w-5 text-center text-[9px] font-bold text-[#6b7b94]"
                              >
                                {faDigits(row.row)}
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {/* When aisle is after last seat (unusual), still show row num */}
                      {aisleAfter >= row.seats.length && (
                        <span className="font-num w-5 text-center text-[9px] font-bold text-[#6b7b94]">
                          {faDigits(row.row)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {lockedList.length > 0 && (
            <div className="mt-4 rounded-[12px] border border-[#22304a] bg-[#0b1220] p-3">
              <div className="mb-2 text-[11.5px] font-extrabold text-white">
                صندلی‌های قفل‌شده — شمارش معکوس آزادسازی خودکار
              </div>
              <div className="flex flex-col gap-1.5">
                {lockedList.map((s) => (
                  <div
                    key={s.seatCode}
                    className="flex items-center justify-between rounded-[10px] border border-[#1f2a3d] bg-[#141d2e] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => s.lockId && void onRelease(s.lockId)}
                      className="text-[10.5px] font-bold text-[#f87171]"
                      title="آزادسازی"
                    >
                      آزادسازی
                    </button>
                    <span className="font-num text-[13px] font-extrabold text-[#fcd34d]" dir="ltr">
                      {formatCountdown(s.lockExpiresAt, now)}
                    </span>
                    <span className="font-num text-[12px] font-extrabold text-white" dir="ltr">
                      {s.seatCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {lockSeatCode && (
        <div
          className="fixed inset-0 z-[8100] flex items-center justify-center bg-[rgba(7,11,20,.55)] p-4"
          role="presentation"
          onClick={() => setLockSeatCode(null)}
        >
          <div
            role="dialog"
            aria-labelledby="manual-lock-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#22304a] bg-[#0f1623] shadow-[0_30px_80px_-20px_rgba(0,0,0,.75)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1f2a3d] px-4 py-3.5">
              <h3 id="manual-lock-title" className="m-0 text-[15px] font-extrabold text-white">
                لاک دستی صندلی{' '}
                <span className="font-num" dir="ltr">
                  {lockSeatCode}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setLockSeatCode(null)}
                aria-label="بستن"
                className="text-lg text-[#6b7b94] hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-3.5">
              <div className="mb-3 rounded-[11px] border border-[#28344c] bg-[#0b1220] px-3 py-2.5 text-[11px] leading-relaxed text-[#cdd6e3]">
                کلاس نرخی این صندلی: <b className="text-white">{lockBand || md80SectionLabel(lockSeatCode)}</b>
                {' — '}
                قیمت پایه <b className="text-white">{baseToman} تومان</b> + مالیات{' '}
                <b className="text-white">{taxHint} تومان</b> · بار مجاز ۲۰ کیلوگرم
              </div>

              <label className="mb-1 block text-[11px] font-bold text-[#9fb0c7]">
                نام مسافر (اختیاری)
              </label>
              <input
                value={paxName}
                onChange={(e) => setPaxName(e.target.value)}
                placeholder="مثلاً علی رضایی"
                className="mb-3 h-11 w-full rounded-[10px] border border-[#28344c] bg-[#0b1220] px-3 text-xs text-white outline-none"
              />
              <label className="mb-1 block text-[11px] font-bold text-[#9fb0c7]">
                کد ملی (اختیاری)
              </label>
              <input
                value={paxNid}
                onChange={(e) => setPaxNid(e.target.value)}
                placeholder="مثلاً 0012345678"
                dir="ltr"
                className="font-num mb-3 h-11 w-full rounded-[10px] border border-[#28344c] bg-[#0b1220] px-3 text-xs text-white outline-none"
              />

              <label className="mb-4 flex cursor-pointer items-center gap-2 text-[11.5px] text-[#cdd6e3]">
                <input
                  type="checkbox"
                  checked={lockWithoutName}
                  onChange={(e) => setLockWithoutName(e.target.checked)}
                  className="h-4 w-4 accent-[#f59e0b]"
                />
                لاک بدون نام مسافر (لاک اضطراری / نگهداری صندلی)
              </label>

              <button
                type="button"
                disabled={busy}
                onClick={() => void onIssueOrTempLock()}
                className="mb-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#f59e0b] text-[13px] font-extrabold text-[#1a1206] disabled:opacity-60"
              >
                قفل کردن این صندلی و ایجاد PNR
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCompanyBlock()}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-[#a855f7] bg-transparent text-[12.5px] font-extrabold text-[#c4b5fd] disabled:opacity-60"
              >
                مسدود کردن توسط شرکت هواپیمایی (بدون PNR)
              </button>

              {lockedList.length > 0 && (
                <div className="mt-4 border-t border-[#1f2a3d] pt-3">
                  <div className="mb-2 text-[11px] font-bold text-[#9fb0c7]">
                    صندلی‌های قفل‌شده — شمارش معکوس آزادسازی خودکار
                  </div>
                  {lockedList.slice(0, 4).map((s) => (
                    <div
                      key={s.seatCode}
                      className="mb-1 flex items-center justify-between text-xs"
                    >
                      <span className="font-num font-extrabold text-[#fcd34d]" dir="ltr">
                        {formatCountdown(s.lockExpiresAt, now)}
                      </span>
                      <span className="font-num font-bold text-white" dir="ltr">
                        {s.seatCode}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendChip({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22304a] bg-[#0b1220] px-2.5 py-1 text-[10px] text-[#9fb0c7]">
      <span
        className="inline-block h-[11px] w-[11px] rounded-[3px] border"
        style={{ background: color, borderColor: border }}
      />
      {label}
    </span>
  );
}

function md80SectionLabel(seatCode: string): string {
  const row = Number.parseInt(seatCode, 10);
  if (!row) return '—';
  const section = md80SectionForRow(row);
  if (section === 'FIRST') return BAND_LABEL.FIRST;
  if (section === 'BUSINESS') return BAND_LABEL.BUSINESS;
  if (row <= 20) return BAND_LABEL.MCE;
  return BAND_LABEL.ECONOMY;
}
