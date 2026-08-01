import { useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, formatToman } from '../../../lib/fa-format';
import type { SeatMapCell } from '../../../types/public-site';
import { CHECKOUT_COPY } from './checkout-copy';
import type { ExtraServiceState } from './checkout-types';

export default function ExtrasStep({
  locale,
  extras,
  onToggleExtra,
  seats,
  selectedSeats,
  onToggleSeat,
  businessLocked,
}: {
  locale: StoredLocale;
  extras: ExtraServiceState[];
  onToggleExtra: (id: ExtraServiceState['id']) => void;
  seats: SeatMapCell[] | null;
  selectedSeats: string[];
  onToggleSeat: (seatCode: string) => void;
  businessLocked: boolean;
}) {
  const t = CHECKOUT_COPY[locale];
  const [seatOpen, setSeatOpen] = useState(true);

  const rows = (() => {
    if (!seats) return [] as { num: number; seats: SeatMapCell[] }[];
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

  const sold = seats?.filter((s) => s.status === 'TAKEN').length ?? 0;
  const cap = seats?.length ?? 0;

  return (
    <section
      className="rounded-[15px] border border-[#eef1f5] bg-white px-[17px] py-4"
      data-testid="checkout-extras-step"
    >
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#eef4fb] text-[#1668c4]">
          🧳
        </span>
        <h2 className="m-0 text-[15.5px] font-extrabold text-[#0d2640]">{t.travelExtras}</h2>
      </div>
      <p className="mb-[15px] mt-0 text-[11.5px] text-[#9aa4b2]">{t.pickServices}</p>

      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {extras.map((sv) => {
          const copy = t.extras[sv.id];
          return (
            <button
              key={sv.id}
              type="button"
              data-testid={`checkout-extra-${sv.id}`}
              onClick={() => onToggleExtra(sv.id)}
              className={`flex items-center justify-between gap-2.5 rounded-[13px] border-[1.5px] p-3.5 text-start ${
                sv.selected ? 'border-[#1668c4] bg-[#f3f7fc]' : 'border-[#e6eaf0] bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-[#f2f6fb] text-[#1668c4]">
                  {sv.id === 'baggage' ? '👜' : sv.id === 'meal' ? '🍽' : sv.id === 'insurance' ? '🛡' : '✦'}
                </span>
                <div className="leading-relaxed">
                  <div className="text-[12.5px] font-extrabold text-[#0d2640]">{copy.title}</div>
                  <div className="text-[10.5px] text-[#8a96a6]">{copy.desc}</div>
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-1.5">
                <div className="text-xs font-extrabold text-[#1668c4]">
                  {formatToman(sv.priceToman, locale)}
                </div>
                <span
                  className={`relative inline-block h-5 w-[34px] rounded-xl ${
                    sv.selected ? 'bg-[#1668c4]' : 'bg-[#d5dbe5]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${
                      sv.selected ? 'left-0.5' : 'right-0.5'
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
          className="mb-2.5 flex w-full items-center justify-between gap-2"
        >
          <div>
            <div className="text-[13px] font-extrabold text-[#0d2640]">{t.seat}</div>
            {businessLocked && (
              <div className="mt-1 text-[10.5px] text-[#96701a]">
                🔒 انتخاب صندلی بیزینس نیازمند حداقل ۱۵٬۰۰۰ امتیاز باشگاه است
              </div>
            )}
          </div>
          <span className="text-sm text-[#8a96a6]">{seatOpen ? '⌃' : '⌄'}</span>
        </button>

        {seatOpen && (
          <>
            <div className="mb-2.5 flex gap-2.5 text-[10.5px] text-[#5a6678]">
              <span className="flex items-center gap-1">
                <span className="h-[13px] w-[13px] rounded border-[1.5px] border-[#e6c368] bg-[#fff6e3]" />
                Business
              </span>
              <span className="flex items-center gap-1">
                <span className="h-[13px] w-[13px] rounded border-[1.5px] border-[#bcd9f5] bg-[#eaf4ff]" />
                Free
              </span>
              <span className="flex items-center gap-1">
                <span className="h-[13px] w-[13px] rounded bg-[#e6eaf0]" />
                Taken
              </span>
            </div>
            {seats === null ? (
              <p className="text-xs text-[#8a96a6]">{CHECKOUT_COPY[locale].loading}</p>
            ) : (
              <div
                className="flex max-h-[300px] flex-col gap-1.5 overflow-auto rounded-[13px] border border-[#eef1f5] bg-[#f8fafc] p-3.5"
                data-testid="checkout-seat-map"
              >
                {rows.map((r) => (
                  <div key={r.num} className="flex items-center gap-1.5">
                    <span className="w-5 flex-none text-center text-[9.5px] text-[#9aa4b2]">
                      {locale === 'en' ? r.num : faDigits(r.num)}
                    </span>
                    {r.seats.map((st, idx) => {
                      const selected = selectedSeats.includes(st.seatCode);
                      const taken = st.status === 'TAKEN';
                      const biz = st.cabin === 'BUSINESS';
                      let bg = '#eaf4ff';
                      let border = '#bcd9f5';
                      let color = '#0d2640';
                      if (taken) {
                        bg = '#e6eaf0';
                        border = '#e6eaf0';
                        color = '#9aa4b2';
                      } else if (selected) {
                        bg = '#1668c4';
                        border = '#1668c4';
                        color = '#fff';
                      } else if (biz) {
                        bg = '#fff6e3';
                        border = '#e6c368';
                      }
                      return (
                        <button
                          key={st.seatCode}
                          type="button"
                          disabled={taken || businessLocked}
                          onClick={() => onToggleSeat(st.seatCode)}
                          data-testid={`checkout-seat-${st.seatCode}`}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-[1.5px] text-[9.5px] font-bold disabled:cursor-not-allowed"
                          style={{
                            background: bg,
                            borderColor: border,
                            color,
                            marginLeft: idx === 2 ? 8 : 0,
                          }}
                        >
                          {st.seatCode.replace(/^\d+/, '')}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5a6678]">
              <div>
                {t.seat}:{' '}
                <b className="text-[#1668c4]" dir="ltr">
                  {selectedSeats.join(', ') || t.noneSelected}
                </b>
              </div>
              <div>
                {locale === 'en' ? 'Sold' : 'فروخته‌شده'}:{' '}
                <b className="text-[#c0343a]">{locale === 'en' ? sold : faDigits(sold)}</b> /{' '}
                <b>{locale === 'en' ? cap : faDigits(cap)}</b>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
