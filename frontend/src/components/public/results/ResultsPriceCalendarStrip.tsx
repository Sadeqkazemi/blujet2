import type { StoredLocale } from '../../../hooks/useLocale';
import { formatToman } from '../../../lib/fa-format';
import { formatJalaliDate } from '../../../lib/jalali';
import type { PriceCalendarDay } from '../../../types/public-site';

export interface ResultsPriceCalendarStripProps {
  days: PriceCalendarDay[];
  selectedDate: string;
  calendarMinPrice: bigint | null;
  locale: StoredLocale;
  isMobile: boolean;
  onDayClick: (date: string) => void;
}

export default function ResultsPriceCalendarStrip({
  days,
  selectedDate,
  calendarMinPrice,
  locale,
  isMobile,
  onDayClick,
}: ResultsPriceCalendarStripProps) {
  if (days.length === 0) return null;

  return (
    <div style={{ borderBottom: '1px solid #e8eef6', background: '#fff' }}>
      <div
        data-testid="price-calendar"
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: isMobile ? '0 12px' : '0 26px',
          display: 'flex',
          overflowX: isMobile ? 'auto' : 'visible',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {days.map((c) => {
          const price = BigInt(c.minPriceIrr);
          const cheap = calendarMinPrice !== null && price > 0n && price === calendarMinPrice;
          const sel = c.date === selectedDate;
          const toman = price > 0n ? Math.round(Number(price) / 10) : 0;
          return (
            <div
              key={c.date}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(c.date)}
              onKeyDown={(e) => e.key === 'Enter' && onDayClick(c.date)}
              style={{
                cursor: 'pointer',
                borderBottom: sel ? '2px solid #1668c4' : '2px solid transparent',
                background: sel ? '#f2f7fd' : 'transparent',
                padding: '10px 12px',
                textAlign: 'center',
                flex: isMobile ? '0 0 auto' : 1,
                minWidth: isMobile ? 72 : undefined,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: sel ? '#1668c4' : '#5a6678',
                }}
              >
                {locale === 'en'
                  ? new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : formatJalaliDate(`${c.date}T12:00:00Z`)}
              </div>
              <div
                className="font-num"
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  fontWeight: 800,
                  color: cheap ? '#1f8a5b' : sel ? '#0d2640' : '#8a96a6',
                }}
              >
                {toman > 0 ? formatToman(toman, locale) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
