import { faDigits } from '../../lib/fa-format';
import type { SeatCell, SeatStatus } from '../../types/reservation';
import {
  isMd80Aircraft,
  md80ColsForRow,
  md80IsExitRow,
  md80LeftAmenity,
  md80Rows,
  md80SectionForRow,
  MD80_EXCLUDED,
  MD80_TOTAL_SEATS,
  MD80_WING_ROW_END,
  MD80_WING_ROW_START,
  type Md80CabinSection,
} from '../public-site/checkout/md80-seat-layout';

const SECTION_LABEL: Record<Md80CabinSection, string> = {
  FIRST: 'کلاس یک (First Class)',
  BUSINESS: 'کابین اصلی با فضای پا بیشتر (Main Cabin Extra)',
  ECONOMY: 'کلاس اقتصادی (Economy)',
};

const SECTION_COLOR: Record<Md80CabinSection, string> = {
  FIRST: 'text-[#fbbf24]',
  BUSINESS: 'text-[#67e8f9]',
  ECONOMY: 'text-[#9fb0c7]',
};

function seatTone(status: SeatStatus, selected: boolean, exitRow: boolean): {
  fill: string;
  stroke: string;
  text: string;
} {
  if (selected) return { fill: '#f59e0b', stroke: '#fbbf24', text: '#1a1206' };
  if (status === 'SOLD') return { fill: '#3b82f6', stroke: '#60a5fa', text: '#fff' };
  if (status === 'LOCKED') return { fill: '#f59e0b', stroke: '#fbbf24', text: '#1a1206' };
  if (exitRow) return { fill: '#2a1a22', stroke: '#f0a8b4', text: '#f0a8b4' };
  return { fill: '#18223a', stroke: '#3a4a63', text: '#cdd9ec' };
}

function SeatIcon({
  letter,
  fill,
  stroke,
  text,
  large,
  exitRow,
}: {
  letter: string;
  fill: string;
  stroke: string;
  text: string;
  large?: boolean;
  exitRow?: boolean;
}) {
  const w = large ? 34 : 28;
  const h = large ? 36 : 30;
  return (
    <svg width={w} height={h} viewBox="0 0 28 30" aria-hidden>
      <rect x="4" y="2" width="20" height="8" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <rect x="3" y="10" width="22" height="16" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
      {exitRow && (
        <path d="M14 1 L17 5 H11 Z" fill="#f87171" stroke="#ef4444" strokeWidth="0.8" />
      )}
      <text
        x="14"
        y="21"
        textAnchor="middle"
        fill={text}
        fontSize="10"
        fontWeight="700"
        fontFamily="Inter, Vazirmatn, sans-serif"
      >
        {letter}
      </text>
    </svg>
  );
}

function AmenityChip({
  kind,
}: {
  kind: 'exit' | 'galley' | 'empty' | 'lav' | 'closet';
}) {
  if (kind === 'empty') return <div className="h-9 w-[62px]" aria-hidden />;
  const label =
    kind === 'exit'
      ? 'خروج'
      : kind === 'galley'
        ? 'گالی'
        : kind === 'lav'
          ? 'سرویس'
          : 'کمد';
  return (
    <div
      className="flex h-9 min-w-[62px] flex-col items-center justify-center gap-0.5 rounded-md border border-[#2a3550] bg-[#111b2d] px-1 text-[8px] font-bold text-[#7d8aa0]"
      aria-hidden
    >
      <span>{label}</span>
    </div>
  );
}

function ColumnHeaders({ section }: { section: Md80CabinSection }) {
  const rightCols = section === 'FIRST' ? (['E', 'F'] as const) : (['D', 'E', 'F'] as const);
  return (
    <div className="mb-1 flex items-center justify-center gap-1 text-[9px] font-bold text-[#6b7b94]">
      <span className="w-5" />
      {(['A', 'B'] as const).map((c) => (
        <span key={`hl-${c}`} className="w-[34px] text-center">
          {c}
        </span>
      ))}
      <span className="w-4" />
      {rightCols.map((c) => (
        <span key={`hr-${c}`} className="w-[34px] text-center">
          {c}
        </span>
      ))}
      <span className="w-5" />
    </div>
  );
}

export { isMd80Aircraft, MD80_TOTAL_SEATS };

export default function ReservationMd80SeatMap({
  seatsByCode,
  selectedSeatCode,
  canLock,
  onSeatClick,
}: {
  seatsByCode: Map<string, SeatCell>;
  selectedSeatCode: string | null;
  canLock: boolean;
  onSeatClick: (seat: SeatCell) => void;
}) {
  let lastHeader: Md80CabinSection | null = null;

  function resolveCell(code: string): SeatCell {
    return (
      seatsByCode.get(code) ?? {
        seatCode: code,
        status: 'FREE',
        lockId: null,
        occupant: null,
      }
    );
  }

  return (
    <div
      className="max-h-[380px] overflow-auto rounded-[13px] border border-[#1c2740] bg-gradient-to-b from-[#0d1626] to-[#0b1220] p-3"
      data-testid="reservation-md80-seat-map"
      data-aircraft="MD-80"
    >
      <div dir="ltr" className="mx-auto w-fit min-w-[280px]">
        <div className="mb-1 flex items-end justify-between gap-3 px-1">
          <div className="flex gap-1">
            <AmenityChip kind="closet" />
            <AmenityChip kind="lav" />
          </div>
          <div className="pb-1 text-[10px] font-bold text-[#60a5fa]">▲</div>
          <AmenityChip kind="galley" />
        </div>
        <div className="mb-2 text-center text-[9px] font-bold tracking-wide text-[#5b6b83]">
          جلو هواپیما · MD-80
        </div>

        {md80Rows().map((row) => {
          const section = md80SectionForRow(row);
          const { left, right } = md80ColsForRow(row);
          const amenity = md80LeftAmenity(row);
          const first = section === 'FIRST';
          const exitRow = md80IsExitRow(row);
          const inWing = row >= MD80_WING_ROW_START && row <= MD80_WING_ROW_END;
          const showHeader = lastHeader !== section;
          if (showHeader) lastHeader = section;

          return (
            <div key={row} className="relative">
              {showHeader && (
                <>
                  <ColumnHeaders section={section} />
                  <div
                    className={`mb-0.5 text-[9px] font-extrabold ${SECTION_COLOR[section]}`}
                    data-testid={`reservation-section-${section.toLowerCase()}`}
                  >
                    {SECTION_LABEL[section]}
                  </div>
                </>
              )}

              {exitRow && (
                <div className="mb-0.5 flex items-center justify-center gap-1 text-[8px] font-bold text-[#f87171]">
                  <span>◀</span>
                  <span>ردیف خروج اضطراری</span>
                  <span>▶</span>
                </div>
              )}

              <div
                className={`flex items-center justify-center gap-1 py-[2px] ${
                  inWing ? 'rounded-md bg-[#121c2e]' : ''
                } ${exitRow ? 'rounded-md border border-dashed border-[#5a3040] bg-[#1a1218]' : ''}`}
              >
                <span className="font-num w-5 flex-none text-center text-[10px] font-semibold text-[#6b7b94]">
                  {faDigits(row)}
                </span>

                {amenity ? (
                  <div className="flex w-[70px] justify-center">
                    <AmenityChip kind={amenity} />
                  </div>
                ) : (
                  left.map((letter) => {
                    const code = `${row}${letter}`;
                    if (MD80_EXCLUDED.has(code)) return null;
                    const cell = resolveCell(code);
                    const selected = selectedSeatCode === code;
                    const tone = seatTone(cell.status, selected, exitRow);
                    const clickable = cell.status === 'SOLD' || (canLock && cell.status !== 'LOCKED');
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onSeatClick(cell)}
                        disabled={!clickable && cell.status !== 'LOCKED'}
                        aria-label={code}
                        title={code}
                        className={`inline-flex items-center justify-center rounded p-0 ${
                          clickable || cell.status === 'LOCKED' ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <SeatIcon
                          letter={letter}
                          fill={tone.fill}
                          stroke={tone.stroke}
                          text={tone.text}
                          large={first}
                          exitRow={exitRow}
                        />
                      </button>
                    );
                  })
                )}

                <span data-testid={`aisle-gap-${row}`} className="w-4 flex-none" aria-hidden />

                {first && <span className="inline-block w-[34px]" aria-hidden />}

                {right.map((letter) => {
                  const code = `${row}${letter}`;
                  if (MD80_EXCLUDED.has(code)) return null;
                  const cell = resolveCell(code);
                  const selected = selectedSeatCode === code;
                  const tone = seatTone(cell.status, selected, exitRow);
                  const clickable = cell.status === 'SOLD' || (canLock && cell.status !== 'LOCKED');
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onSeatClick(cell)}
                      disabled={!clickable && cell.status !== 'LOCKED'}
                      aria-label={code}
                      title={code}
                      className={`inline-flex items-center justify-center rounded p-0 ${
                        clickable || cell.status === 'LOCKED' ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <SeatIcon
                        letter={letter}
                        fill={tone.fill}
                        stroke={tone.stroke}
                        text={tone.text}
                        large={first}
                        exitRow={exitRow}
                      />
                    </button>
                  );
                })}

                <span className="font-num w-5 flex-none text-center text-[10px] font-semibold text-[#6b7b94]">
                  {faDigits(row)}
                </span>
              </div>
            </div>
          );
        })}

        <div className="mt-2 flex items-start justify-between gap-3 px-1">
          <div className="flex gap-1">
            <AmenityChip kind="closet" />
            <AmenityChip kind="lav" />
          </div>
          <div className="flex gap-1">
            <AmenityChip kind="closet" />
            <AmenityChip kind="lav" />
          </div>
        </div>
        <div className="mt-1 text-center text-[9px] font-bold tracking-wide text-[#5b6b83]">
          عقب هواپیما · MD-80
        </div>
      </div>
    </div>
  );
}
