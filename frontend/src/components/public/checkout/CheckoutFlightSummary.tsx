import type { StoredLocale } from '../../../hooks/useLocale';
import { formatJalaliDate } from '../../../lib/jalali';
import type { BookingDetail } from '../../../types/public-site';
import { formatFlightClock } from './checkout-utils';

export interface CheckoutFlightSummaryProps {
  booking: BookingDetail;
  locale: StoredLocale;
  cabinLabel: string;
  isMobile: boolean;
}

export default function CheckoutFlightSummary({
  booking,
  locale,
  cabinLabel,
  isMobile,
}: CheckoutFlightSummaryProps) {
  const routeLabel =
    locale === 'en'
      ? `${booking.originCode} → ${booking.destCode}`
      : `${booking.originCode} ← ${booking.destCode}`;

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 15,
        padding: isMobile ? '20px 16px' : '32px 18px',
        minHeight: 130,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#1668c4',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flex: 'none',
          }}
        >
          ✈
        </span>
        <div style={{ lineHeight: 1.6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0d2640' }} dir="ltr">
            {routeLabel}
          </div>
          <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 3 }} dir="ltr">
            {formatJalaliDate(booking.departureAt)} · {formatFlightClock(booking.departureAt, locale)} ·{' '}
            <span data-testid="checkout-flight-no">{booking.flightNo}</span>
          </div>
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#1f8a5b',
          background: '#e9f6ef',
          border: '1px solid #cdeadb',
          padding: '6px 12px',
          borderRadius: 16,
          flex: 'none',
        }}
      >
        {cabinLabel}
      </span>
    </section>
  );
}
