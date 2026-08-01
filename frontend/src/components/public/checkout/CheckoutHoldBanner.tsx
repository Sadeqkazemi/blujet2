import { useEffect, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { formatHoldCountdown } from './checkout-utils';

export interface CheckoutHoldBannerProps {
  holdExpiresAt: string;
  locale: StoredLocale;
  label: string;
  lowTimeLabel: string;
}

export default function CheckoutHoldBanner({
  holdExpiresAt,
  locale,
  label,
  lowTimeLabel,
}: CheckoutHoldBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [holdExpiresAt]);

  const low = secondsLeft <= 120;

  return (
    <div
      data-testid="hold-banner"
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '12px 26px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: low ? '#fdecec' : '#e8f5ee',
          border: `1px solid ${low ? '#f5c6c6' : '#cdeadb'}`,
          color: low ? '#e5484d' : '#1f8a5b',
          borderRadius: 12,
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        <span>⏱</span>
        <span>{low ? lowTimeLabel : label}</span>
        <span className="font-num" dir="ltr">
          {formatHoldCountdown(secondsLeft, locale)}
        </span>
      </div>
    </div>
  );
}
