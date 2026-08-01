import { useEffect, useMemo, useState } from 'react';
import { fetchAirports } from '../../../api/publicSite';
import JalaliDatePicker from '../../../components/JalaliDatePicker';
import type { StoredLocale } from '../../../hooks/useLocale';
import { formatToman } from '../../../lib/fa-format';
import { formatJalaliDate } from '../../../lib/jalali';
import type { Airport, PriceCalendarDay } from '../../../types/public-site';
import type { ResultsCopy } from './results-copy';

type Props = {
  open: boolean;
  locale: StoredLocale;
  copy: ResultsCopy;
  origin: string;
  dest: string;
  date: string;
  calendarDays: PriceCalendarDay[] | null;
  calendarMinPrice: bigint | null;
  selectedDate: string;
  onClose: () => void;
  onApply: (origin: string, dest: string, date: string) => void;
  onCalendarDayClick: (dayDate: string) => void;
};

export default function ResultsEditSearchModal({
  open,
  locale,
  copy,
  origin,
  dest,
  date,
  calendarDays,
  calendarMinPrice,
  selectedDate,
  onClose,
  onApply,
  onCalendarDayClick,
}: Props) {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [draftOrigin, setDraftOrigin] = useState(origin);
  const [draftDest, setDraftDest] = useState(dest);
  const [draftDate, setDraftDate] = useState(`${date}T12:00:00.000Z`);

  useEffect(() => {
    if (!open) return;
    setDraftOrigin(origin);
    setDraftDest(dest);
    setDraftDate(`${date}T12:00:00.000Z`);
    fetchAirports().then(setAirports).catch(() => setAirports([]));
  }, [open, origin, dest, date]);

  const airportOptions = useMemo(
    () => airports.map((a) => ({ code: a.code, label: `${a.cityFa} (${a.code})` })),
    [airports],
  );

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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{copy.fromLabel}</div>
              <select
                value={draftOrigin}
                onChange={(e) => setDraftOrigin(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 50,
                  border: '1.5px solid #e2e7ee',
                  borderRadius: 11,
                  background: '#fafbfd',
                  padding: '0 11px',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#16202e',
                }}
              >
                {airportOptions.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftOrigin(draftDest);
                setDraftDest(draftOrigin);
              }}
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
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{copy.toLabel}</div>
              <select
                value={draftDest}
                onChange={(e) => setDraftDest(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 50,
                  border: '1.5px solid #e2e7ee',
                  borderRadius: 11,
                  background: '#fafbfd',
                  padding: '0 11px',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#16202e',
                }}
              >
                {airportOptions.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <JalaliDatePicker
              label={copy.departureDateLabel}
              value={draftDate}
              onChange={setDraftDate}
              testId="edit-search-date"
            />
          </div>

          {(calendarDays ?? []).length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid #eef1f5', paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0d2640', marginBottom: 10 }}>{copy.departureDateLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }} data-testid="price-calendar">
                {(calendarDays ?? []).map((c) => {
                  const price = BigInt(c.minPriceIrr);
                  const cheap = calendarMinPrice !== null && price > 0n && price === calendarMinPrice;
                  const sel = c.date === selectedDate;
                  const toman = price > 0n ? Math.round(Number(price) / 10) : 0;
                  return (
                    <button
                      type="button"
                      key={c.date}
                      onClick={() => {
                        onCalendarDayClick(c.date);
                        setDraftDate(`${c.date}T12:00:00.000Z`);
                      }}
                      style={{
                        cursor: 'pointer',
                        border: sel ? '2px solid #1668c4' : '1px solid #eef1f5',
                        borderRadius: 10,
                        background: sel ? '#f2f7fd' : '#fff',
                        padding: '8px 4px',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: sel ? '#1668c4' : '#5a6678' }}>
                        {locale === 'en'
                          ? new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : formatJalaliDate(`${c.date}T12:00:00Z`)}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          color: cheap ? '#1f8a5b' : sel ? '#0d2640' : '#8a96a6',
                          fontFamily: 'Roboto Mono, monospace',
                        }}
                      >
                        {toman > 0 ? formatToman(toman, locale) : '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onApply(draftOrigin, draftDest, draftDate.slice(0, 10))}
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
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {copy.applySearchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
