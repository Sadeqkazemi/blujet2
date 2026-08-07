import {
  CABIN_OPTIONS,
  cabinLabel,
  type CabinKind,
  sumCabinSeats,
} from "../../../lib/flight-definition";
import { faDigits, latinDigits } from "../../../lib/fa-format";

const selectClass =
  "w-full box-border h-11 rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3 text-[13px] text-[#e7ecf3] outline-none";
const inputClass =
  "w-full box-border h-11 rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3 text-[13px] text-[#e7ecf3] outline-none";

export interface CabinCapacityRow {
  key: string;
  cabin: CabinKind;
  seats: string;
}

export default function CabinCapacityEditor({
  rows,
  onChange,
  error,
}: {
  rows: CabinCapacityRow[];
  onChange: (rows: CabinCapacityRow[]) => void;
  error?: string | null;
}) {
  const used = new Set(rows.map((r) => r.cabin));
  const total = sumCabinSeats(
    rows.map((r) => ({ seats: Number(latinDigits(r.seats)) || 0 })),
  );

  function update(key: string, patch: Partial<CabinCapacityRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const next = CABIN_OPTIONS.find((c) => !used.has(c.value));
    if (!next) return;
    onChange([
      ...rows,
      { key: `cab-${Date.now()}`, cabin: next.value, seats: "" },
    ]);
  }

  return (
    <div data-testid="cabin-capacity-editor">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-[13px] font-extrabold text-white">
            ظرفیت کابین‌ها
          </h3>
          <p className="mt-1 text-[11px] text-[#6b7b94]">
            جمع صندلی‌ها:{" "}
            <span className="font-num font-bold text-[#e7ecf3]">
              {faDigits(total)}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={used.size >= CABIN_OPTIONS.length}
          className="rounded-[9px] bg-[#3b82f6] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
        >
          افزودن کابین
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-2 text-[11px] font-semibold text-[#f87171]"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const available = CABIN_OPTIONS.filter(
            (c) => c.value === row.cabin || !used.has(c.value),
          );
          return (
            <div
              key={row.key}
              className="grid grid-cols-1 items-end gap-2 rounded-xl border border-[#28344c] bg-[#0f1623] p-2.5 sm:grid-cols-[1fr_1fr_auto]"
              data-testid="cabin-row"
            >
              <div>
                <label className="mb-1 block text-[10.5px] text-[#9fb0c7]">
                  نوع کابین
                </label>
                <select
                  value={row.cabin}
                  onChange={(e) =>
                    update(row.key, { cabin: e.target.value as CabinKind })
                  }
                  className={selectClass}
                  aria-label={`نوع کابین ${cabinLabel(row.cabin)}`}
                >
                  {available.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10.5px] text-[#9fb0c7]">
                  تعداد صندلی
                </label>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  value={row.seats}
                  onChange={(e) =>
                    update(row.key, {
                      seats: latinDigits(e.target.value)
                        .replace(/\D/g, "")
                        .slice(0, 4),
                    })
                  }
                  className={`${inputClass} text-left font-num`}
                  aria-label={`تعداد صندلی ${cabinLabel(row.cabin)}`}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                disabled={rows.length <= 1}
                className="h-11 rounded-[9px] bg-[rgba(248,113,113,.12)] px-3 text-[11px] font-bold text-[#f87171] disabled:opacity-40"
              >
                حذف
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
