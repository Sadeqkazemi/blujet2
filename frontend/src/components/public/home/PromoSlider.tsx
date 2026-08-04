import { useState, type ReactNode } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';

interface PromoSliderProps {
  locale: StoredLocale;
  loyaltySlide: ReactNode;
  appSlide: ReactNode;
}

/** design-reference-v2 homepage loyalty + app carousel (desktop). */
export default function PromoSlider({ locale, loyaltySlide, appSlide }: PromoSliderProps) {
  const [slide, setSlide] = useState(0);
  const isRTL = locale !== 'en';

  function go(delta: number) {
    setSlide((s) => (s + delta + 2) % 2);
  }

  return (
    <section style={{ maxWidth: 1180, margin: '48px auto 0', padding: '0 26px' }} data-testid="promo-slider">
      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)' }}>
        <div
          style={{
            display: 'flex',
            direction: 'ltr',
            transition: 'transform .45s cubic-bezier(.4,0,.2,1)',
            transform: `translateX(${slide === 0 ? '0%' : '-100%'})`,
          }}
        >
          <div style={{ flex: '0 0 100%', display: 'flex' }}>{loyaltySlide}</div>
          <div style={{ flex: '0 0 100%', display: 'flex' }}>{appSlide}</div>
        </div>
        <button
          type="button"
          data-testid="promo-slider-next"
          onClick={() => go(isRTL ? -1 : 1)}
          aria-label="Next slide"
          style={{
            position: 'absolute',
            top: '50%',
            right: 16,
            transform: 'translateY(-50%)',
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#ffffffe6',
            boxShadow: '0 4px 12px rgba(13,38,102,.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0d2640',
            fontSize: 18,
            cursor: 'pointer',
            zIndex: 3,
            border: 'none',
          }}
        >
          ‹
        </button>
        <button
          type="button"
          data-testid="promo-slider-prev"
          onClick={() => go(isRTL ? 1 : -1)}
          aria-label="Previous slide"
          style={{
            position: 'absolute',
            top: '50%',
            left: 16,
            transform: 'translateY(-50%)',
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#ffffffe6',
            boxShadow: '0 4px 12px rgba(13,38,102,.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0d2640',
            fontSize: 18,
            cursor: 'pointer',
            zIndex: 3,
            border: 'none',
          }}
        >
          ›
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 16 }}>
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            data-testid={`promo-slider-dot-${i}`}
            onClick={() => setSlide(i)}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: slide === i ? 22 : 8,
              height: 8,
              borderRadius: 5,
              background: slide === i ? '#1668c4' : '#d5dde7',
              cursor: 'pointer',
              border: 'none',
              transition: 'all .3s',
            }}
          />
        ))}
      </div>
    </section>
  );
}
