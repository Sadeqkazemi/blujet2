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
  const autofillRef = useRef<HTMLInputElement | null>(null);

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
    refs.current[0]?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Captures iOS/Android SMS autofill (one-time-code) into all cells at once. */}
      <input
        ref={autofillRef}
        data-testid={`${testIdPrefix}-autofill`}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        tabIndex={-1}
        aria-hidden
        value={digits.join('')}
        onChange={(e) => applyDigits(0, e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 1,
          height: 1,
          padding: 0,
          border: 'none',
          pointerEvents: 'none',
        }}
      />
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
            autoComplete="off"
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
            }}
          />
        ))}
      </div>
    </div>
  );
}
