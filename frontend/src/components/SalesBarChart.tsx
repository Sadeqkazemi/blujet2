import { useState } from 'react';
import { faMoney } from '../lib/fa-format';
import { formatJalaliDate } from '../lib/jalali';
import type { SalesChartPeriod } from '../types/reporting';

// Categorical palette validated with the dataviz skill's six-checks script
// (light + dark surfaces) — see chat history for the validation run.
const SERIES = [
  { key: 'systemIrr', label: 'سیستمی', color: '#1668c4' },
  { key: 'charterIrr', label: 'چارتر', color: '#a855f7' },
  { key: 'agencyIrr', label: 'آژانس', color: '#059669' },
] as const;

interface SalesBarChartProps {
  periods: SalesChartPeriod[];
  selectedPeriodKey: string | null;
  onSelectPeriod: (key: string | null) => void;
}

export default function SalesBarChart({ periods, selectedPeriodKey, onSelectPeriod }: SalesBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tableView, setTableView] = useState(false);

  const totals = periods.map((p) => p.systemIrr + p.charterIrr + p.agencyIrr);
  const max = Math.max(1, ...totals);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-text-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
        <button
          onClick={() => setTableView((v) => !v)}
          className="text-[11px] text-muted underline decoration-dotted"
        >
          {tableView ? 'نمایش نموداری' : 'نمایش جدولی'}
        </button>
      </div>

      {tableView ? (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 text-start font-medium">دوره</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-2 text-start font-medium">
                    {s.label}
                  </th>
                ))}
                <th className="py-2 text-start font-medium">جمع</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.periodKey} className="border-b border-border/60 font-num">
                  <td className="py-2">{formatJalaliDate(p.startDate)}</td>
                  <td className="py-2">{faMoney(p.systemIrr)}</td>
                  <td className="py-2">{faMoney(p.charterIrr)}</td>
                  <td className="py-2">{faMoney(p.agencyIrr)}</td>
                  <td className="py-2 font-bold">{faMoney(p.systemIrr + p.charterIrr + p.agencyIrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex h-48 items-stretch gap-2" role="img" aria-label="نمودار فروش دوره‌ای">
          {periods.map((p, i) => {
            const isSelected = selectedPeriodKey === p.periodKey;
            const isHovered = hovered === p.periodKey;
            const barHeightPct = (totals[i] / max) * 100;
            return (
              <div key={p.periodKey} className="relative flex flex-1 flex-col items-center justify-end">
                {isHovered && (
                  <div className="absolute -top-20 z-10 w-max rounded-lg border border-border bg-white p-2 text-[11px] shadow-lg">
                    <div className="mb-1 font-bold">{formatJalaliDate(p.startDate)}</div>
                    {SERIES.map((s) => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: s.color }} />
                        <span className="font-num">{faMoney(p[s.key])}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setHovered(p.periodKey)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectPeriod(isSelected ? null : p.periodKey)}
                  className="flex w-full max-w-9 flex-col justify-end overflow-hidden rounded-t-sm outline-none"
                  style={{
                    height: `${Math.max(barHeightPct, 2)}%`,
                    opacity: selectedPeriodKey && !isSelected ? 0.4 : 1,
                    outline: isSelected ? '2px solid #16202e' : undefined,
                    outlineOffset: isSelected ? '2px' : undefined,
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${formatJalaliDate(p.startDate)} — جمع ${faMoney(totals[i])} تومان`}
                >
                  {SERIES.map((s) => {
                    const segTotal = totals[i] || 1;
                    const segPct = (p[s.key] / segTotal) * 100;
                    return (
                      <div
                        key={s.key}
                        style={{ height: `${segPct}%`, backgroundColor: s.color, marginBottom: 2 }}
                      />
                    );
                  })}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
