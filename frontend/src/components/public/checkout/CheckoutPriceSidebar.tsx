import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, localeMoney } from '../../../lib/fa-format';

export interface CheckoutPriceSidebarProps {
  locale: StoredLocale;
  isMobile: boolean;
  priceIrr: string;
  passengerCount: number;
  labels: {
    paymentDetails: string;
    description: string;
    amountToman: string;
    ticketPrice: string;
    adult: string;
    taxesFees: string;
    total: string;
    toman: string;
    securePayment: string;
    agreeTermsPrefix: string;
    siteTerms: string;
    agreeTermsSuffix: string;
    continueToPayment: string;
  };
  onContinue: () => void;
}

export default function CheckoutPriceSidebar({
  locale,
  isMobile,
  priceIrr,
  passengerCount,
  labels,
  onContinue,
}: CheckoutPriceSidebarProps) {
  const paxLabel =
    locale === 'en'
      ? `${passengerCount} adult${passengerCount > 1 ? 's' : ''}`
      : `${faDigits(passengerCount)} ${labels.adult}`;

  const content = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16.5, fontWeight: 800, color: '#0d2640', whiteSpace: 'nowrap' }}>
          {labels.paymentDetails}
        </span>
      </div>

      <div style={{ border: '1px solid #eef1f5', borderRadius: 13, overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            background: '#f8fafc',
            padding: '9px 14px',
            fontSize: 10.5,
            color: '#8a96a6',
            fontWeight: 700,
            borderBottom: '1px solid #eef1f5',
          }}
        >
          <span>{labels.description}</span>
          <span>{labels.amountToman}</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            alignItems: 'center',
            fontSize: 13,
            color: '#5a6678',
            padding: '11px 14px',
          }}
        >
          <span>
            {labels.ticketPrice}{' '}
            <span style={{ color: '#9aa4b2', fontWeight: 600 }}>({paxLabel})</span>
          </span>
          <span className="font-num" style={{ fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap' }}>
            {localeMoney(priceIrr, locale)}
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            alignItems: 'center',
            fontSize: 13,
            color: '#5a6678',
            padding: '11px 14px',
            borderTop: '1px solid #eef1f5',
          }}
        >
          <span>{labels.taxesFees}</span>
          <span className="font-num" style={{ fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap' }}>
            {locale === 'en' ? 'Included' : locale === 'ar' ? 'مشمول' : 'شامل'}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#eef4fb',
          borderRadius: 13,
          padding: '14px 16px',
          margin: '4px 0 14px',
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 14.5, color: '#0d2640' }}>{labels.total}</span>
        <span className="font-num" style={{ fontWeight: 900, fontSize: 19, color: '#1668c4' }}>
          {localeMoney(priceIrr, locale)} {labels.toman}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 11.5,
          color: '#8a96a6',
          marginBottom: 16,
        }}
      >
        🔒 {labels.securePayment}
      </div>

      <p style={{ fontSize: 12, color: '#9aa4b2', lineHeight: 1.9, margin: '0 0 16px' }}>
        {labels.agreeTermsPrefix}{' '}
        <a href="/terms" style={{ color: '#1668c4', textDecoration: 'none' }}>
          {labels.siteTerms}
        </a>{' '}
        {labels.agreeTermsSuffix}
      </p>

      <button
        type="button"
        data-testid="continue-to-payment"
        onClick={onContinue}
        style={{
          width: '100%',
          height: 56,
          borderRadius: 14,
          background: '#1668c4',
          color: '#fff',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 12px 24px -12px rgba(22,104,196,.55)',
        }}
      >
        {labels.continueToPayment}
      </button>
    </>
  );

  if (isMobile) {
    return (
      <div
        data-testid="checkout-mobile-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 80,
          background: '#fff',
          borderTop: '1px solid #e6eaf0',
          boxShadow: '0 -8px 24px -14px rgba(13,38,102,.3)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: '#9aa4b2' }}>{labels.total}</div>
          <div className="font-num" style={{ fontSize: 15, fontWeight: 900, color: '#1668c4' }}>
            {localeMoney(priceIrr, locale)} {labels.toman}
          </div>
        </div>
        <button
          type="button"
          data-testid="continue-to-payment"
          onClick={onContinue}
          style={{
            flex: 1,
            maxWidth: 220,
            height: 48,
            borderRadius: 12,
            background: '#1668c4',
            color: '#fff',
            border: 'none',
            fontSize: 12.5,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {labels.continueToPayment}
        </button>
      </div>
    );
  }

  return (
    <aside
      style={{
        background: '#fff',
        border: '1px solid #eef1f5',
        borderRadius: 18,
        padding: 22,
        position: 'sticky',
        top: 90,
        alignSelf: 'start',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {content}
    </aside>
  );
}
