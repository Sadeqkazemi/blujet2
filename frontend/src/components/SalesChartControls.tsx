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
  theme?: 'light' | 'dark';
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
  theme = 'light',
}: SalesChartControlsProps) {
  const monthOptions = useMemo(() => recentJalaliMonths(), []);
  const dark = theme === 'dark';

  const inactiveSegmented = dark ? 'text-[#9fb0c7] hover:text-white' : 'text-muted hover:text-ink';
  const inactivePill = dark
    ? 'bg-[#18223a] text-[#9fb0c7] hover:bg-[#1f2a3d]'
    : 'bg-surface text-text-2 hover:bg-surface-2';

  const modeButtons = modes.map((m) => (
    <button
      key={m.key}
      type="button"
      onClick={() => onGranularityChange(m.key)}
      className={
        dark
          ? `rounded-lg px-[11px] py-1.5 text-[11px] transition ${
              granularity === m.key
                ? 'bg-[#3b82f6] font-extrabold text-white'
                : 'font-medium text-[#9fb0c7] hover:text-white'
            }`
          : variant === 'segmented'
            ? `rounded-md px-3 py-1.5 text-[11px] transition ${
                granularity === m.key ? 'bg-accent font-bold text-white' : 'text-muted hover:text-ink'
              }`
            : `rounded-full px-3 py-1.5 text-xs font-medium transition ${
                granularity === m.key ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
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
          dark
            ? 'flex flex-wrap gap-[5px] rounded-[11px] border border-[#28344c] bg-[#18223a] p-[3px]'
            : variant === 'segmented'
              ? 'flex gap-1 rounded-lg border border-border bg-body p-1'
              : 'flex flex-wrap gap-1.5'
        }
      >
        {modeButtons}
      </div>

      {granularity === 'day' && (
        <div
          className={
            dark
              ? 'max-w-xs rounded-[11px] border border-[#28344c] bg-[#18223a]'
              : 'max-w-xs rounded-lg border border-border bg-surface'
          }
        >
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
              className={
                dark
                  ? `rounded-[9px] border px-3 py-1.5 text-[11px] font-medium transition ${
                      selectedMonthStart === m.periodStart
                        ? 'border-[#3b82f6] bg-[#3b82f6] font-bold text-white'
                        : 'border-[#28344c] bg-[#18223a] text-[#9fb0c7] hover:text-white'
                    }`
                  : `rounded-full px-3 py-1 text-[11px] font-medium transition ${
                      selectedMonthStart === m.periodStart
                        ? 'bg-accent text-white'
                        : 'bg-surface text-text-2 hover:bg-surface-2'
                    }`
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Dark analytic مالی owns its own flight search+cards (design). */}
      {granularity === 'flight' && !dark && (
        <div className="flex max-w-md gap-2">
          <input
            dir="ltr"
            aria-label="شماره پرواز"
            value={flightNo}
            onChange={(e) => onFlightNoChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyFlightNo();
            }}
            placeholder="جستجوی شماره پرواز یا مسیر…"
            className="font-num h-10 flex-1 rounded-lg border border-border px-3 text-xs outline-none"
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
