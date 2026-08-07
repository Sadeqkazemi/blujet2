import { useRef, type ChangeEvent, type ClipboardEvent } from "react";
import { faDigits, latinDigits, parseTomanToRial } from "../lib/fa-format";

const inputClass =
  "w-full box-border h-11 rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3 text-[13px] text-[#e7ecf3] outline-none";

export interface MoneyInputProps {
  id?: string;
  label?: string;
  valueToman: string;
  onChangeToman: (tomanDigitsGrouped: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  testId?: string;
}

/** Count Latin digits left of caret in a display string (fa/latin + separators). */
function digitCountBefore(value: string, caret: number): number {
  let count = 0;
  const limit = Math.min(caret, value.length);
  for (let i = 0; i < limit; i++) {
    if (/\d|[۰-۹]|[٠-٩]/.test(value[i]!)) count += 1;
  }
  return count;
}

function caretFromDigitCount(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d|[۰-۹]|[٠-٩]/.test(formatted[i]!)) {
      seen += 1;
      if (seen >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

/** Format raw user input as Persian-digit تومان with ٬ separators (no float math). */
export function formatTomanGrouped(raw: string): string {
  const digits = latinDigits(raw).replace(/[^\d]/g, "");
  if (!digits) return "";
  // Avoid Number() for grouping: manual thousands insert keeps integer string path.
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return faDigits(withSep);
}

export function tomanDigitsOnly(grouped: string): string {
  return latinDigits(grouped).replace(/[^\d]/g, "");
}

/**
 * Reusable تومان money field for staff panels.
 * Display uses thousands separators; API conversion uses `parseTomanToRial` only.
 */
export default function MoneyInput({
  id,
  label,
  valueToman,
  onChangeToman,
  placeholder = "۰",
  disabled,
  className,
  "aria-label": ariaLabel,
  testId,
}: MoneyInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  function applyRaw(raw: string, caretDigits: number) {
    const next = formatTomanGrouped(raw);
    onChangeToman(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = caretFromDigitCount(next, caretDigits);
      el.setSelectionRange(pos, pos);
    });
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = digitCountBefore(el.value, caret);
    applyRaw(el.value, digitsBefore);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const merged = el.value.slice(0, start) + text + el.value.slice(end);
    const digitsBefore = digitCountBefore(merged, start + text.length);
    applyRaw(merged, digitsBefore);
  }

  return (
    <div className={className}>
      {label ? (
        <label
          className="mb-[7px] block text-[11.5px] text-[#9fb0c7]"
          htmlFor={id}
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          data-testid={testId}
          dir="ltr"
          inputMode="numeric"
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          placeholder={placeholder}
          value={valueToman}
          onChange={onChange}
          onPaste={onPaste}
          className={`${inputClass} pe-14 text-left font-num`}
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#6b7b94]">
          تومان
        </span>
      </div>
    </div>
  );
}

/** Convert MoneyInput display value to IRR via the shared utility (no float). */
export function moneyInputToRial(valueToman: string): number | null {
  return parseTomanToRial(tomanDigitsOnly(valueToman));
}
