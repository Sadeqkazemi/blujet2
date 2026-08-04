import { useCallback, useEffect, useRef, type ClipboardEvent, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react';

export const OTP_LEN = 6;

function normalizeDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (x) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)))
    .replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
    .replace(/\D/g, '');
}

export function isOtpComplete(digits: string[]): boolean {
  return digits.length === OTP_LEN && digits.every((d) => d.length === 1);
}

export function OtpCells({
  digits,
  onChange,
  onComplete,
  testIdPrefix = 'otp-cell',
  autoFocus = false,
}: {
  digits: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
  onComplete?: (code: string) => void;
  testIdPrefix?: string;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const autofillRef = useRef<HTMLInputElement | null>(null);

  const applyDigits = useCallback(
    (startIndex: number, raw: string) => {
      const chars = normalizeDigits(raw).slice(0, OTP_LEN - startIndex);
      if (!chars) return;
      onChange((prev) => {
        const next = prev.slice();
        for (let i = 0; i < chars.length && startIndex + i < OTP_LEN; i++) {
          next[startIndex + i] = chars[i]!;
        }
        if (next.every((v) => v !== '')) {
          queueMicrotask(() => onComplete?.(next.join('')));
        }
        return next;
      });
      const focusIdx = Math.min(startIndex + chars.length, OTP_LEN - 1);
      refs.current[focusIdx]?.focus();
    },
    [onChange, onComplete],
  );

  const setDigit = useCallback(
    (index: number, value: string) => {
      const normalized = normalizeDigits(value);
      if (normalized.length > 1) {
        applyDigits(index, normalized);
        return;
      }
      const d = normalized.slice(-1);
      onChange((prev) => {
        const next = prev.slice();
        next[index] = d;
        if (next.every((v) => v !== '')) {
          queueMicrotask(() => onComplete?.(next.join('')));
        }
        return next;
      });
      if (d && index < OTP_LEN - 1) {
        refs.current[index + 1]?.focus();
      }
    },
    [applyDigits, onChange, onComplete],
  );

  const onAutofillInput = (e: FormEvent<HTMLInputElement>) => {
    applyDigits(0, e.currentTarget.value);
  };

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
    <div style={{ position: 'relative' }}>
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
        onInput={onAutofillInput}
        style={{
          position: 'absolute',
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          border: 'none',
          padding: 0,
        }}
      />
      <div
        style={{ display: 'flex', gap: 10, direction: 'ltr', position: 'relative', zIndex: 1 }}
        onClick={() => {
          const emptyIdx = digits.findIndex((d) => d === '');
          refs.current[emptyIdx >= 0 ? emptyIdx : OTP_LEN - 1]?.focus({ preventScroll: true });
        }}
      >
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
            onInput={(e) => setDigit(i, e.currentTarget.value)}
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
    </div>
  );
}
