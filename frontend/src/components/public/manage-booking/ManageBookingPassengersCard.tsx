import type { StoredLocale } from '../../../hooks/useLocale';
import type { BookingPassengerView } from '../../../types/public-site';
import { passengerInitials } from './manage-booking-utils';

export interface ManageBookingPassengersCardProps {
  passengers: BookingPassengerView[];
  locale: StoredLocale;
  ticketed: boolean;
  labels: {
    heading: string;
    seatLabel: string;
    issuedLabel: string;
    seatConfirmed: (seat: string) => string;
  };
}

export default function ManageBookingPassengersCard({
  passengers,
  locale,
  ticketed,
  labels,
}: ManageBookingPassengersCardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 15 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 14 }}>{labels.heading}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {passengers.map((p) => (
          <div
            key={p.seatCode ?? p.fullName}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f6f8fb',
              borderRadius: 11,
              padding: '11px 11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: '#eef4fb',
                  color: '#1668c4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 11.5,
                  flex: 'none',
                }}
              >
                {passengerInitials(p.fullName)}
              </span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.fullName}</div>
                {p.seatCode ? (
                  <div style={{ fontSize: 10.5, color: '#9aa4b2' }}>
                    {labels.seatLabel}{' '}
                    <span dir="ltr">{p.seatCode}</span>
                    {ticketed ? ` · ${labels.seatConfirmed(p.seatCode)}` : ''}
                  </div>
                ) : null}
              </div>
            </div>
            {ticketed ? (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#1f8a5b',
                  background: '#eef9f1',
                  padding: '4px 10px',
                  borderRadius: 14,
                }}
              >
                {labels.issuedLabel}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
