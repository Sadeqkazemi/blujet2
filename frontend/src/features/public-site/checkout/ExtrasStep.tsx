import { useState, type ReactNode } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, formatToman } from '../../../lib/fa-format';
import type { CabinClass, SeatMapCell } from '../../../types/public-site';
import { CHECKOUT_COPY } from './checkout-copy';
import type { ExtraServiceState } from './checkout-types';
import Md80SeatMap from './Md80SeatMap';
import { isMd80Aircraft } from './md80-seat-layout';

function SvgBag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

function SvgMeal() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17h18" />
      <path d="M4 17a8 6 0 0 1 16 0" />
      <path d="M12 8V5" />
      <circle cx="12" cy="4" r="1" />
    </svg>
  );
}

function SvgIns() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function SvgCip() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.4-4.2 6-.7z" />
    </svg>
  );
}

const EXTRA_ICONS: Record<ExtraServiceState['id'], ReactNode> = {
  baggage: <SvgBag />,
  meal: <SvgMeal />,
  insurance: <SvgIns />,
  cip: <SvgCip />,
};

/** Left block is always 2 seats for generic maps; aisle before index 2. */
const AISLE_BEFORE_INDEX = 2;

function GenericSeatMap({
  locale,
  seats,
  selectedSeats,
  onToggleSeat,
  businessLocked,
  bookedCabin,
}: {
  locale: StoredLocale;
  seats: SeatMapCell[];
  selectedSeats: string[];
  onToggleSeat: (seatCode: string) => void;
  businessLocked: boolean;
  bookedCabin: CabinClass;
}) {
  const rows = (() => {
    const byRow = new Map<number, SeatMapCell[]>();
    for (const s of seats) {
      const list = byRow.get(s.row) ?? [];
      list.push(s);
      byRow.set(s.row, list);
    }
    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([num, rowSeats]) => ({
        num,
        seats: rowSeats.sort((a, b) => a.seatCode.localeCompare(b.seatCode)),
      }));
  })();

  return (
    <div
      className="flex max-h-[300px] flex-col gap-[5px] overflow-auto rounded-[13px] border border-[#eef1f5] bg-[#f8fafc] p-[13px]"
      data-testid="checkout-seat-map"
    >
      {rows.map((r) => (
        <div key={r.num} className="flex items-center gap-[5px]">
          <span className="w-5 flex-none text-center text-[9.5px] text-[#9aa4b2]">
            {locale === 'en' ? r.num : faDigits(r.num)}
          </span>
          {r.seats.map((st, idx) => {
            const selected = selectedSeats.includes(st.seatCode);
            const taken = st.status === 'TAKEN';
            const biz = st.cabin === 'BUSINESS';
            const locked = (biz && businessLocked) || st.cabin !== bookedCabin;
            let bg = biz ? '#fff6e3' : '#eaf4ff';
            let border = biz ? '#e6c368' : '#bcd9f5';
            let color = biz ? '#a9781a' : '#1668c4';
            if (taken) {
              bg = '#e6eaf0';
              border = '#e6eaf0';
              color = '#c2c9d3';
            } else if (selected) {
              bg = '#1668c4';
              border = '#1668c4';
              color = '#fff';
            } else if (locked) {
              bg = biz ? '#f3f0e6' : '#f0f3f7';
              border = biz ? '#ddd6c0' : '#d5dbe5';
              color = biz ? '#b3a679' : '#9aa4b2';
            }
            return (
              <button
                key={st.seatCode}
                type="button"
                disabled={taken || locked}
                onClick={() => onToggleSeat(st.seatCode)}
                data-testid={`checkout-seat-${st.seatCode}`}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-[1.5px] text-[9.5px] font-bold disabled:cursor-not-allowed"
                style={{
                  background: bg,
                  borderColor: border,
                  color,
                  marginInlineStart: idx === AISLE_BEFORE_INDEX ? 14 : 0,
                }}
              >
                {st.seatCode.replace(/^\d+/, '')}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ExtrasStep({
  locale,
  extras,
  onToggleExtra,
  seats,
  selectedSeats,
  onToggleSeat,
  businessLocked,
  bookedCabin,
  aircraftType,
}: {
  locale: StoredLocale;
  extras: ExtraServiceState[];
  onToggleExtra: (id: ExtraServiceState['id']) => void;
  seats: SeatMapCell[] | null;
  selectedSeats: string[];
  onToggleSeat: (seatCode: string) => void;
  businessLocked: boolean;
  bookedCabin: CabinClass;
  aircraftType: string;
}) {
  const t = CHECKOUT_COPY[locale];
  const [seatOpen, setSeatOpen] = useState(true);
  const aircraft = aircraftType.trim() || 'MD-80';
  const useMd80 = isMd80Aircraft(aircraft);

  const sold = seats?.filter((s) => s.status === 'TAKEN').length ?? 0;
  const cap = seats?.length ?? 0;

  return (
    <section
      className="rounded-[15px] border border-[#eef1f5] bg-white px-[17px] py-4"
      data-testid="checkout-extras-step"
    >
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#eef4fb] text-[#1668c4]">
          <SvgBag />
        </span>
        <h2 className="m-0 text-[15.5px] font-extrabold text-[#0d2640]">{t.travelExtras}</h2>
      </div>
      <p className="mb-[15px] mt-0 text-[11.5px] text-[#9aa4b2]">{t.pickServices}</p>

      <div className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {extras.map((sv) => {
          const copy = t.extras[sv.id];
          return (
            <button
              key={sv.id}
              type="button"
              data-testid={`checkout-extra-${sv.id}`}
              onClick={() => onToggleExtra(sv.id)}
              className={`flex items-center justify-between gap-2.5 rounded-[13px] border-[1.5px] px-3.5 py-[13px] text-start ${
                sv.selected ? 'border-[#1668c4] bg-[#f6faff]' : 'border-[#e6eaf0] bg-white'
              }`}
            >
              <div className="flex items-center gap-[11px]">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-[#f2f6fb] text-[#1668c4]">
                  {EXTRA_ICONS[sv.id]}
                </span>
                <div className="leading-relaxed">
                  <div className="text-[12.5px] font-extrabold text-[#0d2640]">{copy.title}</div>
                  <div className="text-[10.5px] text-[#8a96a6]">{copy.desc}</div>
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-1.5">
                <div className="text-xs font-extrabold text-[#1668c4]">
                  {formatToman(sv.priceToman, locale)} {t.toman}
                </div>
                <span
                  className={`relative inline-block h-5 w-[34px] rounded-xl transition-colors ${
                    sv.selected ? 'bg-[#1668c4]' : 'bg-[#d7dee8]'
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all ${
                      sv.selected ? 'right-0.5 left-auto' : 'left-0.5 right-auto'
                    }`}
                  />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#f0f2f6] pt-[15px]">
        <button
          type="button"
          onClick={() => setSeatOpen((v) => !v)}
          className="mb-2.5 flex w-full items-center justify-between gap-2 text-start"
          data-testid="checkout-seat-toggle"
        >
          <div>
            <div className="text-[13px] font-extrabold text-[#0d2640]">
              {t.seatMapCaption(useMd80 ? 'MD-80' : aircraft)}
            </div>
            {businessLocked && (
              <div className="mt-1 text-[10.5px] text-[#96701a]">🔒 {t.bizLockedHint}</div>
            )}
          </div>
          <span
            className="flex-none text-sm text-[#8a96a6] transition-transform"
            style={{ transform: seatOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ⌄
          </span>
        </button>

        {seatOpen && (
          <>
            <div className="mb-2.5 flex gap-[11px] text-[10.5px] text-[#5a6678]">
              <span className="flex items-center gap-1">
                <span className="h-[13px] w-[13px] rounded border-[1.5px] border-[#e6c368] bg-[#fff6e3]" />
                {t.business}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-[13px] w-[13px] rounded border-[1.5px] border-[#bcd9f5] bg-[#eaf4ff]" />
                {t.available}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-[13px] w-[13px] rounded bg-[#e6eaf0]" />
                {t.reserved}
              </span>
            </div>
            {seats === null ? (
              <p className="text-xs text-[#8a96a6]">{t.loading}</p>
            ) : useMd80 ? (
              <Md80SeatMap
                locale={locale}
                seats={seats}
                selectedSeats={selectedSeats}
                onToggleSeat={onToggleSeat}
                businessLocked={businessLocked}
                bookedCabin={bookedCabin}
              />
            ) : (
              <GenericSeatMap
                locale={locale}
                seats={seats}
                selectedSeats={selectedSeats}
                onToggleSeat={onToggleSeat}
                businessLocked={businessLocked}
                bookedCabin={bookedCabin}
              />
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-[#5a6678]">
              <div>
                {t.selectedSeat}:{' '}
                <b className="text-[#1668c4]" dir="ltr">
                  {selectedSeats.join(', ') || t.noneSelected}
                </b>
              </div>
              <div>
                {t.totalSold}:{' '}
                <b className="text-[#c0343a]">{locale === 'en' ? sold : faDigits(sold)}</b>{' '}
                {t.ofLabel}{' '}
                <b>{locale === 'en' ? (cap || 140) : faDigits(cap || 140)}</b>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
