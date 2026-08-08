import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchPriceCalendar } from "../api/publicSite";
import type { StoredLocale } from "../hooks/useLocale";
import { dayjs, isoDateAtNoon, toIsoDateOnly } from "../lib/jalali";
import { faDigits } from "../lib/fa-format";
import {
  formatPriceCalendarPrice,
  isPriceCalendarEmpty,
  priceCalendarCopy,
} from "../lib/price-calendar";

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

interface Cell {
  date: number;
  iso: string;
  disabled: boolean;
}

function buildMonthCells(
  viewMonth: ReturnType<typeof dayjs>,
  minIso: string | null,
): (Cell | null)[] {
  const start = viewMonth.startOf("month");
  const offset = (start.day() + 1) % 7;
  const daysInMonth = viewMonth.daysInMonth();
  const cells: (Cell | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    const day = start.add(d - 1, "day");
    const iso = toIsoDateOnly(day);
    cells.push({
      date: d,
      iso,
      disabled: minIso ? iso < minIso.slice(0, 10) : false,
    });
  }
  return cells;
}

interface JalaliDatePickerProps {
  label: string;
  value: string | null;
  onChange: (iso: string) => void;
  minDate?: string;
  testId?: string;
  placeholder?: string;
  subLabel?: string;
  isRTL?: boolean;
  theme?: "light" | "dark";
  /** Compact single-line trigger (toolbar chips in dark panels). */
  compact?: boolean;
  /** Full-height single-line trigger for standard form fields. */
  singleLine?: boolean;
  /** Mobile flight-search mode: load real fares into the month grid. */
  priceCalendar?: {
    origin: string;
    dest: string;
    locale: StoredLocale;
  };
}

/** Jalali (شمسی) date picker — CLAUDE.md requires Jalali everywhere users pick dates. */
export default function JalaliDatePicker({
  label,
  value,
  onChange,
  minDate,
  testId,
  placeholder = "انتخاب کنید",
  subLabel,
  isRTL = true,
  theme = "light",
  compact = false,
  singleLine = false,
  priceCalendar,
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftIso, setDraftIso] = useState<string | null>(
    value ? value.slice(0, 10) : null,
  );
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    value ? dayjs(value).calendar("jalali") : dayjs().calendar("jalali"),
  );
  const [popupPos, setPopupPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  }>({
    left: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const priceCacheRef = useRef(new Map<string, Record<string, string>>());
  const minIso = minDate ?? null;
  const cells = buildMonthCells(viewMonth, minIso);
  const monthKey = `${viewMonth.year()}-${viewMonth.month()}`;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current || !popupRef.current) return;
    if (priceCalendar) {
      setPopupPos({ bottom: 12, left: 12, top: undefined });
      return;
    }
    const trigger = rootRef.current.getBoundingClientRect();
    const popup = popupRef.current.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = isRTL ? trigger.right - popup.width : trigger.left;
    left = Math.max(margin, Math.min(left, vw - popup.width - margin));
    const spaceBelow = vh - trigger.bottom;
    const placeAbove =
      spaceBelow < popup.height + margin && trigger.top > spaceBelow;
    setPopupPos(
      placeAbove
        ? { bottom: vh - trigger.top + margin, left, top: undefined }
        : { top: trigger.bottom + margin, left, bottom: undefined },
    );
  }, [open, isRTL, viewMonth, priceCalendar]);

  useEffect(() => {
    if (!open || !priceCalendar) return;

    const visibleCells = buildMonthCells(viewMonth, minDate ?? null).filter(
      (cell): cell is Cell => cell !== null,
    );
    const cacheKey = `${priceCalendar.origin}-${priceCalendar.dest}-${monthKey}`;
    const cached = priceCacheRef.current.get(cacheKey);
    if (cached) {
      setPrices(cached);
      setPricesLoading(false);
      setPricesError(false);
      return;
    }

    // The endpoint returns ±3 days. One center per seven-day chunk covers
    // the visible Jalali month without inventing any unavailable fare.
    const centers: string[] = [];
    for (let index = 0; index < visibleCells.length; index += 7) {
      const chunk = visibleCells.slice(index, index + 7);
      centers.push(chunk[Math.floor(chunk.length / 2)].iso);
    }

    let cancelled = false;
    setPricesLoading(true);
    setPricesError(false);
    Promise.all(
      centers.map((center) =>
        fetchPriceCalendar(priceCalendar.origin, priceCalendar.dest, center),
      ),
    )
      .then((responses) => {
        if (cancelled) return;
        const visibleDates = new Set(visibleCells.map((cell) => cell.iso));
        const next: Record<string, string> = {};
        responses.flat().forEach((day) => {
          if (visibleDates.has(day.date)) next[day.date] = day.minPriceIrr;
        });
        priceCacheRef.current.set(cacheKey, next);
        setPrices(next);
        setPricesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPrices({});
        setPricesLoading(false);
        setPricesError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, monthKey, minDate, priceCalendar, viewMonth]);

  const selectedIsoDay = priceCalendar
    ? draftIso
    : value
      ? value.slice(0, 10)
      : null;

  const displayValue = value
    ? faDigits(dayjs(value).calendar("jalali").format("YYYY/MM/DD"))
    : placeholder;

  const weekdaySub =
    subLabel ??
    (value
      ? faDigits(dayjs(value).calendar("jalali").format("dddd")) +
        " " +
        faDigits(String(dayjs(value).calendar("jalali").year()))
      : label);

  const dark = theme === "dark";
  const valueColor = dark
    ? value
      ? "#e7ecf3"
      : "#9fb0c7"
    : value
      ? "#0d2640"
      : "#aeb6c2";
  const mutedColor = dark ? "#6b7b94" : "#9aa4b2";
  const popupBg = dark ? "#141d2e" : "#fff";
  const popupBorder = dark ? "#2a3550" : "#e6eaf0";

  return (
    <div ref={rootRef} style={{ position: "relative", height: "100%" }}>
      <div
        data-testid={testId}
        onClick={() => {
          setDraftIso(value ? value.slice(0, 10) : null);
          if (value) setViewMonth(dayjs(value).calendar("jalali"));
          setOpen((v) => !v);
        }}
        style={{
          cursor: "pointer",
          padding: compact ? "0 10px" : singleLine ? "0 15px" : "5px 13px",
          display: "flex",
          flexDirection: compact || singleLine ? "row" : "column",
          alignItems: compact || singleLine ? "center" : undefined,
          justifyContent: singleLine ? "space-between" : "center",
          gap: compact ? 6 : undefined,
          height: singleLine ? "100%" : compact ? 38 : "100%",
          boxSizing: "border-box",
        }}
      >
        {singleLine ? (
          <>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: valueColor,
                whiteSpace: "nowrap",
              }}
            >
              {value ? displayValue : placeholder}
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke={mutedColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </>
        ) : compact ? (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={mutedColor}
              strokeWidth="1.9"
            >
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: valueColor,
                whiteSpace: "nowrap",
              }}
            >
              {value ? displayValue : placeholder}
            </span>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: mutedColor,
                fontWeight: 600,
                marginBottom: 3,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
              {label}
            </div>
            <div
              style={{ fontSize: "13.5px", fontWeight: 800, color: valueColor }}
            >
              {displayValue}
            </div>
            <div
              style={{ fontSize: "10.5px", color: mutedColor, marginTop: 1 }}
            >
              {weekdaySub}
            </div>
          </>
        )}
      </div>

      {open && (
        <div
          ref={popupRef}
          data-testid={testId ? `${testId}-popup` : undefined}
          style={{
            position: "fixed",
            top: popupPos.top,
            bottom: popupPos.bottom,
            left: popupPos.left,
            width: priceCalendar ? "calc(100vw - 24px)" : 300,
            maxWidth: priceCalendar ? 840 : "calc(100vw - 16px)",
            maxHeight: priceCalendar ? "calc(100vh - 24px)" : undefined,
            overflowY: priceCalendar ? "auto" : undefined,
            background: popupBg,
            border: `1px solid ${popupBorder}`,
            borderRadius: 18,
            boxShadow: dark
              ? "0 24px 60px -16px rgba(0,0,0,.6)"
              : "0 24px 56px -14px rgba(13,38,102,.34)",
            padding: priceCalendar ? "18px 16px 14px" : "18px 20px",
            zIndex: 200,
            color: dark ? "#e7ecf3" : undefined,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {priceCalendar && (
              <span
                style={{
                  marginInlineStart: "auto",
                  padding: "7px 15px",
                  border: `1.5px solid ${popupBorder}`,
                  borderRadius: 22,
                  color: mutedColor,
                  fontSize: "11.5px",
                  fontWeight: 700,
                }}
              >
                {priceCalendar.locale === "en" ? "Gregorian" : priceCalendar.locale === "ar" ? "ميلادي" : "تقویم میلادی"}
              </span>
            )}
            <span
              data-testid={testId ? `${testId}-today` : undefined}
              onClick={() => {
                const today = dayjs().calendar("jalali");
                const iso = toIsoDateOnly(today);
                if (minIso && iso < minIso.slice(0, 10)) return;
                setViewMonth(today);
                if (priceCalendar) {
                  setDraftIso(iso);
                } else {
                  onChange(isoDateAtNoon(iso));
                  setOpen(false);
                }
              }}
              style={{
                padding: "7px 15px",
                border: "1.5px solid #1668c4",
                borderRadius: 22,
                color: "#1668c4",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              تاریخ امروز
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span
              onClick={() => setViewMonth(viewMonth.subtract(1, "month"))}
              style={{
                width: 36,
                height: 36,
                border: `1.5px solid ${dark ? "#2a3550" : "#e6eaf0"}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1668c4",
                fontSize: "14.5px",
                cursor: "pointer",
              }}
            >
              ›
            </span>
            <div
              data-testid={testId ? `${testId}-month-label` : undefined}
              style={{
                textAlign: "center",
                fontSize: "13.5px",
                fontWeight: 800,
                color: dark ? "#e7ecf3" : "#0d2640",
              }}
            >
              {MONTH_NAMES[viewMonth.month()]} {faDigits(viewMonth.year())}
            </div>
            <span
              data-testid={testId ? `${testId}-next-month` : undefined}
              onClick={() => setViewMonth(viewMonth.add(1, "month"))}
              style={{
                width: 36,
                height: 36,
                border: `1.5px solid ${dark ? "#2a3550" : "#e6eaf0"}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1668c4",
                fontSize: "14.5px",
                cursor: "pointer",
              }}
            >
              ‹
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 2,
              marginBottom: 6,
            }}
          >
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: dark ? "#6b7b94" : "#9aa4b2",
                  fontWeight: 700,
                }}
              >
                {w}
              </span>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 2,
            }}
          >
            {cells.map((c, i) => {
              if (!c) return <span key={`blank-${i}`} />;
              const isSelected = selectedIsoDay === c.iso;
              const price = prices[c.iso];
              const hasPrice = price != null && !isPriceCalendarEmpty(price);
              return (
                <span
                  key={c.iso}
                  data-testid={testId ? `${testId}-day-${c.date}` : undefined}
                  onClick={() => {
                    if (c.disabled) return;
                    if (priceCalendar) {
                      setDraftIso(c.iso);
                    } else {
                      onChange(isoDateAtNoon(c.iso));
                      setOpen(false);
                    }
                  }}
                  style={{
                    minHeight: priceCalendar ? 58 : 36,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11.5px",
                    fontWeight: isSelected ? 800 : 500,
                    color: c.disabled
                      ? dark
                        ? "#3a4558"
                        : "#ccd3dd"
                      : isSelected
                        ? "#fff"
                        : dark
                          ? "#e7ecf3"
                          : "#16202e",
                    background: isSelected
                      ? "#3f6fc6"
                      : priceCalendar
                        ? dark
                          ? "#172236"
                          : "#fff"
                        : "transparent",
                    border: priceCalendar
                      ? `1px solid ${isSelected ? "#3f6fc6" : popupBorder}`
                      : undefined,
                    borderRadius: 10,
                    cursor: c.disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {faDigits(c.date)}
                  {priceCalendar && hasPrice && (
                    <small
                      data-testid={testId ? `${testId}-price-${c.iso}` : undefined}
                      title={formatPriceCalendarPrice(
                        price,
                        priceCalendar.locale,
                        priceCalendarCopy(priceCalendar.locale).emptyDay,
                      )}
                      style={{
                        marginTop: 3,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: 8,
                        lineHeight: 1.2,
                        color: isSelected ? "#fff" : "#1f8a5b",
                        direction: "ltr",
                      }}
                    >
                      {formatPriceCalendarPrice(
                        price,
                        priceCalendar.locale,
                        priceCalendarCopy(priceCalendar.locale).emptyDay,
                      )}
                    </small>
                  )}
                </span>
              );
            })}
          </div>
          {priceCalendar && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderTop: `1px solid ${popupBorder}`,
                marginTop: 14,
                paddingTop: 12,
              }}
            >
              <span style={{ color: pricesError ? "#c2410c" : mutedColor, fontSize: 11 }}>
                {pricesLoading
                  ? priceCalendarCopy(priceCalendar.locale).loading
                  : pricesError
                    ? priceCalendarCopy(priceCalendar.locale).error
                    : draftIso
                      ? faDigits(dayjs(isoDateAtNoon(draftIso)).calendar("jalali").format("YYYY/MM/DD"))
                      : ""}
              </span>
              <button
                type="button"
                data-testid={testId ? `${testId}-confirm` : undefined}
                disabled={!draftIso}
                onClick={() => {
                  if (!draftIso) return;
                  onChange(isoDateAtNoon(draftIso));
                  setOpen(false);
                }}
                style={{
                  border: 0,
                  borderRadius: 10,
                  background: draftIso ? "#3f6fc6" : "#ccd3dd",
                  color: "#fff",
                  padding: "10px 24px",
                  fontFamily: "inherit",
                  fontWeight: 800,
                  cursor: draftIso ? "pointer" : "not-allowed",
                }}
              >
                {priceCalendar.locale === "en" ? "Confirm" : priceCalendar.locale === "ar" ? "تأكيد" : "تأیید"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
