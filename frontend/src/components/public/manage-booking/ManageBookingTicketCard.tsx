import type { StoredLocale } from '../../../hooks/useLocale';
import type { BookingDetail } from '../../../types/public-site';
import { cityLabel, flightDurationLabel, formatBookingDate, formatFlightTime } from './manage-booking-utils';

export interface ManageBookingTicketCardProps {
  booking: BookingDetail;
  locale: StoredLocale;
  isMobile: boolean;
  cabinLabel: string;
  labels: {
    pnrLabel: string;
    confirmedLabel: string;
    dateLabel: string;
    terminalLabel: string;
    gateLabel: string;
    cabinLabel: string;
    airlineName: string;
    terminalValue: string;
    gateValue: string;
  };
}

export default function ManageBookingTicketCard({
  booking,
  locale,
  isMobile,
  cabinLabel,
  labels,
}: ManageBookingTicketCardProps) {
  const detailCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const confirmed = booking.status === 'TICKETED';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 18px 50px -30px rgba(13,38,102,.5)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg,#0d2640,#16406e)',
          color: '#fff',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(255,255,255,.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13.5,
            }}
          >
            ✈
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{labels.airlineName}</span>
          {confirmed ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#7ee2b0',
                background: 'rgba(16,185,129,.18)',
                padding: '3px 10px',
                borderRadius: 14,
                marginInlineStart: 4,
              }}
            >
              {labels.confirmedLabel}
            </span>
          ) : null}
        </div>
        <div style={{ textAlign: locale === 'en' ? 'right' : 'left' }}>
          <div style={{ fontSize: 10, color: '#aac4e2' }}>{labels.pnrLabel}</div>
          <div
            data-testid="mb-pnr-show"
            style={{ fontSize: 14.5, fontWeight: 800, fontFamily: "'Roboto Mono',monospace" }}
            dir="ltr"
          >
            {booking.pnr}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 27, fontWeight: 900, color: '#16202e' }} dir="ltr">
            {booking.originCode}
          </div>
          <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 2 }}>{cityLabel(booking.originCode, locale)}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1668c4', marginTop: 6 }}>
            {formatFlightTime(booking.departureAt, locale)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#c2cad6' }}>
          <div style={{ fontSize: 11, color: '#8a96a6' }}>
            {flightDurationLabel(booking.departureAt, booking.arrivalAt, locale)}
          </div>
          <div style={{ width: '100%', height: 2, background: '#e6eaf0', position: 'relative', margin: '7px 0' }}>
            <span style={{ position: 'absolute', left: '50%', top: -7, transform: 'translateX(-50%)', fontSize: 12.5, color: '#1668c4' }}>
              ✈
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: '#9aa4b2' }} dir="ltr">
            {booking.flightNo}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 27, fontWeight: 900, color: '#16202e' }} dir="ltr">
            {booking.destCode}
          </div>
          <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 2 }}>{cityLabel(booking.destCode, locale)}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1668c4', marginTop: 6 }}>
            {formatFlightTime(booking.arrivalAt, locale)}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1.5px dashed #e2e7ee',
          padding: '12px 18px',
          display: 'grid',
          gridTemplateColumns: detailCols,
          gap: 11,
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            right: -11,
            top: -11,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#f6f8fb',
            border: '1px solid #eef1f5',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: -11,
            top: -11,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#f6f8fb',
            border: '1px solid #eef1f5',
          }}
        />
        {[
          [labels.dateLabel, formatBookingDate(booking.departureAt, locale)],
          [labels.terminalLabel, labels.terminalValue],
          [labels.gateLabel, labels.gateValue],
          [labels.cabinLabel, cabinLabel],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10.5, color: '#9aa4b2' }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
