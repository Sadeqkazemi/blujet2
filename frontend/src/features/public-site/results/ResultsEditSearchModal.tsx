import { useEffect, useMemo, useState } from 'react';
import { fetchAirports } from '../../../api/publicSite';
import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';
import { airportCityLabel, airportCityName } from '../../../lib/airport-cities';
import { dayjs, formatJalaliDate, toIsoDateOnly } from '../../../lib/jalali';
import type { Airport } from '../../../types/public-site';
import type { ResultsCopy } from './results-copy';

const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

type Props = {
  open: boolean;
  locale: StoredLocale;
  copy: ResultsCopy;
  origin: string;
  dest: string;
  date: string;
  onClose: () => void;
  onApply: (origin: string, dest: string, date: string) => void;
};

type CalCell = { label: string; iso: string | null; disabled: boolean; selected: boolean };

function airportDisplayLabel(airport: Airport, locale: StoredLocale) {
  return airportCityLabel(airport.code, locale, airport.cityFa);
}

function formatDateDisplay(isoDay: string, locale: StoredLocale) {
  if (locale === 'en') {
    return new Date(`${isoDay}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return formatJalaliDate(`${isoDay}T12:00:00Z`);
}

function buildCalendarCells(viewMonth: ReturnType<typeof dayjs>, selectedIso: string, locale: StoredLocale): CalCell[] {
  const today = dayjs().startOf('day');
  const start = viewMonth.startOf('month');
  const offset = locale === 'en' ? start.day() : (start.day() + 1) % 7;
  const daysInMonth = viewMonth.daysInMonth();
  const cells: CalCell[] = [];

  for (let i = 0; i < offset; i++) {
    cells.push({ label: '', iso: null, disabled: true, selected: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const day = start.add(d - 1, 'day');
    const iso = toIsoDateOnly(day);
    const disabled = day.isBefore(today, 'day');
    cells.push({
      label: locale === 'en' ? String(d) : faDigits(d),
      iso,
      disabled,
      selected: iso === selectedIso,
    });
  }

  return cells;
}

function AirportPicker({
  label,
  value,
  airports,
  locale,
  copy,
  onChange,
}: {
  label: string;
  value: string;
  airports: Airport[];
  locale: StoredLocale;
  copy: ResultsCopy;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = airports.find((a) => a.code === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airports;
    return airports.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.cityFa.includes(query.trim()) ||
        airportCityName(a.code, locale, a.cityFa).toLowerCase().includes(q) ||
        airportDisplayLabel(a, locale).toLowerCase().includes(q),
    );
  }, [airports, query, locale]);

  return (
    <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
      <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{label}</div>
      <button
        type="button"
        data-testid={`edit-search-${label === copy.fromLabel ? 'origin' : 'dest'}`}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 50,
          border: '1.5px solid #e2e7ee',
          borderRadius: 11,
          background: '#fafbfd',
          padding: '0 11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#16202e' }}>
          {selected ? airportDisplayLabel(selected, locale) : '—'}
        </span>
        <span style={{ fontSize: 12, color: '#6b7787' }}>▼</span>
      </button>
      {open && (
        <>
          <div
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 238 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 80,
              right: 0,
              width: 318,
              maxWidth: '88vw',
              background: '#fff',
              border: '1px solid #e6eaf0',
              borderRadius: 14,
              boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)',
              padding: 13,
              zIndex: 240,
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.cityQueryPlaceholder}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 42,
                border: '1.5px solid #e2e7ee',
                borderRadius: 10,
                padding: '0 12px',
                fontSize: 13.5,
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: 9,
              }}
            />
            <div style={{ fontSize: 12.5, color: '#6b7787', fontWeight: 700, margin: '0 4px 6px' }}>
              {copy.citiesWithAirportLabel}
            </div>
            <div style={{ maxHeight: 248, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filtered.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => {
                    onChange(a.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 7px',
                    borderRadius: 9,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    textAlign: 'inherit',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: '#eef4fb',
                      color: '#1668c4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                    }}
                  >
                    ✈
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: '#16202e' }}>
                    {airportCityName(a.code, locale, a.cityFa)}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: 15, textAlign: 'center', fontSize: 13.5, color: '#6b7787' }}>
                  {copy.noCityFoundLabel}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResultsEditSearchModal({
  open,
  locale,
  copy,
  origin,
  dest,
  date,
  onClose,
  onApply,
}: Props) {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [tripType, setTripType] = useState<'oneway' | 'round'>('oneway');
  const [draftOrigin, setDraftOrigin] = useState(origin);
  const [draftDest, setDraftDest] = useState(dest);
  const [draftDate, setDraftDate] = useState(date);
  const [draftReturnDate, setDraftReturnDate] = useState('');
  const [draftPax, setDraftPax] = useState('1');
  const [draftClass, setDraftClass] = useState('ECONOMY');
  const [calOpen, setCalOpen] = useState(false);
  const [calTarget, setCalTarget] = useState<'departure' | 'return'>('departure');
  const [applying, setApplying] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    dayjs(`${date}T12:00:00Z`).calendar(locale === 'en' ? 'gregory' : 'jalali'),
  );

  useEffect(() => {
    if (!open) return;
    setDraftOrigin(origin);
    setDraftDest(dest);
    setDraftDate(date);
    setTripType('oneway');
    setCalOpen(false);
    setApplying(false);
    setViewMonth(dayjs(`${date}T12:00:00Z`).calendar(locale === 'en' ? 'gregory' : 'jalali'));
    fetchAirports().then(setAirports).catch(() => setAirports([]));
  }, [open, origin, dest, date, locale]);

  const weekdays = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_FA;
  const calTitle =
    locale === 'en'
      ? viewMonth.format('MMMM YYYY')
      : `${MONTH_NAMES_FA[viewMonth.month()]} ${faDigits(viewMonth.year())}`;
  const selectedIso = calTarget === 'departure' ? draftDate : draftReturnDate || draftDate;
  const calCells = buildCalendarCells(viewMonth, selectedIso, locale);
  const calTargetLabel = calTarget === 'departure' ? copy.departureDateLabel : copy.returnDateLabel;

  const paxOptions = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((n) => ({
        value: String(n),
        label: locale === 'en' ? String(n) : locale === 'ar' ? String(n) : faDigits(n),
      })),
    [locale],
  );

  const classOptions = useMemo(
    () => [
      { value: 'ECONOMY', label: copy.economyLabel },
      { value: 'BUSINESS', label: locale === 'en' ? 'Business' : locale === 'ar' ? 'رجال الأعمال' : 'بیزنس' },
    ],
    [copy.economyLabel, locale],
  );

  function openCalendar(target: 'departure' | 'return') {
    setCalTarget(target);
    setCalOpen(true);
    const iso = target === 'departure' ? draftDate : draftReturnDate || draftDate;
    setViewMonth(dayjs(`${iso}T12:00:00Z`).calendar(locale === 'en' ? 'gregory' : 'jalali'));
  }

  function handleApply() {
    if (draftOrigin === draftDest || applying) return;
    setApplying(true);
    onApply(draftOrigin, draftDest, draftDate);
  }

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,38,64,.55)',
        zIndex: 220,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 16,
        overflow: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.editSearchLabel}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 18,
          width: 760,
          maxWidth: '100%',
          margin: 'auto',
          boxShadow: '0 30px 70px -20px rgba(0,0,0,.5)',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e6eaf0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16.5, fontWeight: 800, color: '#0d2640' }}>{copy.editSearchLabel}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            style={{ cursor: 'pointer', color: '#6b7787', fontSize: 22.5, lineHeight: 1, background: 'none', border: 'none' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '15px 16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(
              [
                ['oneway', copy.tripOneWay],
                ['round', copy.tripRoundTrip],
              ] as const
            ).map(([key, label]) => {
              const active = tripType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTripType(key)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 22,
                    border: `1.5px solid ${active ? '#1668c4' : '#e2e7ee'}`,
                    background: active ? '#eef4fb' : '#fff',
                    color: active ? '#1668c4' : '#5a6678',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <AirportPicker
              label={copy.fromLabel}
              value={draftOrigin}
              airports={airports}
              locale={locale}
              copy={copy}
              onChange={setDraftOrigin}
            />
            <button
              type="button"
              onClick={() => {
                setDraftOrigin(draftDest);
                setDraftDest(draftOrigin);
              }}
              aria-label={copy.changeSearch}
              style={{
                width: 44,
                height: 44,
                flex: 'none',
                marginBottom: 3,
                borderRadius: '50%',
                border: '1.5px solid #e2e7ee',
                background: '#fff',
                color: '#1668c4',
                fontSize: 17,
                cursor: 'pointer',
              }}
            >
              ⇄
            </button>
            <AirportPicker
              label={copy.toLabel}
              value={draftDest}
              airports={airports}
              locale={locale}
              copy={copy}
              onChange={setDraftDest}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
              <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{copy.departureDateLabel}</div>
              <button
                type="button"
                data-testid="edit-search-date"
                onClick={() => openCalendar('departure')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 50,
                  border: '1.5px solid #e2e7ee',
                  borderRadius: 11,
                  background: '#fafbfd',
                  padding: '0 11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 13.5,
                  color: '#16202e',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span>{formatDateDisplay(draftDate, locale)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a96a6" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M8 3v4M16 3v4M3 10h18" />
                </svg>
              </button>
            </div>

            {tripType === 'round' && (
              <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
                <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{copy.returnDateLabel}</div>
                <button
                  type="button"
                  data-testid="edit-search-return-date"
                  onClick={() => openCalendar('return')}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: 50,
                    border: '1.5px solid #e2e7ee',
                    borderRadius: 11,
                    background: '#fafbfd',
                    padding: '0 11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 13.5,
                    color: '#16202e',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>{draftReturnDate ? formatDateDisplay(draftReturnDate, locale) : '—'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a96a6" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M8 3v4M16 3v4M3 10h18" />
                  </svg>
                </button>
              </div>
            )}

            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{copy.paxCountLabel}</div>
              <select
                value={draftPax}
                onChange={(e) => setDraftPax(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 50,
                  border: '1.5px solid #e2e7ee',
                  borderRadius: 11,
                  background: '#fafbfd',
                  padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  color: '#16202e',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {paxOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{copy.flightClassLabel}</div>
              <select
                value={draftClass}
                onChange={(e) => setDraftClass(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 50,
                  border: '1.5px solid #e2e7ee',
                  borderRadius: 11,
                  background: '#fafbfd',
                  padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  color: '#16202e',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {classOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {calOpen && (
            <div
              data-testid="edit-search-calendar"
              style={{
                marginTop: 12,
                background: '#fff',
                border: '1.5px solid #e2e7ee',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1668c4', marginBottom: 8 }}>{calTargetLabel}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setViewMonth(viewMonth.subtract(1, 'month'))}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: '1.5px solid #e6eaf0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1668c4',
                    cursor: 'pointer',
                    background: '#fff',
                  }}
                >
                  ‹
                </button>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0d2640' }}>{calTitle}</span>
                <button
                  type="button"
                  onClick={() => setViewMonth(viewMonth.add(1, 'month'))}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    border: '1.5px solid #e6eaf0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1668c4',
                    cursor: 'pointer',
                    background: '#fff',
                  }}
                >
                  ›
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 5 }}>
                {weekdays.map((w) => (
                  <span key={w} style={{ textAlign: 'center', fontSize: 12, color: '#6b7787', fontWeight: 700 }}>
                    {w}
                  </span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {calCells.map((c, i) =>
                  c.iso ? (
                    <button
                      key={c.iso}
                      type="button"
                      disabled={c.disabled}
                      onClick={() => {
                        if (calTarget === 'departure') setDraftDate(c.iso!);
                        else setDraftReturnDate(c.iso!);
                        setCalOpen(false);
                      }}
                      style={{
                        height: 34,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: c.selected ? 800 : 600,
                        background: c.selected ? '#1668c4' : 'transparent',
                        color: c.disabled ? '#ccd3dd' : c.selected ? '#fff' : '#16202e',
                        cursor: c.disabled ? 'not-allowed' : 'pointer',
                        border: 'none',
                        fontFamily: 'inherit',
                      }}
                    >
                      {c.label}
                    </button>
                  ) : (
                    <span key={`blank-${i}`} />
                  ),
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={applying || draftOrigin === draftDest}
            onClick={handleApply}
            style={{
              marginTop: 22,
              width: '100%',
              height: 52,
              borderRadius: 12,
              background: '#1668c4',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 14.5,
              fontWeight: 800,
              border: 'none',
              cursor: applying || draftOrigin === draftDest ? 'not-allowed' : 'pointer',
              opacity: applying || draftOrigin === draftDest ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {applying ? (
              <>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    border: '2.5px solid rgba(255,255,255,.35)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin .7s linear infinite',
                    display: 'inline-block',
                  }}
                />
                {copy.updatingLabel}
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4" />
                </svg>
                {copy.searchFlightsLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
