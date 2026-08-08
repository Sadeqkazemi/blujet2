import { useMemo } from 'react';
import { faDigits } from '../../lib/fa-format';
import {
  AIRCRAFT_CABIN_OPTIONS,
  type AircraftCabinKind,
  type AircraftSeatMapDraft,
} from '../../types/aircraft';

const inputClass =
  'font-num h-11 w-full rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3 text-[13px] text-[#e7ecf3] outline-none';
const selectClass = inputClass;

function parseColumnLetters(raw: string): string[] {
  return raw
    .split(/[,،\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]$/.test(s));
}

function formatColumnLetters(cols: string[]): string {
  return cols.join(', ');
}

function emptySection(cabin: AircraftCabinKind): AircraftSeatMapDraft {
  return {
    rowStart: 1,
    rowEnd: 1,
    colsLeft: ['A', 'B'],
    colsRight: ['C', 'D', 'E'],
    cabin,
    disabledSeatCodes: [],
  };
}

function sectionSeatCodes(section: AircraftSeatMapDraft): string[] {
  const codes: string[] = [];
  for (let row = section.rowStart; row <= section.rowEnd; row += 1) {
    for (const col of [...section.colsLeft, ...section.colsRight]) {
      codes.push(`${row}${col}`);
    }
  }
  return codes;
}

function cabinLabel(cabin: AircraftCabinKind): string {
  return AIRCRAFT_CABIN_OPTIONS.find((o) => o.value === cabin)?.label ?? cabin;
}

export interface SeatMapEditorProps {
  value: AircraftSeatMapDraft[];
  onChange: (value: AircraftSeatMapDraft[]) => void;
  enabledCabins: AircraftCabinKind[];
  disabled?: boolean;
}

export default function SeatMapEditor({
  value,
  onChange,
  enabledCabins,
  disabled = false,
}: SeatMapEditorProps) {
  const totalConfiguredSeats = useMemo(
    () =>
      value.reduce((sum, section) => {
        const active = sectionSeatCodes(section).filter(
          (code) => !section.disabledSeatCodes.includes(code),
        );
        return sum + active.length;
      }, 0),
    [value],
  );

  function updateSection(index: number, patch: Partial<AircraftSeatMapDraft>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSection(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addSection() {
    const defaultCabin = enabledCabins[0] ?? 'ECONOMY';
    onChange([...value, emptySection(defaultCabin)]);
  }

  function toggleDisabledSeat(sectionIndex: number, seatCode: string) {
    const section = value[sectionIndex];
    if (!section) return;
    const set = new Set(section.disabledSeatCodes);
    if (set.has(seatCode)) set.delete(seatCode);
    else set.add(seatCode);
    updateSection(sectionIndex, { disabledSeatCodes: [...set] });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="seat-map-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[11.5px] text-[#9fb0c7]">
          نقشه صندلی را بر اساس بازه ردیف، ستون‌های چپ/راست راهرو و کلاس کابین تعریف کنید.
        </p>
        <span className="font-num text-[11.5px] text-[#6b7b94]">
          صندلی فعال در نقشه: {faDigits(totalConfiguredSeats)}
        </span>
      </div>

      {value.length === 0 && (
        <p className="rounded-[10px] border border-dashed border-[#28344c] px-4 py-6 text-center text-sm text-[#6b7b94]">
          بخشی برای نقشه صندلی تعریف نشده است.
        </p>
      )}

      {value.map((section, index) => {
        const leftInputId = `seat-map-left-${index}`;
        const rightInputId = `seat-map-right-${index}`;
        const rowStartId = `seat-map-row-start-${index}`;
        const rowEndId = `seat-map-row-end-${index}`;
        const cabinId = `seat-map-cabin-${index}`;

        const rows: number[] = [];
        if (section.rowEnd >= section.rowStart) {
          for (let r = section.rowStart; r <= section.rowEnd; r += 1) rows.push(r);
        }

        return (
          <div
            key={`section-${index}`}
            className="rounded-[12px] border border-[#28344c] bg-[#0f1726] p-4"
            data-testid={`seat-map-section-${index}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="m-0 text-[13px] font-bold text-white">
                بخش {faDigits(index + 1)} — {cabinLabel(section.cabin)}
              </h3>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeSection(index)}
                  className="rounded-lg border border-[#28344c] px-3 py-1.5 text-[11px] font-bold text-[#f87171] hover:border-[#f87171]"
                >
                  حذف بخش
                </button>
              )}
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor={rowStartId} className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                  ردیف از
                </label>
                <input
                  id={rowStartId}
                  type="number"
                  min={1}
                  disabled={disabled}
                  value={section.rowStart}
                  onChange={(e) =>
                    updateSection(index, { rowStart: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <div>
                <label htmlFor={rowEndId} className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                  ردیف تا
                </label>
                <input
                  id={rowEndId}
                  type="number"
                  min={section.rowStart}
                  disabled={disabled}
                  value={section.rowEnd}
                  onChange={(e) =>
                    updateSection(index, {
                      rowEnd: Math.max(section.rowStart, Number(e.target.value) || section.rowStart),
                    })
                  }
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <div>
                <label htmlFor={leftInputId} className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                  ستون چپ (قبل راهرو)
                </label>
                <input
                  id={leftInputId}
                  disabled={disabled}
                  value={formatColumnLetters(section.colsLeft)}
                  onChange={(e) => updateSection(index, { colsLeft: parseColumnLetters(e.target.value) })}
                  placeholder="A, B"
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <div>
                <label htmlFor={rightInputId} className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                  ستون راست (بعد راهرو)
                </label>
                <input
                  id={rightInputId}
                  disabled={disabled}
                  value={formatColumnLetters(section.colsRight)}
                  onChange={(e) => updateSection(index, { colsRight: parseColumnLetters(e.target.value) })}
                  placeholder="C, D, E"
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <div>
                <label htmlFor={cabinId} className="mb-[7px] block text-[11.5px] text-[#9fb0c7]">
                  کلاس کابین
                </label>
                <select
                  id={cabinId}
                  disabled={disabled}
                  value={section.cabin}
                  onChange={(e) => updateSection(index, { cabin: e.target.value as AircraftCabinKind })}
                  className={selectClass}
                >
                  {AIRCRAFT_CABIN_OPTIONS.filter((o) => enabledCabins.includes(o.value)).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {rows.length > 0 && section.colsLeft.length + section.colsRight.length > 0 && (
              <div className="overflow-x-auto rounded-[10px] border border-[#1f2a3d] bg-[#141d2e] p-3">
                <p className="mb-2 text-[10px] text-[#6b7b94]">
                  برای غیرفعال کردن صندلی (خروج اضطراری، گالری و …) روی آن کلیک کنید.
                </p>
                <div className="flex flex-col gap-1">
                  {rows.map((row) => (
                    <div key={row} className="flex items-center gap-2">
                      <span className="font-num w-6 shrink-0 text-center text-[10px] text-[#6b7b94]">
                        {faDigits(row)}
                      </span>
                      <div className="flex gap-1">
                        {section.colsLeft.map((col) => {
                          const code = `${row}${col}`;
                          const isDisabled = section.disabledSeatCodes.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleDisabledSeat(index, code)}
                              title={code}
                              className={`font-num flex h-8 w-8 items-center justify-center rounded-md border text-[10px] font-bold ${
                                isDisabled
                                  ? 'border-[#3a4a66] bg-[#1a2438] text-[#5a6678] line-through'
                                  : 'border-[#28344c] bg-[#0f1726] text-[#e7ecf3] hover:border-[#3b82f6]'
                              }`}
                            >
                              {col}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mx-1 h-6 w-3 shrink-0 rounded-sm bg-[#28344c]" aria-hidden />
                      <div className="flex gap-1">
                        {section.colsRight.map((col) => {
                          const code = `${row}${col}`;
                          const isDisabled = section.disabledSeatCodes.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleDisabledSeat(index, code)}
                              title={code}
                              className={`font-num flex h-8 w-8 items-center justify-center rounded-md border text-[10px] font-bold ${
                                isDisabled
                                  ? 'border-[#3a4a66] bg-[#1a2438] text-[#5a6678] line-through'
                                  : 'border-[#28344c] bg-[#0f1726] text-[#e7ecf3] hover:border-[#3b82f6]'
                              }`}
                            >
                              {col}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!disabled && (
        <button
          type="button"
          onClick={addSection}
          className="self-start rounded-[10px] border border-[#28344c] bg-[#0f1726] px-4 py-2 text-[12px] font-bold text-[#9fb0c7] hover:border-[#3b82f6] hover:text-white"
        >
          + افزودن بخش نقشه
        </button>
      )}
    </div>
  );
}

export { sectionSeatCodes, parseColumnLetters, emptySection };
