import { useMemo, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';
import JalaliDatePicker from '../../JalaliDatePicker';
import type { Airport } from '../../../types/public-site';
import AirportCityPicker from './AirportCityPicker';
import PassengerCabinPicker, { type PassengerCabinState } from './PassengerCabinPicker';
import { filterAirportsByService } from './airport-utils';
import { buildResultsUrl, type SearchLeg, type TripType } from './search-url';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const STR: Record<
  StoredLocale,
  {
    domestic: string;
    intl: string;
    tripOneWay: string;
    tripRoundTrip: string;
    tripMultiCity: string;
    lblOrigin: string;
    lblDestination: string;
    lblDepartDate: string;
    lblReturnDate: string;
    btnSearch: string;
    flightTypeLabel: string;
    systemFlight: string;
    charterFlight: string;
    charterNotice: string;
    legLabel: (n: number) => string;
    addLeg: string;
    removeLeg: string;
    missing: string;
    sameCity: string;
    missingReturn: string;
    missingLeg: string;
  }
> = {
  fa: {
    domestic: 'پرواز داخلی',
    intl: 'پرواز خارجی',
    tripOneWay: 'یک‌طرفه',
    tripRoundTrip: 'رفت و برگشت',
    tripMultiCity: 'چندمسیره',
    lblOrigin: 'مبدا',
    lblDestination: 'مقصد',
    lblDepartDate: 'تاریخ رفت',
    lblReturnDate: 'تاریخ برگشت',
    btnSearch: 'جستجو',
    flightTypeLabel: 'نوع پرواز:',
    systemFlight: 'سیستمی',
    charterFlight: 'چارتری',
    charterNotice:
      'پروازهای چارتری با ظرفیت محدود و قیمت مقطوع؛ امکان استرداد بر اساس قوانین چارترکننده متفاوت است.',
    legLabel: (n) => `مسیر ${n}`,
    addLeg: '+ افزودن مسیر',
    removeLeg: 'حذف مسیر',
    missing: 'مبدأ، مقصد و تاریخ را انتخاب کنید.',
    sameCity: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
    missingReturn: 'تاریخ برگشت را انتخاب کنید.',
    missingLeg: 'همه مسیرها باید مبدأ، مقصد و تاریخ داشته باشند.',
  },
  en: {
    domestic: 'Domestic',
    intl: 'International',
    tripOneWay: 'One-way',
    tripRoundTrip: 'Round-trip',
    tripMultiCity: 'Multi-city',
    lblOrigin: 'From',
    lblDestination: 'To',
    lblDepartDate: 'Departure',
    lblReturnDate: 'Return',
    btnSearch: 'Search',
    flightTypeLabel: 'Flight type:',
    systemFlight: 'Scheduled',
    charterFlight: 'Charter',
    charterNotice:
      'Charter flights have limited capacity and fixed fares; refund rules differ from scheduled flights.',
    legLabel: (n) => `Leg ${n}`,
    addLeg: '+ Add leg',
    removeLeg: 'Remove leg',
    missing: 'Select an origin, destination, and date.',
    sameCity: 'Origin and destination cannot be the same.',
    missingReturn: 'Select a return date.',
    missingLeg: 'Every leg needs an origin, destination, and date.',
  },
  ar: {
    domestic: 'رحلات داخلية',
    intl: 'رحلات دولية',
    tripOneWay: 'ذهاب فقط',
    tripRoundTrip: 'ذهاب وإياب',
    tripMultiCity: 'متعدد المدن',
    lblOrigin: 'من',
    lblDestination: 'إلى',
    lblDepartDate: 'تاريخ المغادرة',
    lblReturnDate: 'تاريخ العودة',
    btnSearch: 'بحث',
    flightTypeLabel: 'نوع الرحلة:',
    systemFlight: 'مجدولة',
    charterFlight: 'تشارتر',
    charterNotice: 'رحلات التشارتر بسعة محدودة وأسعار ثابتة؛ قواعد الاسترداد مختلفة.',
    legLabel: (n) => `المسار ${n}`,
    addLeg: '+ إضافة مسار',
    removeLeg: 'حذف المسار',
    missing: 'اختر المبدأ والمقصد والتاريخ.',
    sameCity: 'لا يمكن أن يتطابق المبدأ والمقصد.',
    missingReturn: 'اختر تاريخ العودة.',
    missingLeg: 'يجب أن يحتوي كل مسار على مبدأ ومقصد وتاريخ.',
  },
};

interface FlightSearchFormProps {
  airports: Airport[];
  locale: StoredLocale;
  onSubmit: (url: string) => void;
  onError?: (message: string) => void;
}

function TripRadio({
  active,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        cursor: 'pointer',
        color: active ? '#16202e' : '#5a6678',
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        border: 'none',
        background: 'transparent',
        fontFamily: 'inherit',
        padding: 0,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `2px solid ${active ? '#1668c4' : '#c5cedb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active && (
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1668c4' }} />
        )}
      </span>
      {label}
    </button>
  );
}

export default function FlightSearchForm({
  airports,
  locale,
  onSubmit,
  onError,
}: FlightSearchFormProps) {
  const isMobile = useIsMobile();
  const t = STR[locale];

  const [service, setService] = useState<'domestic' | 'intl'>('domestic');
  const [flightKind, setFlightKind] = useState<'system' | 'charter'>('system');
  const [trip, setTrip] = useState<TripType>('round');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [returnDateIso, setReturnDateIso] = useState<string | null>(null);
  const [multiLegs, setMultiLegs] = useState<SearchLeg[]>([
    { origin: '', dest: '', date: '' },
    { origin: '', dest: '', date: '' },
  ]);
  const [pax, setPax] = useState<PassengerCabinState>({
    adults: 1,
    children: 0,
    infants: 0,
    cabin: 'ECONOMY',
  });

  const filteredAirports = useMemo(
    () => filterAirportsByService(airports, service),
    [airports, service],
  );

  const dateReady = trip === 'multi'
    ? multiLegs.every((l) => l.date)
    : Boolean(dateIso) && (trip !== 'round' || Boolean(returnDateIso));

  function reportError(msg: string) {
    onError?.(msg);
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();

    if (trip === 'multi') {
      if (multiLegs.some((l) => !l.origin || !l.dest || !l.date)) {
        reportError(t.missingLeg);
        return;
      }
      if (multiLegs.some((l) => l.origin === l.dest)) {
        reportError(t.sameCity);
        return;
      }
      onSubmit(
        buildResultsUrl({
          trip: 'multi',
          legs: multiLegs.map((l) => ({ ...l, date: l.date.slice(0, 10) })),
          ...pax,
        }),
      );
      return;
    }

    if (!origin || !dest || !dateIso) {
      reportError(t.missing);
      return;
    }
    if (origin === dest) {
      reportError(t.sameCity);
      return;
    }
    if (trip === 'round' && !returnDateIso) {
      reportError(t.missingReturn);
      return;
    }

    onSubmit(
      buildResultsUrl({
        trip,
        legs: [{ origin, dest, date: dateIso.slice(0, 10) }],
        returnDate: returnDateIso?.slice(0, 10),
        ...pax,
      }),
    );
  }

  function swap() {
    setOrigin(dest);
    setDest(origin);
  }

  function updateMultiLeg(index: number, patch: Partial<SearchLeg>) {
    setMultiLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
  }

  function addLeg() {
    if (multiLegs.length >= 4) return;
    const last = multiLegs[multiLegs.length - 1];
    setMultiLegs([...multiLegs, { origin: last?.dest ?? '', dest: '', date: '' }]);
  }

  function removeLeg(index: number) {
    if (multiLegs.length <= 2) return;
    setMultiLegs(multiLegs.filter((_, i) => i !== index));
  }

  const fieldsBorder = isMobile ? 'none' : '1.5px solid #e3e9f1';
  const fieldsBg = isMobile ? 'transparent' : '#fff';

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: '#eef1f5', borderRadius: 11, padding: 3 }}>
          {(['domestic', 'intl'] as const).map((key) => {
            const active = service === key;
            const label = key === 'domestic' ? t.domestic : t.intl;
            return (
              <button
                key={key}
                type="button"
                data-testid={`service-${key}`}
                onClick={() => setService(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  color: active ? '#1668c4' : '#5a6678',
                  fontWeight: active ? 800 : 600,
                  background: active ? '#fff' : 'transparent',
                  boxShadow: active ? '0 2px 7px rgba(13,38,102,.14)' : 'none',
                  border: 'none',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {flightKind === 'charter' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: '#fff7ed',
            border: '1px solid #fde3c4',
            color: '#9a5b16',
            borderRadius: 12,
            padding: '11px 14px',
            marginBottom: 18,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
          </svg>
          {t.charterNotice}
        </div>
      )}

      <div style={{ display: 'flex', gap: isMobile ? 14 : 25, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <TripRadio
          active={trip === 'round'}
          label={t.tripRoundTrip}
          onClick={() => setTrip('round')}
          testId="trip-round"
        />
        <TripRadio
          active={trip === 'oneway'}
          label={t.tripOneWay}
          onClick={() => setTrip('oneway')}
          testId="trip-oneway"
        />
        <TripRadio
          active={trip === 'multi'}
          label={t.tripMultiCity}
          onClick={() => setTrip('multi')}
          testId="trip-multi"
        />
      </div>

      {trip === 'multi' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {multiLegs.map((leg, index) => (
            <div
              key={`leg-${index}`}
              data-testid={`multi-leg-${index}`}
              style={{
                border: '1.5px solid #e3e9f1',
                borderRadius: 14,
                background: '#fff',
                padding: isMobile ? 10 : 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '0 0 8px' : '8px 14px 0',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#0d2640',
                }}
              >
                <span>{t.legLabel(index + 1)}</span>
                {multiLegs.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(index)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#e5484d',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t.removeLeg}
                  </button>
                )}
              </div>
              <div
                style={{
                  display: isMobile ? 'grid' : 'flex',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : undefined,
                  alignItems: 'stretch',
                  flexWrap: 'wrap',
                  gap: isMobile ? 8 : 0,
                }}
              >
                <AirportCityPicker
                  airports={filteredAirports}
                  value={leg.origin}
                  onChange={(code) => updateMultiLeg(index, { origin: code })}
                  label={t.lblOrigin}
                  locale={locale}
                  excludeCode={leg.dest}
                  testId={`leg-${index}-origin`}
                />
                <AirportCityPicker
                  airports={filteredAirports}
                  value={leg.dest}
                  onChange={(code) => updateMultiLeg(index, { dest: code })}
                  label={t.lblDestination}
                  locale={locale}
                  excludeCode={leg.origin}
                  requireOriginFirst
                  originSelected={Boolean(leg.origin)}
                  testId={`leg-${index}-dest`}
                />
                <div style={{ flex: '1.1 1 120px', minWidth: 120, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <JalaliDatePicker
                    label={t.lblDepartDate}
                    value={leg.date || null}
                    onChange={(iso) => updateMultiLeg(index, { date: iso.slice(0, 10) })}
                    minDate={index === 0 ? TODAY_ISO : multiLegs[index - 1]?.date || TODAY_ISO}
                    testId={`leg-${index}-date`}
                  />
                </div>
              </div>
            </div>
          ))}
          {multiLegs.length < 4 && (
            <button
              type="button"
              onClick={addLeg}
              data-testid="add-leg"
              style={{
                alignSelf: 'flex-start',
                border: '1.5px dashed #c5cedb',
                background: '#f8fafc',
                color: '#1668c4',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.addLeg}
            </button>
          )}
          <div
            style={{
              display: isMobile ? 'grid' : 'flex',
              alignItems: 'stretch',
              border: fieldsBorder,
              borderRadius: 14,
              background: fieldsBg,
              flexWrap: 'wrap',
            }}
          >
            <PassengerCabinPicker
              value={pax}
              onChange={setPax}
              locale={locale}
              enabled={dateReady}
              testId="home-pax"
            />
            <button
              type="submit"
              data-testid="home-search-submit"
              style={{
                flex: 'none',
                margin: isMobile ? 0 : 8,
                border: 'none',
                borderRadius: isMobile ? 11 : '13px 0 0 13px',
                background: '#1668c4',
                color: '#fff',
                padding: isMobile ? '0 28px' : '0 21px',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                gridColumn: isMobile ? '1 / -1' : undefined,
                height: isMobile ? 44 : 'auto',
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              {t.btnSearch}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: isMobile ? 'grid' : 'flex',
              gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'none',
              alignItems: 'stretch',
              position: 'relative',
              border: fieldsBorder,
              borderRadius: 14,
              background: fieldsBg,
              flexWrap: 'wrap',
              gap: isMobile ? 10 : 0,
            }}
          >
            <AirportCityPicker
              airports={filteredAirports}
              value={origin}
              onChange={setOrigin}
              label={t.lblOrigin}
              locale={locale}
              excludeCode={dest}
              testId="home-origin"
            />

            <div
              onClick={swap}
              style={{
                alignSelf: 'center',
                width: 40,
                height: 40,
                flex: 'none',
                borderRadius: '50%',
                background: '#fff',
                border: '1.5px solid #e3e9f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1668c4',
                fontSize: '15.5px',
                cursor: 'pointer',
                zIndex: 3,
                margin: isMobile ? '6px auto' : '0 -20px',
                boxShadow: '0 3px 10px rgba(13,38,102,.12)',
                gridColumn: isMobile ? '1 / -1' : 'auto',
              }}
            >
              ⇄
            </div>

            <AirportCityPicker
              airports={filteredAirports}
              value={dest}
              onChange={setDest}
              label={t.lblDestination}
              locale={locale}
              excludeCode={origin}
              requireOriginFirst
              originSelected={Boolean(origin)}
              testId="home-dest"
            />

            <div
              style={{
                flex: '1.1 1 120px',
                minWidth: 120,
                borderRight: isMobile ? 'none' : '1px solid #eef1f5',
                gridColumn: isMobile ? '1' : 'auto',
                opacity: dest ? 1 : 0.45,
              }}
            >
              <JalaliDatePicker
                label={t.lblDepartDate}
                value={dateIso}
                onChange={setDateIso}
                minDate={TODAY_ISO}
                testId="home-date"
              />
            </div>

            {trip === 'round' && (
              <div
                style={{
                  flex: '1.1 1 120px',
                  minWidth: 120,
                  borderRight: isMobile ? 'none' : '1px solid #eef1f5',
                  gridColumn: isMobile ? '2' : 'auto',
                  opacity: dateIso ? 1 : 0.45,
                }}
              >
                <JalaliDatePicker
                  label={t.lblReturnDate}
                  value={returnDateIso}
                  onChange={setReturnDateIso}
                  minDate={dateIso?.slice(0, 10) ?? TODAY_ISO}
                  testId="home-return-date"
                />
              </div>
            )}

            <PassengerCabinPicker
              value={pax}
              onChange={setPax}
              locale={locale}
              enabled={Boolean(dateIso) && (trip !== 'round' || Boolean(returnDateIso))}
              testId="home-pax"
            />

            <button
              type="submit"
              data-testid="home-search-submit"
              style={{
                flex: 'none',
                margin: isMobile ? 0 : 8,
                border: 'none',
                borderRadius: isMobile ? 11 : '13px 0 0 13px',
                background: '#1668c4',
                color: '#fff',
                padding: isMobile ? '0 28px' : '0 21px',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                gridColumn: isMobile ? '1 / -1' : 'auto',
                height: isMobile ? 44 : 'auto',
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              {t.btnSearch}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18 }}>
            <span style={{ fontSize: '11.5px', color: '#8a96a6', fontWeight: 600 }}>{t.flightTypeLabel}</span>
            <div style={{ display: 'inline-flex', background: '#eef1f5', borderRadius: 10, padding: 3 }}>
              {(['system', 'charter'] as const).map((kind) => {
                const active = flightKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    data-testid={`flight-kind-${kind}`}
                    onClick={() => setFlightKind(kind)}
                    style={{
                      padding: '7px 17px',
                      borderRadius: 8,
                      fontSize: '11.5px',
                      fontWeight: active ? 800 : 600,
                      color: active ? '#1668c4' : '#5a6678',
                      background: active ? '#fff' : 'transparent',
                      boxShadow: active ? '0 2px 6px rgba(13,38,102,.12)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {kind === 'system' ? t.systemFlight : t.charterFlight}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </form>
  );
}

export { STR as FLIGHT_SEARCH_STR };
