import { useCallback, useRef, type KeyboardEvent } from 'react';

export const OTP_LEN = 6;

export function OtpCells({
  digits,
  onChange,
  onComplete,
  testIdPrefix = 'otp-cell',
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  onComplete?: () => void;
  testIdPrefix?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = useCallback(
    (index: number, value: string) => {
      const d = value
        .replace(/[۰-۹]/g, (x) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)))
        .replace(/\D/g, '')
        .slice(-1);
      const next = digits.slice();
      next[index] = d;
      onChange(next);
      if (d && index < OTP_LEN - 1) {
        refs.current[index + 1]?.focus();
      }
      if (d && index === OTP_LEN - 1 && next.every((v) => v !== '')) {
        onComplete?.();
      }
    },
    [digits, onChange, onComplete],
  );

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 10, direction: 'ltr' }}>
      {digits.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          data-testid={`${testIdPrefix}-${i}`}
          type="tel"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          dir="ltr"
          value={v}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          style={{
            flex: 1,
            width: '100%',
            height: 60,
            border: `1.5px solid ${v ? '#1668c4' : '#dfe6ef'}`,
            borderRadius: 13,
            background: v ? '#f3f7fc' : '#fafbfd',
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: '#16202e',
            padding: 0,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ))}
    </div>
  );
}
