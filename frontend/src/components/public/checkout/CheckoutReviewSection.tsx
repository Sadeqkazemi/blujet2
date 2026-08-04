import type { BookingPassengerView } from '../../../types/public-site';

export interface CheckoutReviewSectionProps {
  passengers: BookingPassengerView[];
  labels: {
    title: string;
    passenger: string;
    seat: string;
    nameChangeWarning: string;
  };
}

export default function CheckoutReviewSection({
  passengers,
  labels,
}: CheckoutReviewSectionProps) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 15,
        padding: '16px 17px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 15 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: '#eef4fb',
            color: '#1668c4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          ✓
        </span>
        <h2 style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: '#0d2640' }}>{labels.title}</h2>
      </div>

      <div style={{ border: '1px solid #eef1f5', borderRadius: 13, overflow: 'hidden', marginBottom: 13 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            background: '#f8fafc',
            padding: '10px 13px',
            fontSize: 10.5,
            color: '#8a96a6',
            fontWeight: 700,
            borderBottom: '1px solid #eef1f5',
          }}
        >
          <span>{labels.passenger}</span>
          <span>{labels.seat}</span>
        </div>
        {passengers.map((p) => (
          <div
            key={`${p.fullName}-${p.seatCode}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              padding: '12px 13px',
              borderTop: '1px solid #f0f2f6',
              fontSize: 12,
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, color: '#0d2640' }}>{p.fullName}</span>
            <span className="font-num" style={{ color: '#3b4554' }} dir="ltr">
              {p.seatCode ?? '—'}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: '#fff9ee',
          border: '1px solid #f0dcae',
          borderRadius: 11,
          padding: '11px 13px',
          fontSize: 11,
          color: '#96701a',
          lineHeight: 1.9,
        }}
      >
        {labels.nameChangeWarning}
      </div>
    </section>
  );
}
