import { useEffect, useMemo, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { fetchAirports } from '../../../api/publicSite';
import JalaliDatePicker from '../../JalaliDatePicker';
import type { Airport } from '../../../types/public-site';

const TITLE: Record<StoredLocale, string> = {
  fa: 'ویرایش جستجو',
  en: 'Edit search',
  ar: 'تعديل البحث',
};

const STR: Record<
  StoredLocale,
  {
    tripOneWay: string;
    tripRound: string;
    origin: string;
    dest: string;
    date: string;
    search: string;
    loading: string;
    sameCity: string;
    missing: string;
    selectPlaceholder: string;
  }
> = {
  fa: {
    tripOneWay: 'یک‌طرفه',
    tripRound: 'رفت و برگشت',
    origin: 'مبدأ',
    dest: 'مقصد',
    date: 'تاریخ رفت',
    search: 'جستجو',
    loading: 'در حال بارگذاری…',
    sameCity: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
    missing: 'مبدأ، مقصد و تاریخ را انتخاب کنید.',
    selectPlaceholder: 'انتخاب کنید',
  },
  en: {
    tripOneWay: 'One-way',
    tripRound: 'Round-trip',
    origin: 'From',
    dest: 'To',
    date: 'Departure',
    search: 'Search',
    loading: 'Loading…',
    sameCity: 'Origin and destination cannot be the same.',
    missing: 'Select origin, destination, and date.',
    selectPlaceholder: 'Select',
  },
  ar: {
    tripOneWay: 'ذهاب فقط',
    tripRound: 'ذهاب وإياب',
    origin: 'من',
    dest: 'إلى',
    date: 'تاريخ المغادرة',
    search: 'بحث',
    loading: 'جارٍ التحميل…',
    sameCity: 'لا يمكن أن يتطابق المبدأ والمقصد.',
    missing: 'اختر المبدأ والمقصد والتاريخ.',
    selectPlaceholder: 'اختر',
  },
};

export interface ResultsEditSearchModalProps {
  open: boolean;
  locale: StoredLocale;
  origin: string;
  dest: string;
  date: string;
  onClose: () => void;
  onSubmit: (origin: string, dest: string, date: string) => void;
}

export default function ResultsEditSearchModal({
  open,
  locale,
  origin: initialOrigin,
  dest: initialDest,
  date: initialDate,
  onClose,
  onSubmit,
}: ResultsEditSearchModalProps) {
  const t = STR[locale];
  const [airports, setAirports] = useState<Airport[]>([]);
  const [trip, setTrip] = useState<'oneway' | 'round'>('oneway');
  const [origin, setOrigin] = useState(initialOrigin);
  const [dest, setDest] = useState(initialDest);
  const [dateIso, setDateIso] = useState<string | null>(
    initialDate ? `${initialDate}T12:00:00.000Z` : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrigin(initialOrigin);
    setDest(initialDest);
    setDateIso(initialDate ? `${initialDate}T12:00:00.000Z` : null);
    setTrip('oneway');
    setError(null);
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, [open, initialOrigin, initialDest, initialDate]);

  const cityLabel = useMemo(() => {
    const map = new Map(airports.map((a) => [a.code, a.cityFa]));
    return (code: string) => map.get(code) ?? code;
  }, [airports]);

  if (!open) return null;

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!origin || !dest || !dateIso) {
      setError(t.missing);
      return;
    }
    if (origin === dest) {
      setError(t.sameCity);
      return;
    }
    onSubmit(origin, dest, dateIso.slice(0, 10));
    onClose();
  }

  function swap() {
    setOrigin(dest);
    setDest(origin);
  }

  const tripChip = (active: boolean) => ({
    padding: '7px 12px',
    borderRadius: 22,
    border: `1.5px solid ${active ? '#1668c4' : '#e6eaf0'}`,
    background: active ? '#1668c4' : '#fff',
    color: active ? '#fff' : '#5a6678',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  const fieldBox: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: 50,
    border: '1.5px solid #e2e7ee',
    borderRadius: 11,
    background: '#fafbfd',
    padding: '0 11px',
    fontSize: 13.5,
    fontWeight: 700,
    color: '#16202e',
    fontFamily: 'inherit',
  };

  return (
    <div
      data-testid="edit-search-modal"
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
      onClick={onClose}
    >
      <div
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
          <span style={{ fontSize: 16.5, fontWeight: 800, color: '#0d2640' }}>{TITLE[locale]}</span>
          <button type="button" onClick={onClose} style={{ cursor: 'pointer', color: '#6b7787', fontSize: 22.5, border: 'none', background: 'none' }}>
            ×
          </button>
        </div>
        {airports.length === 0 ? (
          <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#6b7b94' }}>{t.loading}</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '15px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button type="button" style={tripChip(trip === 'oneway')} onClick={() => setTrip('oneway')}>
                {t.tripOneWay}
              </button>
              <button type="button" style={tripChip(trip === 'round')} onClick={() => setTrip('round')}>
                {t.tripRound}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{t.origin}</div>
                <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={fieldBox}>
                  <option value="">{t.selectPlaceholder}</option>
                  {airports.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.cityFa} ({a.code})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={swap}
                aria-label="swap"
                style={{
                  width: 44,
                  height: 44,
                  flex: 'none',
                  marginBottom: 3,
                  borderRadius: '50%',
                  border: '1.5px solid #e2e7ee',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1668c4',
                  fontSize: 17,
                  cursor: 'pointer',
                }}
              >
                ⇄
              </button>
              <label style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, color: '#8a96a6', marginBottom: 7, fontWeight: 600 }}>{t.dest}</div>
                <select value={dest} onChange={(e) => setDest(e.target.value)} style={fieldBox}>
                  <option value="">{t.selectPlaceholder}</option>
                  {airports.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.cityFa} ({a.code})
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ flex: 1, minWidth: 180 }}>
                <JalaliDatePicker label={t.date} value={dateIso} onChange={setDateIso} testId="edit-search-date" />
              </div>
            </div>
            {(origin || dest) && (
              <p style={{ marginTop: 12, fontSize: 12.5, color: '#6b7b94' }} dir="ltr">
                {cityLabel(origin)} → {cityLabel(dest)}
              </p>
            )}
            {error && <p style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: '#d64545' }}>{error}</p>}
            <button
              type="submit"
              style={{
                marginTop: 18,
                width: '100%',
                height: 50,
                borderRadius: 12,
                background: '#1668c4',
                color: '#fff',
                fontSize: 14.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.search}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
