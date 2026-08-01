import type { StoredLocale } from '../../../hooks/useLocale';
import { localeMoney } from '../../../lib/fa-format';
import { formatFlightClock } from './results-utils';
import type { CabinClass, SearchFlightResult } from '../../../types/public-site';

const STR: Record<
  StoredLocale,
  {
    title: string;
    seatReserved: string;
    stepPax: string;
    stepSeat: string;
    stepPay: string;
    continue: string;
    flight: string;
    total: string;
    toman: string;
  }
> = {
  fa: {
    title: 'تکمیل خرید',
    seatReserved: 'صندلی رزرو شد',
    stepPax: 'مسافران',
    stepSeat: 'انتخاب صندلی',
    stepPay: 'پرداخت',
    continue: 'ادامه تکمیل خرید',
    flight: 'پرواز',
    total: 'جمع',
    toman: 'تومان',
  },
  en: {
    title: 'Complete purchase',
    seatReserved: 'Seat reserved',
    stepPax: 'Passengers',
    stepSeat: 'Seat selection',
    stepPay: 'Payment',
    continue: 'Continue to checkout',
    flight: 'Flight',
    total: 'Total',
    toman: 'Toman',
  },
  ar: {
    title: 'إتمام الشراء',
    seatReserved: 'تم حجز المقعد',
    stepPax: 'المسافرون',
    stepSeat: 'اختيار المقعد',
    stepPay: 'الدفع',
    continue: 'متابعة الشراء',
    flight: 'رحلة',
    total: 'الإجمالي',
    toman: 'تومان',
  },
};

export interface ResultsBuyOverlayProps {
  open: boolean;
  locale: StoredLocale;
  flight: SearchFlightResult | null;
  cabin: CabinClass | null;
  priceIrr: string | null;
  onClose: () => void;
  onContinue: () => void;
}

export default function ResultsBuyOverlay({
  open,
  locale,
  flight,
  cabin,
  priceIrr,
  onClose,
  onContinue,
}: ResultsBuyOverlayProps) {
  const t = STR[locale];
  if (!open || !flight || !cabin || !priceIrr) return null;

  const steps = [
    { label: t.stepPax, active: true },
    { label: t.stepSeat, active: false },
    { label: t.stepPay, active: false },
  ];

  return (
    <div
      data-testid="buy-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,38,64,.55)',
        zIndex: 210,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          minHeight: '100%',
          padding: '16px 26px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: '#f6f8fb',
            borderRadius: 18,
            width: 980,
            maxWidth: '100%',
            margin: 'auto',
            boxShadow: '0 30px 70px -20px rgba(0,0,0,.5)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '12px 16px',
              borderBottom: '1px solid #e6eaf0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 16.5, fontWeight: 800, color: '#0d2640' }}>{t.title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#d9730d',
                  background: '#fff4e8',
                  padding: '6px 12px',
                  borderRadius: 18,
                }}
              >
                ⏱ {t.seatReserved} · <span dir="ltr">10:00</span>
              </span>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22.5, color: '#6b7787', cursor: 'pointer' }}>
                ×
              </button>
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              padding: '13px 16px',
              borderBottom: '1px solid #eef1f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              fontSize: 13.5,
              flexWrap: 'wrap',
            }}
          >
            {steps.map((st, i) => (
              <span key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: st.active ? '#1668c4' : '#fff',
                    border: st.active ? 'none' : '1.5px solid #d6dee8',
                    color: st.active ? '#fff' : '#8a96a6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: st.active ? '#1668c4' : '#8a96a6', fontWeight: st.active ? 800 : 600 }}>
                  {st.label}
                </span>
                {i < steps.length - 1 && (
                  <span style={{ width: 22, height: 1.5, background: '#d6dee8', margin: '0 4px' }} />
                )}
              </span>
            ))}
          </div>
          <div style={{ padding: '20px 16px 24px' }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid #eef1f5',
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', marginBottom: 8 }}>{t.flight}</div>
              <div style={{ fontSize: 13.5, color: '#5a6678', display: 'flex', flexWrap: 'wrap', gap: 8 }} dir="ltr">
                <span style={{ fontWeight: 800, color: '#16202e' }}>{flight.flightNo}</span>
                <span>{flight.originCode} → {flight.destCode}</span>
                <span>{formatFlightClock(flight.departureAt, locale)}</span>
                <span>{cabin}</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#16202e' }}>{t.total}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#1668c4' }}>
                  {localeMoney(priceIrr, locale)} {t.toman}
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid="buy-overlay-continue"
              onClick={onContinue}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 12,
                background: '#1668c4',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.continue}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
