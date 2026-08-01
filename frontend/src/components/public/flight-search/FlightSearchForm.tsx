import { useMemo, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';
import JalaliDatePicker from '../../JalaliDatePicker';
import type { Airport, CabinClass } from '../../../types/public-site';
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
    cabinEconomy: string;
    cabinBusiness: string;
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
    cabinEconomy: 'اکونومی',
    cabinBusiness: 'بیزینس',
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
    cabinEconomy: 'Economy',
    cabinBusiness: 'Business',
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
    cabinEconomy: 'اقتصادية',
    cabinBusiness: 'درجة الأعمال',
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
  onDark,
  testId,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  onDark: boolean;
  testId?: string;
}) {
  const activeColor = onDark ? '#fff' : '#16202e';
  const inactiveColor = onDark ? 'rgba(255,255,255,.68)' : '#5a6678';
  const inactiveBorder = onDark ? '2px solid rgba(255,255,255,.4)' : '2px solid #c5cedb';
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
        color: active ? activeColor : inactiveColor,
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
          border: active ? '2px solid #1668c4' : inactiveBorder,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active && onDark ? '#fff' : 'transparent',
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

/** design-reference-v2 mobile: white field cards on the navy panel. */
const MOBILE_CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 8px 20px -14px rgba(0,0,0,.4)',
};

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
  const [classBoxOpen, setClassBoxOpen] = useState(false);
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

  const paxEnabled = trip === 'multi'
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

  const cabinLabel = pax.cabin === 'BUSINESS' ? t.cabinBusiness : t.cabinEconomy;

  const searchBtnStyle: React.CSSProperties = {
    flex: 'none',
    margin: isMobile ? 0 : 8,
    border: 'none',
    borderRadius: isMobile ? 13 : locale === 'en' ? '0 13px 13px 0' : '13px 0 0 13px',
    background: '#1668c4',
    color: '#fff',
    padding: '0 21px',
    fontSize: '12.5px',
    fontWeight: 800,
    cursor: 'pointer',
    gridColumn: isMobile ? '1 / -1' : undefined,
    minHeight: isMobile ? 48 : undefined,
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    fontFamily: 'inherit',
  };

  const searchIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'inline-flex',
            background: isMobile ? 'rgba(255,255,255,.14)' : '#eef1f5',
            borderRadius: 11,
            padding: 3,
          }}
        >
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
                  color: active ? '#1668c4' : isMobile ? '#cfe0f2' : '#5a6678',
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
          onDark={isMobile}
          testId="trip-round"
        />
        <TripRadio
          active={trip === 'oneway'}
          label={t.tripOneWay}
          onClick={() => setTrip('oneway')}
          onDark={isMobile}
          testId="trip-oneway"
        />
        <TripRadio
          active={trip === 'multi'}
          label={t.tripMultiCity}
          onClick={() => setTrip('multi')}
          onDark={isMobile}
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
                border: isMobile ? 'none' : '1.5px solid #e3e9f1',
                borderRadius: 14,
                background: '#fff',
                padding: isMobile ? 10 : 0,
                boxShadow: isMobile ? MOBILE_CARD.boxShadow : undefined,
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
                    mobileSheet
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
                border: isMobile ? '1.5px dashed rgba(255,255,255,.45)' : '1.5px dashed #c5cedb',
                background: isMobile ? 'rgba(255,255,255,.1)' : '#f8fafc',
                color: isMobile ? '#fff' : '#1668c4',
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
              gridTemplateColumns: isMobile ? '1fr' : undefined,
              alignItems: 'stretch',
              border: isMobile ? 'none' : '1.5px solid #e3e9f1',
              borderRadius: 14,
              background: isMobile ? 'transparent' : '#fff',
              flexWrap: 'wrap',
              gap: isMobile ? 10 : 0,
            }}
          >
            <PassengerCabinPicker
              value={pax}
              onChange={setPax}
              locale={locale}
              enabled={paxEnabled}
              testId="home-pax"
              rootStyle={isMobile ? { ...MOBILE_CARD, padding: '6px 0' } : undefined}
            />
            <button type="submit" data-testid="home-search-submit" style={searchBtnStyle}>
              {searchIcon}
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
              border: isMobile ? 'none' : '1.5px solid #e3e9f1',
              borderRadius: 14,
              background: isMobile ? 'transparent' : '#fff',
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
              rootStyle={
                isMobile
                  ? { ...MOBILE_CARD, gridColumn: '1', gridRow: '1', minWidth: 0, padding: '6px 0' }
                  : undefined
              }
            />

            <div
              onClick={swap}
              style={{
                alignSelf: 'center',
                justifySelf: 'center',
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
                margin: isMobile ? 0 : '0 -20px',
                boxShadow: '0 3px 10px rgba(13,38,102,.12)',
                gridArea: isMobile ? '1 / 1 / 2 / -1' : undefined,
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
              rootStyle={
                isMobile
                  ? { ...MOBILE_CARD, gridColumn: '2', gridRow: '1', minWidth: 0, padding: '6px 0' }
                  : undefined
              }
            />

            <div
              style={{
                flex: '1.1 1 120px',
                minWidth: isMobile ? 0 : 120,
                borderRight: isMobile ? 'none' : '1px solid #eef1f5',
                opacity: dest ? 1 : 0.45,
                ...(isMobile ? { ...MOBILE_CARD, gridColumn: '1', padding: '6px 0' } : {}),
              }}
            >
              <JalaliDatePicker
                label={t.lblDepartDate}
                value={dateIso}
                onChange={setDateIso}
                minDate={TODAY_ISO}
                testId="home-date"
                mobileSheet
              />
            </div>

            {(trip === 'round' || isMobile) && (
              <div
                style={{
                  flex: '1.1 1 120px',
                  minWidth: isMobile ? 0 : 120,
                  borderRight: isMobile ? 'none' : '1px solid #eef1f5',
                  opacity: trip !== 'round' ? 0.45 : dateIso ? 1 : 0.45,
                  pointerEvents: trip === 'round' ? 'auto' : 'none',
                  ...(isMobile ? { ...MOBILE_CARD, gridColumn: '2', padding: '6px 0' } : {}),
                }}
              >
                <JalaliDatePicker
                  label={t.lblReturnDate}
                  value={returnDateIso}
                  onChange={setReturnDateIso}
                  minDate={dateIso?.slice(0, 10) ?? TODAY_ISO}
                  testId="home-return-date"
                  mobileSheet
                />
              </div>
            )}

            <PassengerCabinPicker
              value={pax}
              onChange={setPax}
              locale={locale}
              enabled={paxEnabled}
              testId="home-pax"
              rootStyle={
                isMobile
                  ? { ...MOBILE_CARD, gridColumn: '1', minWidth: 0, padding: '6px 0' }
                  : undefined
              }
            />

            {isMobile && (
              <div style={{ ...MOBILE_CARD, gridColumn: '2', position: 'relative', minWidth: 0, padding: '6px 0' }}>
                <div
                  data-testid="mobile-class-box"
                  onClick={() => setClassBoxOpen((v) => !v)}
                  style={{
                    cursor: 'pointer',
                    padding: '5px 13px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
                    </svg>
                    {t.flightTypeLabel}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap' }}>
                    {cabinLabel}
                    <span style={{ color: '#9aa4b2', fontSize: 10 }}>▾</span>
                  </div>
                </div>
                {classBoxOpen && (
                  <>
                    <div onClick={() => setClassBoxOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 38 }} />
                    <div
                      style={{
                        position: 'absolute',
                        top: 74,
                        right: 0,
                        width: 190,
                        maxWidth: '80vw',
                        background: '#fff',
                        border: '1px solid #e6eaf0',
                        borderRadius: 14,
                        boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)',
                        padding: 10,
                        zIndex: 40,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {([['ECONOMY', t.cabinEconomy], ['BUSINESS', t.cabinBusiness]] as const).map(([cab, lbl]) => {
                        const active = pax.cabin === cab;
                        return (
                          <button
                            key={cab}
                            type="button"
                            onClick={() => {
                              setPax({ ...pax, cabin: cab as CabinClass });
                              setClassBoxOpen(false);
                            }}
                            style={{
                              padding: '9px 10px',
                              borderRadius: 9,
                              border: active ? '1.5px solid #1668c4' : '1.5px solid #e2e7ee',
                              background: active ? '#eef4fb' : '#fff',
                              color: active ? '#1668c4' : '#5a6678',
                              fontSize: '12.5px',
                              fontWeight: active ? 700 : 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              textAlign: locale === 'en' ? 'left' : 'right',
                            }}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <button type="submit" data-testid="home-search-submit" style={searchBtnStyle}>
              {searchIcon}
              {t.btnSearch}
            </button>
          </div>

          {!isMobile && (
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
          )}
        </>
      )}
    </form>
  );
}

export { STR as FLIGHT_SEARCH_STR };
