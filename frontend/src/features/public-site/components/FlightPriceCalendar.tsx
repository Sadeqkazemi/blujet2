import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPriceCalendar } from '../../../api/publicSite';
import type { StoredLocale } from '../../../hooks/useLocale';
import {
  findCheapestPriceCalendarDate,
  formatPriceCalendarDayParts,
  formatPriceCalendarPrice,
  priceCalendarCopy,
} from '../../../lib/price-calendar';
import type { PriceCalendarDay } from '../../../types/public-site';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'empty';

export default function FlightPriceCalendar({
  origin,
  dest,
  selectedDate,
  locale,
  onSelectDate,
  compact = false,
}: {
  origin: string;
  dest: string;
  selectedDate: string;
  locale: StoredLocale;
  onSelectDate: (isoDate: string) => void;
  /** Slightly tighter padding for embedding under the home search card. */
  compact?: boolean;
}) {
  const copy = priceCalendarCopy(locale);
  const isRTL = locale !== 'en';
  const [days, setDays] = useState<PriceCalendarDay[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!origin || !dest || !selectedDate) {
      setDays([]);
      setState('idle');
      return;
    }
    setState('loading');
    try {
      const data = await fetchPriceCalendar(origin, dest, selectedDate.slice(0, 10));
      setDays(data);
      setState(data.length === 0 ? 'empty' : 'ready');
    } catch {
      setDays([]);
      setState('error');
    }
  }, [origin, dest, selectedDate]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const cheapestDate = useMemo(() => findCheapestPriceCalendarDate(days), [days]);

  if (!origin || !dest || !selectedDate) return null;

  return (
    <section
      data-testid="price-calendar"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label={copy.title}
      style={{
        maxWidth: compact ? '100%' : 1320,
        margin: compact ? '12px 0 0' : '0 auto',
        padding: compact ? 0 : '16px 26px 0',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #eef1f5',
          borderRadius: 14,
          padding: compact ? 12 : 16,
          boxSizing: 'border-box',
          maxWidth: '100%',
        }}
      >
        <div style={{ marginBottom: 13 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0d2640' }}>{copy.title}</div>
          <div style={{ fontSize: 12.5, color: '#8a96a6', marginTop: 2 }}>{copy.subtitle}</div>
        </div>

        {state === 'loading' && (
          <div data-testid="price-calendar-loading" style={{ fontSize: 13, color: '#5a6678', padding: '10px 4px' }}>
            {copy.loading}
          </div>
        )}

        {state === 'error' && (
          <div
            data-testid="price-calendar-error"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              background: '#fff4e8',
              border: '1px solid #f6dcbb',
              color: '#c2410c',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13.5,
            }}
          >
            <span>{copy.error}</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              style={{
                border: 'none',
                background: '#1668c4',
                color: '#fff',
                borderRadius: 9,
                padding: '7px 14px',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copy.retry}
            </button>
          </div>
        )}

        {state === 'empty' && (
          <div data-testid="price-calendar-empty" style={{ fontSize: 13, color: '#8a96a6', padding: '10px 4px' }}>
            {copy.emptyDay}
          </div>
        )}

        {state === 'ready' && (
          <div
            data-testid="price-calendar-strip"
            style={{
              display: 'flex',
              gap: 9,
              overflowX: 'auto',
              overflowY: 'visible',
              paddingBottom: 2,
              paddingTop: 10,
              maxWidth: '100%',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
            }}
          >
            {days.map((day) => {
              const selected = day.date === selectedDate.slice(0, 10);
              const isCheapest = cheapestDate != null && day.date === cheapestDate;
              const empty = formatPriceCalendarPrice(day.minPriceIrr, locale, copy.emptyDay) === copy.emptyDay;
              const parts = formatPriceCalendarDayParts(day.date, locale);
              const priceStr = formatPriceCalendarPrice(day.minPriceIrr, locale, copy.emptyDay);
              const border = selected ? '#1668c4' : '#e6eaf0';
              const bg = selected ? '#f2f7fd' : '#fff';
              const color = selected ? '#1668c4' : '#0d2640';
              const subColor = selected ? '#1668c4' : '#5a6678';
              const priceColor = empty ? '#8a96a6' : isCheapest ? '#1f8a5b' : selected ? '#0d2640' : '#3b4554';

              return (
                <button
                  key={day.date}
                  type="button"
                  data-testid={`price-calendar-day-${day.date}`}
                  data-selected={selected ? 'true' : 'false'}
                  data-empty={empty ? 'true' : 'false'}
                  aria-pressed={selected}
                  onClick={() => onSelectDate(day.date)}
                  style={{
                    flex: '1 0 auto',
                    minWidth: 112,
                    maxWidth: 160,
                    cursor: 'pointer',
                    borderRadius: 12,
                    border: `1.5px solid ${border}`,
                    background: bg,
                    padding: '11px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    textAlign: 'center',
                    position: 'relative',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                >
                  {isCheapest && !empty && (
                    <span
                      data-testid={`price-calendar-cheapest-${day.date}`}
                      style={{
                        position: 'absolute',
                        top: -9,
                        background: '#1f8a5b',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 20,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {copy.cheapest}
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: subColor }}>{parts.weekday}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{parts.dateStr}</span>
                  <span
                    className="font-num"
                    style={{ fontSize: 13, fontWeight: 800, color: priceColor, whiteSpace: 'nowrap' }}
                  >
                    {priceStr}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
