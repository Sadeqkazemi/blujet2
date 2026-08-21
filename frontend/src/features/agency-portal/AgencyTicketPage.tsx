import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import { fetchAirports } from '../../api/publicSite';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { airportCityLabel, airportCityName, FALLBACK_AIRPORTS } from '../../lib/airport-cities';
import { localeDigits } from '../../lib/locale-format';
import type { Airport } from '../../types/public-site';

type TripType = 'one' | 'round';

const COPY: Record<StoredLocale, {
  one: string;
  round: string;
  origin: string;
  destination: string;
  chooseOrigin: string;
  chooseDestination: string;
  departure: string;
  returnDate: string;
  chooseDate: string;
  passengers: string;
  passenger: string;
  search: string;
  loadError: string;
  missing: string;
  sameCity: string;
  invalidReturn: string;
}> = {
  fa: {
    one: 'یک‌طرفه', round: 'رفت و برگشت', origin: 'مبدا', destination: 'مقصد',
    chooseOrigin: 'انتخاب مبدا', chooseDestination: 'انتخاب مقصد', departure: 'تاریخ رفت',
    returnDate: 'تاریخ برگشت', chooseDate: 'انتخاب تاریخ', passengers: 'مسافران',
    passenger: 'مسافر', search: 'جستجوی پرواز', loadError: 'دریافت فهرست فرودگاه‌ها با خطا روبه‌رو شد.',
    missing: 'مبدا، مقصد و تاریخ رفت را کامل کنید.', sameCity: 'مبدا و مقصد نمی‌توانند یکسان باشند.',
    invalidReturn: 'تاریخ برگشت باید پس از تاریخ رفت باشد.',
  },
  en: {
    one: 'One-way', round: 'Round-trip', origin: 'From', destination: 'To',
    chooseOrigin: 'Choose origin', chooseDestination: 'Choose destination', departure: 'Departure date',
    returnDate: 'Return date', chooseDate: 'Choose date', passengers: 'Passengers',
    passenger: 'passenger', search: 'Search flights', loadError: 'Unable to load the airport list.',
    missing: 'Complete origin, destination, and departure date.', sameCity: 'Origin and destination must differ.',
    invalidReturn: 'Return date must be after departure.',
  },
  ar: {
    one: 'ذهاب فقط', round: 'ذهاب وعودة', origin: 'من', destination: 'إلى',
    chooseOrigin: 'اختر نقطة الانطلاق', chooseDestination: 'اختر الوجهة', departure: 'تاريخ المغادرة',
    returnDate: 'تاريخ العودة', chooseDate: 'اختر التاريخ', passengers: 'المسافرون',
    passenger: 'مسافر', search: 'البحث عن رحلات', loadError: 'تعذر تحميل قائمة المطارات.',
    missing: 'أكمل نقطة الانطلاق والوجهة وتاريخ المغادرة.', sameCity: 'يجب أن تختلف نقطة الانطلاق عن الوجهة.',
    invalidReturn: 'يجب أن يكون تاريخ العودة بعد المغادرة.',
  },
};

export default function AgencyTicketPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const navigate = useNavigate();
  const isRtl = locale !== 'en';
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [tripType, setTripType] = useState<TripType>('one');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState<string | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAirports()
      .then((rows) => {
        setAirports(rows);
        setLoadError(false);
      })
      .catch(() => {
        setAirports(FALLBACK_AIRPORTS);
        setLoadError(true);
      });
  }, []);

  const options = useMemo(
    () => [...airports].sort((a, b) => airportCityName(a.code, locale, a.cityFa).localeCompare(airportCityName(b.code, locale, b.cityFa), locale)),
    [airports, locale],
  );

  function submit() {
    if (!origin || !destination || !departureDate) {
      setError(t.missing);
      return;
    }
    if (origin === destination) {
      setError(t.sameCity);
      return;
    }
    if (tripType === 'round' && (!returnDate || returnDate.slice(0, 10) <= departureDate.slice(0, 10))) {
      setError(t.invalidReturn);
      return;
    }
    const query = new URLSearchParams({
      origin,
      dest: destination,
      date: departureDate.slice(0, 10),
      adults: String(passengers),
      children: '0',
      infants: '0',
      cabin: 'ECONOMY',
    });
    if (tripType === 'round' && returnDate) query.set('returnDate', returnDate.slice(0, 10));
    navigate(`/results?${query.toString()}`);
  }

  const selectClass = 'h-[76px] w-full appearance-none rounded-xl border border-[#e5eaf1] bg-white px-5 pt-6 text-sm font-extrabold text-[#0d2640] outline-none transition focus:border-[#1668c4]';

  return (
    <div data-testid="agency-ticket-page" className="space-y-5">
      <div className="flex h-14 items-center rounded-2xl border border-[#edf0f5] bg-white p-1.5">
        {(['one', 'round'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            data-testid={`agency-trip-${kind}`}
            onClick={() => {
              setTripType(kind);
              if (kind === 'one') setReturnDate(null);
            }}
            className={`h-full flex-1 rounded-xl text-sm font-black transition ${tripType === kind ? 'bg-[#1668c4] text-white shadow-sm' : 'text-[#aab4c1]'}`}
          >
            {kind === 'one' ? t.one : t.round}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#edf0f5] bg-white p-5">
        {(loadError || error) && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {error ?? t.loadError}
          </p>
        )}
        <div className={`grid gap-3 ${tripType === 'round' ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          <label className="relative">
            <span className="pointer-events-none absolute top-3 z-10 px-5 text-[11px] font-bold text-[#8a96a6]">⌖ {t.origin}</span>
            <select data-testid="agency-ticket-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className={selectClass}>
              <option value="">{t.chooseOrigin}</option>
              {options.map((airport) => <option key={airport.code} value={airport.code}>{airportCityLabel(airport.code, locale, airportCityName(airport.code, locale, airport.cityFa))}</option>)}
            </select>
          </label>
          <label className="relative">
            <span className="pointer-events-none absolute top-3 z-10 px-5 text-[11px] font-bold text-[#8a96a6]">⌖ {t.destination}</span>
            <select data-testid="agency-ticket-destination" value={destination} onChange={(e) => setDestination(e.target.value)} className={selectClass}>
              <option value="">{t.chooseDestination}</option>
              {options.filter((airport) => airport.code !== origin).map((airport) => <option key={airport.code} value={airport.code}>{airportCityLabel(airport.code, locale, airportCityName(airport.code, locale, airport.cityFa))}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-[#e5eaf1] bg-white px-2">
            <JalaliDatePicker label={t.departure} value={departureDate} onChange={setDepartureDate} minDate={new Date().toISOString().slice(0, 10)} placeholder={t.chooseDate} singleLine locale={locale} isRTL={isRtl} testId="agency-ticket-date" />
          </div>
          {tripType === 'round' && (
            <div className="rounded-xl border border-[#e5eaf1] bg-white px-2">
              <JalaliDatePicker label={t.returnDate} value={returnDate} onChange={setReturnDate} minDate={departureDate ?? new Date().toISOString().slice(0, 10)} placeholder={t.chooseDate} singleLine locale={locale} isRTL={isRtl} testId="agency-ticket-return-date" />
            </div>
          )}
          <label className="relative">
            <span className="pointer-events-none absolute top-3 z-10 px-5 text-[11px] font-bold text-[#8a96a6]">♙ {t.passengers}</span>
            <select data-testid="agency-ticket-passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className={selectClass}>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{localeDigits(count, locale)} {t.passenger}</option>)}
            </select>
          </label>
        </div>
        <button type="button" data-testid="agency-ticket-search" onClick={submit} className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#1668c4] text-sm font-black text-white transition hover:brightness-105">
          <span aria-hidden>⌕</span> {t.search}
        </button>
      </div>
    </div>
  );
}
