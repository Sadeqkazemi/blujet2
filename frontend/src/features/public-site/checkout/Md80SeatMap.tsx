import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';
import type { CabinClass, SeatMapCell } from '../../../types/public-site';
import {
  md80ColsForRow,
  md80LeftAmenity,
  md80Rows,
  MD80_EXCLUDED,
} from './md80-seat-layout';

function AmenityCell({
  kind,
  locale,
}: {
  kind: 'exit' | 'galley' | 'empty' | 'lav' | 'closet';
  locale: StoredLocale;
}) {
  const label =
    kind === 'exit'
      ? locale === 'en'
        ? 'EXIT'
        : 'خروج'
      : kind === 'galley'
        ? locale === 'en'
          ? 'GALLEY'
          : 'گالی'
        : kind === 'lav'
          ? locale === 'en'
            ? 'LAV'
            : 'سرویس'
          : kind === 'closet'
            ? locale === 'en'
              ? 'CLOSET'
              : 'کمد'
            : '';
  return (
    <div
      className="flex h-[30px] min-w-[64px] items-center justify-center rounded-[7px] border border-dashed border-[#c5d0de] bg-[#f0f4f8] px-1 text-[8px] font-bold text-[#6b7b94]"
      aria-hidden
    >
      {label}
    </div>
  );
}

function SeatButton({
  seatCode,
  letter,
  cabin,
  status,
  selected,
  disabled,
  onToggle,
}: {
  seatCode: string;
  letter: string;
  cabin: CabinClass;
  status: 'FREE' | 'TAKEN' | 'MISSING';
  selected: boolean;
  disabled: boolean;
  onToggle: (code: string) => void;
}) {
  if (status === 'MISSING') {
    return <div className="h-[30px] w-[30px]" aria-hidden />;
  }
  const biz = cabin === 'BUSINESS';
  let bg = biz ? '#fff6e3' : '#eaf4ff';
  let border = biz ? '#e6c368' : '#bcd9f5';
  let color = biz ? '#a9781a' : '#1668c4';
  if (status === 'TAKEN') {
    bg = '#e6eaf0';
    border = '#e6eaf0';
    color = '#c2c9d3';
  } else if (selected) {
    bg = '#1668c4';
    border = '#1668c4';
    color = '#fff';
  } else if (disabled) {
    bg = biz ? '#f3f0e6' : '#f0f3f7';
    border = biz ? '#ddd6c0' : '#d5dbe5';
    color = biz ? '#b3a679' : '#9aa4b2';
  }
  return (
    <button
      type="button"
      disabled={disabled || status === 'TAKEN'}
      onClick={() => onToggle(seatCode)}
      data-testid={`checkout-seat-${seatCode}`}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-[1.5px] text-[9.5px] font-bold disabled:cursor-not-allowed"
      style={{ background: bg, borderColor: border, color }}
      title={seatCode}
    >
      {letter}
    </button>
  );
}

export default function Md80SeatMap({
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
  const byCode = new Map(seats.map((s) => [s.seatCode, s]));
  const excluded = MD80_EXCLUDED;

  function cellStatus(code: string): 'FREE' | 'TAKEN' | 'MISSING' {
    if (excluded.has(code)) return 'MISSING';
    const cell = byCode.get(code);
    if (!cell) {
      // Partial/empty API payload: keep the MD-80 silhouette but non-selectable.
      return 'MISSING';
    }
    return cell.status === 'TAKEN' ? 'TAKEN' : 'FREE';
  }

  function isDisabled(code: string, cabin: CabinClass, status: 'FREE' | 'TAKEN' | 'MISSING') {
    if (status !== 'FREE') return true;
    if (cabin !== bookedCabin) return true;
    if (cabin === 'BUSINESS' && businessLocked) return true;
    return false;
  }

  return (
    <div
      className="flex max-h-[360px] flex-col gap-1 overflow-auto rounded-[13px] border border-[#eef1f5] bg-[#f8fafc] p-3"
      data-testid="checkout-seat-map"
      data-aircraft="MD-80"
    >
      {/* Nose amenities */}
      <div className="mb-1 flex items-center justify-center gap-2 px-6">
        <AmenityCell kind="closet" locale={locale} />
        <AmenityCell kind="lav" locale={locale} />
        <div className="w-6" />
        <AmenityCell kind="galley" locale={locale} />
      </div>
      <div className="mb-2 text-center text-[9px] font-bold tracking-wide text-[#9aa4b2]">
        {locale === 'en' ? 'FRONT · MD-80' : 'جلو هواپیما · MD-80'}
      </div>

      {/* Column headers */}
      <div className="mb-1 flex items-center justify-center gap-[5px] text-[9px] font-bold text-[#8a96a6]">
        <span className="w-5" />
        {(['A', 'B'] as const).map((c) => (
          <span key={`h-l-${c}`} className="w-[30px] text-center">
            {c}
          </span>
        ))}
        <span className="w-[14px]" />
        {(['D', 'E', 'F'] as const).map((c) => (
          <span key={`h-r-${c}`} className="w-[30px] text-center">
            {c}
          </span>
        ))}
        <span className="w-5" />
      </div>

      {md80Rows().map((row) => {
        const { left, right, cabin } = md80ColsForRow(row);
        const amenity = md80LeftAmenity(row);
        const showFirstLabel = row === 3;
        const showEcoLabel = row === 7;

        return (
          <div key={row}>
            {showFirstLabel && (
              <div className="mb-1 mt-0.5 text-[9px] font-extrabold text-[#a9781a]">
                {locale === 'en' ? 'FIRST CLASS' : 'فرست کلاس'}
              </div>
            )}
            {showEcoLabel && (
              <div className="mb-1 mt-1.5 text-[9px] font-extrabold text-[#1668c4]">
                {locale === 'en' ? 'ECONOMY CLASS' : 'اکونومی'}
              </div>
            )}
            {(row === 20 || row === 19) && (
              <div className="my-1 h-px bg-[#cfe0f2]" />
            )}
            <div className="flex items-center justify-center gap-[5px]">
              <span className="w-5 flex-none text-center text-[9.5px] text-[#9aa4b2]">
                {locale === 'en' ? row : faDigits(row)}
              </span>

              {amenity ? (
                <div className="flex w-[65px] justify-center">
                  <AmenityCell kind={amenity} locale={locale} />
                </div>
              ) : (
                left.map((letter) => {
                  // Business right uses E/F; header shows D E F — pad D for biz rows
                  const code = `${row}${letter}`;
                  const status = cellStatus(code);
                  return (
                    <SeatButton
                      key={code}
                      seatCode={code}
                      letter={letter}
                      cabin={cabin}
                      status={status}
                      selected={selectedSeats.includes(code)}
                      disabled={isDisabled(code, cabin, status)}
                      onToggle={onToggleSeat}
                    />
                  );
                })
              )}

              <span className="w-[14px] flex-none" aria-hidden />

              {/* Business rows only have E,F — pad a blank under header D */}
              {cabin === 'BUSINESS' && <div className="h-[30px] w-[30px]" aria-hidden />}

              {right.map((letter) => {
                const code = `${row}${letter}`;
                const status = cellStatus(code);
                return (
                  <SeatButton
                    key={code}
                    seatCode={code}
                    letter={letter}
                    cabin={cabin}
                    status={status}
                    selected={selectedSeats.includes(code)}
                    disabled={isDisabled(code, cabin, status)}
                    onToggle={onToggleSeat}
                  />
                );
              })}

              <span className="w-5 flex-none text-center text-[9.5px] text-[#9aa4b2]">
                {locale === 'en' ? row : faDigits(row)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Tail amenities */}
      <div className="mt-2 flex items-center justify-center gap-2 px-6">
        <AmenityCell kind="closet" locale={locale} />
        <AmenityCell kind="lav" locale={locale} />
        <div className="w-6" />
        <AmenityCell kind="closet" locale={locale} />
        <AmenityCell kind="lav" locale={locale} />
      </div>
      <div className="mt-1 text-center text-[9px] font-bold tracking-wide text-[#9aa4b2]">
        {locale === 'en' ? 'REAR · MD-80' : 'عقب هواپیما · MD-80'}
      </div>
    </div>
  );
}
