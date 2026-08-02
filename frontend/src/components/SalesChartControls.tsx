import { useMemo } from 'react';
import JalaliDatePicker from './JalaliDatePicker';
import { dayjs } from '../lib/jalali';
import { faDigits } from '../lib/fa-format';
import type { SalesGranularity } from '../types/reporting';

const MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

function recentJalaliMonths(count = 12) {
  const months: { label: string; periodStart: string }[] = [];
  let d = dayjs().calendar('jalali').startOf('month');
  for (let i = 0; i < count; i++) {
    months.push({
      label: `${MONTH_NAMES[d.month()]} ${faDigits(d.year())}`,
      periodStart: d.toDate().toISOString(),
    });
    d = d.subtract(1, 'month');
  }
  return months;
}

interface SalesChartControlsProps {
  modes: { key: SalesGranularity; label: string }[];
  granularity: SalesGranularity;
  onGranularityChange: (g: SalesGranularity) => void;
  selectedDate: string;
  onSelectedDateChange: (iso: string) => void;
  selectedMonthStart: string;
  onSelectedMonthStartChange: (iso: string) => void;
  flightNo: string;
  onFlightNoChange: (v: string) => void;
  onApplyFlightNo: () => void;
  variant?: 'pill' | 'segmented';
}

export default function SalesChartControls({
  modes,
  granularity,
  onGranularityChange,
  selectedDate,
  onSelectedDateChange,
  selectedMonthStart,
  onSelectedMonthStartChange,
  flightNo,
  onFlightNoChange,
  onApplyFlightNo,
  variant = 'pill',
}: SalesChartControlsProps) {
  const monthOptions = useMemo(() => recentJalaliMonths(), []);

  const modeButtons = modes.map((m) => (
    <button
      key={m.key}
      type="button"
      onClick={() => onGranularityChange(m.key)}
      className={
        variant === 'segmented'
          ? `rounded-md px-3 py-1.5 text-[11px] transition ${
              granularity === m.key ? 'bg-accent font-bold text-white' : 'text-panel-muted hover:text-panel-ink'
            }`
          : `rounded-full px-3 py-1.5 text-xs font-medium transition ${
              granularity === m.key ? 'bg-accent text-white' : 'bg-white/5 text-panel-muted hover:bg-white/10'
            }`
      }
    >
      {m.label}
    </button>
  ));

  return (
    <div className="flex flex-col gap-3">
      <div
        className={
          variant === 'segmented'
            ? 'flex gap-1 rounded-lg border border-white/10 bg-panel-canvas p-1'
            : 'flex flex-wrap gap-1.5'
        }
      >
        {modeButtons}
      </div>

      {granularity === 'day' && (
        <div className="max-w-xs rounded-lg border border-white/10 bg-white/5">
          <JalaliDatePicker
            label="تاریخ"
            value={selectedDate}
            onChange={onSelectedDateChange}
            testId="sales-chart-day"
          />
        </div>
      )}

      {granularity === 'month' && (
        <div className="flex flex-wrap gap-1.5">
          {monthOptions.map((m) => (
            <button
              key={m.periodStart}
              type="button"
              onClick={() => onSelectedMonthStartChange(m.periodStart)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                selectedMonthStart === m.periodStart
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-panel-muted hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {granularity === 'flight' && (
        <div className="flex max-w-sm gap-2">
          <input
            dir="ltr"
            aria-label="شماره پرواز"
            value={flightNo}
            onChange={(e) => onFlightNoChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyFlightNo();
            }}
            placeholder="EP-821"
            className="font-num h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-panel-ink outline-none placeholder:text-panel-muted-2"
          />
          <button
            type="button"
            onClick={onApplyFlightNo}
            className="rounded-lg bg-accent px-4 text-xs font-bold text-white"
          >
            نمایش
          </button>
        </div>
      )}
    </div>
  );
}
