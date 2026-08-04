import { useEffect, useRef, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { dayjs } from '../../../lib/jalali';
import {
  calendarStrings,
  localeDigits,
  monthName,
  weekdayHeaders,
  weekdayLong,
  type CalendarTrip,
} from './flight-search-calendar-i18n';

export interface FlightSearchDateRangePickerProps {
  locale: StoredLocale;
  trip: CalendarTrip;
  onTripChange: (trip: CalendarTrip) => void;
  depIso: string | null;
  retIso: string | null;
  onDepChange: (iso: string) => void;
  onRetChange: (iso: string | null) => void;
  depLabel: string;
  retLabel: string;
  minDate?: string;
  destSelected: boolean;
  showReturnField: boolean;
  testIdPrefix?: string;
}

interface DayCell {
  iso: string;
  dayNum: number;
  disabled: boolean;
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

function buildMonthGrid(viewMonth: ReturnType<typeof dayjs>, gregorian: boolean, minIso: string | null): DayCell[] {
  const start = gregorian ? viewMonth.startOf('month') : viewMonth.calendar('jalali').startOf('month');
  const offset = (start.day() + 1) % 7;
  const daysInMonth = start.daysInMonth();
  const cells: DayCell[] = [];
  for (let i = 0; i < offset; i++) cells.push({ iso: '', dayNum: 0, disabled: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const day = start.add(d - 1, 'day');
    const iso = day.toDate().toISOString();
    cells.push({
      iso,
      dayNum: d,
      disabled: minIso ? isoDay(iso) < isoDay(minIso) : false,
    });
  }
  return cells;
}

function formatDateDisplay(iso: string | null, locale: StoredLocale, gregorian: boolean): string {
  if (!iso) return '';
  const d = dayjs(iso);
  const formatted = gregorian ? d.format('YYYY/MM/DD') : d.calendar('jalali').format('YYYY/MM/DD');
  return localeDigits(formatted, locale);
}

function formatMonthTitle(viewMonth: ReturnType<typeof dayjs>, locale: StoredLocale, gregorian: boolean): string {
  if (gregorian) {
    return `${monthName(viewMonth.month(), locale, true)} ${localeDigits(viewMonth.year(), locale)}`;
  }
  const j = viewMonth.calendar('jalali');
  return `${monthName(j.month(), locale, false)} ${localeDigits(j.year(), locale)}`;
}

const MOBILE_CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 8px 20px -14px rgba(0,0,0,.4)',
};

export default function FlightSearchDateRangePicker({
  locale,
  trip,
  onTripChange,
  depIso,
  retIso,
  onDepChange,
  onRetChange,
  depLabel,
  retLabel,
  minDate,
  destSelected,
  showReturnField,
  testIdPrefix = 'home',
}: FlightSearchDateRangePickerProps) {
  const isMobile = useIsMobile();
  const t = calendarStrings(locale);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<'dep' | 'ret'>('dep');
  const [gregorian, setGregorian] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => (depIso ? dayjs(depIso) : dayjs()));
  const rootRef = useRef<HTMLDivElement>(null);

  const minIso = minDate ?? new Date().toISOString().slice(0, 10);
  const depDay = depIso ? isoDay(depIso) : null;
  const retDay = retIso ? isoDay(retIso) : null;
  const isRound = trip === 'round';

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function openCal(mode: 'dep' | 'ret') {
    if (!destSelected) return;
    setPicking(mode);
    setOpen(true);
    if (depIso) setViewMonth(dayjs(depIso));
    else if (retIso) setViewMonth(dayjs(retIso));
  }

  function handleDayClick(iso: string) {
    const day = isoDay(iso);
    if (day < isoDay(minIso)) return;

    if (!isRound) {
      onDepChange(iso);
      onRetChange(null);
      setOpen(false);
      return;
    }

    if (picking === 'dep') {
      onDepChange(iso);
      onRetChange(null);
      setPicking('ret');
      return;
    }

    if (depDay && day < depDay) {
      onDepChange(iso);
      onRetChange(null);
      setPicking('ret');
      return;
    }
    onRetChange(iso);
  }

  function confirmCal() {
    if (!isRound || (depIso && retIso)) setOpen(false);
  }

  function toggleOneWay() {
    if (isRound) {
      onTripChange('oneway');
      onRetChange(null);
      setPicking('dep');
    } else {
      onTripChange('round');
    }
  }

  function cellStyle(iso: string, disabled: boolean): React.CSSProperties {
    const day = isoDay(iso);
    const isDep = depDay === day;
    const isRet = retDay === day;
    const inRange = isRound && depDay && retDay && day > depDay && day < retDay;

    if (disabled || !iso) {
      return {
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11.5px',
        color: '#ccd3dd',
        cursor: 'not-allowed',
      };
    }
    if (isDep || isRet) {
      return {
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11.5px',
        fontWeight: 800,
        color: '#fff',
        background: '#1668c4',
        borderRadius: 10,
        cursor: 'pointer',
      };
    }
    if (inRange) {
      return {
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11.5px',
        fontWeight: 600,
        color: '#1668c4',
        background: '#eef4fb',
        borderRadius: 10,
        cursor: 'pointer',
      };
    }
    return {
      height: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11.5px',
      fontWeight: 500,
      color: '#16202e',
      cursor: 'pointer',
      borderRadius: 10,
    };
  }

  const monthCount = isMobile ? 1 : 2;
  const months = Array.from({ length: monthCount }, (_, i) => viewMonth.add(i, 'month'));
  const calBarText =
    picking === 'ret'
      ? `${t.retBar}${retIso ? formatDateDisplay(retIso, locale, gregorian) : t.select}`
      : `${t.depBar}${depIso ? formatDateDisplay(depIso, locale, gregorian) : t.select}`;

  const calPanelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #e6eaf0',
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -12px 44px -14px rgba(13,38,102,.4)',
        padding: '18px 20px calc(18px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }
    : {
        position: 'absolute',
        top: '100%',
        marginTop: 8,
        right: 0,
        width: monthCount === 2 ? 620 : 300,
        maxWidth: '95vw',
        background: '#fff',
        border: '1px solid #e6eaf0',
        borderRadius: 18,
        boxShadow: '0 24px 56px -14px rgba(13,38,102,.34)',
        padding: '18px 20px',
        zIndex: 50,
      };

  const fieldIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );

  return (
    <>
      <div
        ref={rootRef}
        style={{
          flex: '1.1 1 120px',
          minWidth: 0,
          borderRight: isMobile ? 'none' : '1px solid #eef1f5',
          opacity: destSelected ? 1 : 0.45,
          position: 'relative',
          ...(isMobile ? { ...MOBILE_CARD, gridColumn: '1', padding: '6px 0' } : {}),
        }}
      >
        <div
          data-testid={`${testIdPrefix}-date`}
          onClick={() => openCal('dep')}
          style={{ cursor: destSelected ? 'pointer' : 'default', padding: '5px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
            {fieldIcon}
            {depLabel}
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 800, color: depIso ? '#0d2640' : '#aeb6c2' }}>
            {depIso ? formatDateDisplay(depIso, locale, gregorian) : t.placeholder}
          </div>
          {depIso && (
            <div style={{ fontSize: '10.5px', color: '#aeb6c2', marginTop: 1 }}>
              {weekdayLong(new Date(depIso), locale)}
            </div>
          )}
        </div>

        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44, background: isMobile ? 'rgba(13,38,64,.35)' : 'transparent' }} />
            <div style={calPanelStyle} data-testid={`${testIdPrefix}-cal-panel`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-date-today`}
                  onClick={() => {
                    const today = dayjs().toDate().toISOString();
                    if (!isRound) {
                      onDepChange(today);
                      onRetChange(null);
                      setOpen(false);
                    } else if (picking === 'dep') {
                      onDepChange(today);
                      onRetChange(null);
                      setPicking('ret');
                    } else {
                      onRetChange(today);
                    }
                  }}
                  style={{ padding: '7px 15px', border: '1.5px solid #1668c4', borderRadius: 22, color: '#1668c4', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}
                >
                  {t.today}
                </button>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-cal-greg-toggle`}
                  onClick={() => setGregorian((g) => !g)}
                  style={{
                    padding: '7px 15px',
                    border: gregorian ? '1.5px solid #1668c4' : '1.5px solid #e3e9f1',
                    borderRadius: 22,
                    color: gregorian ? '#1668c4' : '#5a6678',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#fff',
                    fontFamily: 'inherit',
                  }}
                >
                  {gregorian ? t.jalali : t.gregorian}
                </button>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-cal-oneway-toggle`}
                  onClick={toggleOneWay}
                  style={{ marginRight: 'auto', marginLeft: locale === 'en' ? 'auto' : undefined, display: 'flex', alignItems: 'center', gap: 6, fontSize: '11.5px', color: '#5a6678', cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit' }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      background: !isRound ? '#1668c4' : 'transparent',
                      border: !isRound ? '1.5px solid #1668c4' : '1.5px solid #ccd3dd',
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                    }}
                  >
                    {!isRound ? '✓' : ''}
                  </span>
                  {t.oneWay}
                </button>
              </div>

              <div style={{ background: '#eef4fb', borderRadius: 12, padding: '11px 15px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0d2640' }}>{isRound ? calBarText : t.pickDep}</span>
                <span style={{ position: 'absolute', [locale === 'en' ? 'right' : 'left']: 18, color: '#1668c4', fontSize: '15.5px' }}>
                  {locale === 'en' ? '→' : '←'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-cal-prev-month`}
                  onClick={() => setViewMonth((m) => m.subtract(1, 'month'))}
                  style={{ flex: 'none', width: 36, height: 36, border: '1.5px solid #e6eaf0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1668c4', fontSize: '14.5px', cursor: 'pointer', marginTop: 2, background: '#fff', fontFamily: 'inherit' }}
                >
                  ›
                </button>
                {months.map((m, mi) => {
                  const cells = buildMonthGrid(m, gregorian, picking === 'ret' && depDay ? depDay : minIso);
                  return (
                    <div key={mi} style={{ flex: 1, minWidth: 0 }}>
                      <div data-testid={mi === 0 ? `${testIdPrefix}-cal-month-label` : undefined} style={{ textAlign: 'center', fontSize: '13.5px', fontWeight: 800, color: '#0d2640', marginBottom: 14 }}>
                        {formatMonthTitle(m, locale, gregorian)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
                        {weekdayHeaders(locale).map((w) => (
                          <span key={w} style={{ textAlign: 'center', fontSize: 10, color: '#9aa4b2', fontWeight: 700 }}>
                            {w}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                        {cells.map((c, i) =>
                          c.dayNum === 0 ? (
                            <span key={`b-${mi}-${i}`} />
                          ) : (
                            <span
                              key={c.iso}
                              data-testid={`${testIdPrefix}-cal-day-${c.dayNum}`}
                              onClick={() => !c.disabled && handleDayClick(c.iso)}
                              style={cellStyle(c.iso, c.disabled)}
                            >
                              {localeDigits(c.dayNum, locale)}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-cal-next-month`}
                  onClick={() => setViewMonth((m) => m.add(1, 'month'))}
                  style={{ flex: 'none', width: 36, height: 36, border: '1.5px solid #e6eaf0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1668c4', fontSize: '14.5px', cursor: 'pointer', marginTop: 2, background: '#fff', fontFamily: 'inherit' }}
                >
                  ‹
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, paddingTop: 11, borderTop: '1px solid #f2f4f7', fontSize: 12, flexWrap: 'wrap' }}>
                <span style={{ color: '#5a6678' }}>
                  {t.depShort}: <b style={{ color: '#0d2640' }}>{depIso ? formatDateDisplay(depIso, locale, gregorian) : t.select}</b>
                </span>
                {isRound && (
                  <span style={{ color: '#5a6678' }}>
                    {t.retShort}: <b style={{ color: '#0d2640' }}>{retIso ? formatDateDisplay(retIso, locale, gregorian) : t.select}</b>
                  </span>
                )}
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-cal-confirm`}
                  onClick={confirmCal}
                  style={{ marginRight: 'auto', marginLeft: locale === 'en' ? 'auto' : undefined, padding: '9px 25px', background: '#1668c4', color: '#fff', borderRadius: 10, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                >
                  {t.confirm}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showReturnField && (
        <div
          style={{
            flex: '1.1 1 120px',
            minWidth: 0,
            borderRight: isMobile ? 'none' : '1px solid #eef1f5',
            opacity: isRound && depIso ? 1 : 0.45,
            pointerEvents: isRound ? 'auto' : 'none',
            ...(isMobile ? { ...MOBILE_CARD, gridColumn: '2', padding: '6px 0' } : {}),
          }}
        >
          <div
            data-testid={`${testIdPrefix}-return-date`}
            onClick={() => isRound && openCal('ret')}
            style={{ cursor: isRound ? 'pointer' : 'default', padding: '5px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
              {fieldIcon}
              {retLabel}
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: retIso ? '#16202e' : '#aeb6c2' }}>
              {retIso ? formatDateDisplay(retIso, locale, gregorian) : t.placeholder}
            </div>
            {retIso && (
              <div style={{ fontSize: '10.5px', color: '#aeb6c2', marginTop: 1 }}>
                {weekdayLong(new Date(retIso), locale)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
