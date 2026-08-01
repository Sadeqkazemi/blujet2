import { useEffect, useState } from 'react';
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
    origin: string;
    dest: string;
    date: string;
    search: string;
    loading: string;
    sameCity: string;
    missing: string;
  }
> = {
  fa: {
    origin: 'مبدأ',
    dest: 'مقصد',
    date: 'تاریخ رفت',
    search: 'جستجو',
    loading: 'در حال بارگذاری…',
    sameCity: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
    missing: 'مبدأ، مقصد و تاریخ را انتخاب کنید.',
  },
  en: {
    origin: 'From',
    dest: 'To',
    date: 'Departure',
    search: 'Search',
    loading: 'Loading…',
    sameCity: 'Origin and destination cannot be the same.',
    missing: 'Select origin, destination, and date.',
  },
  ar: {
    origin: 'من',
    dest: 'إلى',
    date: 'تاريخ المغادرة',
    search: 'بحث',
    loading: 'جارٍ التحميل…',
    sameCity: 'لا يمكن أن يتطابق المبدأ والمقصد.',
    missing: 'اختر المبدأ والمقصد والتاريخ.',
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
    setError(null);
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, [open, initialOrigin, initialDest, initialDate]);

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

  return (
    <div
      data-testid="edit-search-modal"
      className="fixed inset-0 z-[180] flex items-end justify-center bg-[#0d2640]/55 p-0 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]"
      >
        <div className="flex items-center justify-between border-b border-[#eef1f5] px-4 py-3.5">
          <h2 className="text-base font-black text-[#0d2640]">{TITLE[locale]}</h2>
          <button type="button" onClick={onClose} className="text-xl text-[#6b7787]">
            ×
          </button>
        </div>
        {airports.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6b7b94]">{t.loading}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#5a6678]">{t.origin}</span>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#e6eaf0] px-3 text-sm"
              >
                <option value="">—</option>
                {airports.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.cityFa} ({a.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#5a6678]">{t.dest}</span>
              <select
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#e6eaf0] px-3 text-sm"
              >
                <option value="">—</option>
                {airports.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.cityFa} ({a.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[#5a6678]">{t.date}</span>
              <JalaliDatePicker
                label={t.date}
                value={dateIso}
                onChange={setDateIso}
                testId="edit-search-date"
              />
            </label>
            {error && <p className="text-xs font-semibold text-[#d64545]">{error}</p>}
            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#1668c4] text-sm font-bold text-white"
            >
              {t.search}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
