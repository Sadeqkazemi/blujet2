import { useCallback, useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

export const OTP_LEN = 6;

function normalizeDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (x) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)))
    .replace(/\D/g, '');
}

export function OtpCells({
  digits,
  onChange,
  onComplete,
  testIdPrefix = 'otp-cell',
  autoFocus = false,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  onComplete?: () => void;
  testIdPrefix?: string;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const applyDigits = useCallback(
    (startIndex: number, raw: string) => {
      const chars = normalizeDigits(raw).slice(0, OTP_LEN - startIndex);
      if (!chars) return;
      const next = digits.slice();
      for (let i = 0; i < chars.length && startIndex + i < OTP_LEN; i++) {
        next[startIndex + i] = chars[i]!;
      }
      onChange(next);
      const focusIdx = Math.min(startIndex + chars.length, OTP_LEN - 1);
      refs.current[focusIdx]?.focus();
      if (next.every((v) => v !== '')) {
        onComplete?.();
      }
    },
    [digits, onChange, onComplete],
  );

  const setDigit = useCallback(
    (index: number, value: string) => {
      const normalized = normalizeDigits(value);
      if (normalized.length > 1) {
        applyDigits(index, normalized);
        return;
      }
      const d = normalized.slice(-1);
      const next = digits.slice();
      next[index] = d;
      onChange(next);
      if (d && index < OTP_LEN - 1) {
        refs.current[index + 1]?.focus();
      }
      if (next.every((v) => v !== '')) {
        onComplete?.();
      }
    },
    [applyDigits, digits, onChange, onComplete],
  );

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const onPaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    applyDigits(index, e.clipboardData.getData('text'));
  };

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.requestAnimationFrame(() => {
      refs.current[0]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [autoFocus]);

  return (
    <div style={{ display: 'flex', gap: 10, direction: 'ltr', position: 'relative', zIndex: 1 }}>
      {digits.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          data-testid={`${testIdPrefix}-${i}`}
          className="auth-input"
          type="tel"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          dir="ltr"
          value={v}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
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
            touchAction: 'manipulation',
          }}
        />
      ))}
    </div>
  );
}
