import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JalaliDatePicker from '../../../components/JalaliDatePicker';
import type { Airport } from '../../../types/public-site';
import type { StoredLocale } from '../../../hooks/useLocale';
import { formatToman } from '../../../lib/fa-format';
import {
  DomesticFlightIcon,
  IntlFlightIcon,
  PinIcon,
  PlaneIcon,
  SearchIcon,
  UserIcon,
} from './home-icons';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

type TopTab = 'book' | 'manage' | 'checkin';
type TripType = 'one' | 'round' | 'multi';
type ServiceType = 'domestic' | 'intl';
type Cabin = 'economy' | 'business';

export type HomeSearchCopy = {
  tabBook: string;
  tabManage: string;
  tabCheckin: string;
  svcDomestic: string;
  svcIntl: string;
  tripOneWay: string;
  tripRoundTrip: string;
  tripMultiCity: string;
  lblOrigin: string;
  lblDestination: string;
  lblDepartDate: string;
  lblReturnDate: string;
  lblPaxClass: string;
  lblFlightType: string;
  selectPlaceholder: string;
  btnSearch: string;
  btnConfirm: string;
  lblAdults: string;
  lblAdultsAge: string;
  lblChildren: string;
  lblChildrenAge: string;
  lblInfants: string;
  lblInfantsAge: string;
  lblCabinClass: string;
  cabinEconomy: string;
  cabinBusiness: string;
  manageIntro: string;
  lblBookingCode: string;
  phBookingCode: string;
  lblLastName: string;
  phLastName: string;
  btnViewBooking: string;
  checkinIntro: string;
  lblFlightNo: string;
  phFlightNo: string;
  lblFlightDate: string;
  phFlightDate: string;
  btnViewStatus: string;
  popularRoutesTitle: string;
  popularRoutesSub: string;
  fromPrice: string;
  toman: string;
  airlineBadge: string;
  airlineTitle: string;
  airlineSub: string;
  airlineBtn: string;
  missing: string;
  sameCity: string;
};

type RouteItem = { fromCode: string; toCode: string; tomanPrice: number };

function TripRadio({
  active,
  label,
  onClick,
  isMobile,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  isMobile: boolean;
}) {
  const activeColor = isMobile ? '#fff' : '#16202e';
  const inactiveColor = isMobile ? 'rgba(255,255,255,.68)' : '#5a6678';
  const inactiveBorder = isMobile ? '2px solid rgba(255,255,255,.4)' : '2px solid #c5cedb';
  return (
    <span
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        cursor: 'pointer',
        color: active ? activeColor : inactiveColor,
        fontWeight: active ? 700 : 500,
        fontSize: 13,
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
        }}
      >
        {active && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1668c4' }} />}
      </span>
      {label}
    </span>
  );
}

function AirportCell({
  label,
  value,
  display,
  airports,
  onPick,
  testId,
  fieldStyle,
  isRTL,
}: {
  label: string;
  value: string;
  display: string;
  airports: Airport[];
  onPick: (code: string) => void;
  testId: string;
  fieldStyle?: React.CSSProperties;
  isRTL: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airports;
    return airports.filter((a) => a.code.toLowerCase().includes(q) || a.cityFa.toLowerCase().includes(q));
  }, [airports, query]);

  return (
    <div ref={rootRef} style={{ flex: '1.5 1 165px', minWidth: 165, position: 'relative', ...fieldStyle }}>
      <div
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: 'pointer', padding: '10px 24px 10px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
          <PinIcon />
          {label}
        </div>
        <div style={{ fontSize: '14.5px', fontWeight: 800, color: value ? '#16202e' : '#9aa4b2' }}>{display}</div>
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 38 }} />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              [isRTL ? 'right' : 'left']: 0,
              marginTop: 4,
              width: 280,
              maxWidth: '88vw',
              background: '#fff',
              border: '1px solid #e6eaf0',
              borderRadius: 14,
              boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)',
              padding: 13,
              zIndex: 40,
            }}
          >
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder={label}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 42,
                border: '1.5px solid #e2e7ee',
                borderRadius: 10,
                padding: '0 12px',
                fontSize: '12.5px',
                fontFamily: 'inherit',
                outline: 'none',
                marginBottom: 9,
              }}
            />
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filtered.map((a) => (
                <div
                  key={a.id}
                  onClick={() => {
                    onPick(a.code);
                    setOpen(false);
                    setQuery('');
                  }}
                  data-testid={`airport-option-${a.code}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 7px', borderRadius: 9, cursor: 'pointer' }}
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
                    <PlaneIcon size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 700, color: '#16202e' }}>
                    {a.cityFa} ({a.code})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function HomeSearchCard({
  locale,
  isMobile,
  isRTL,
  copy: t,
  airports,
  cityName,
  popularRoutes,
}: {
  locale: StoredLocale;
  isMobile: boolean;
  isRTL: boolean;
  copy: HomeSearchCopy;
  airports: Airport[];
  cityName: (code: string, cityFa?: string) => string;
  popularRoutes: RouteItem[];
}) {
  const navigate = useNavigate();
  const [topTab, setTopTab] = useState<TopTab>('book');
  const [service, setService] = useState<ServiceType>('domestic');
  const [tripType, setTripType] = useState<TripType>('one');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [returnIso, setReturnIso] = useState<string | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState<Cabin>('economy');
  const [paxOpen, setPaxOpen] = useState(false);
  const [classBoxOpen, setClassBoxOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
  const [flightNo, setFlightNo] = useState('');

  const showReturn = tripType === 'round' || isMobile;
  const panelBg = isMobile ? 'linear-gradient(135deg,#0d2640,#16406e)' : '#fff';
  const svcTrackBg = isMobile ? 'rgba(255,255,255,.14)' : '#eef1f5';
  const fieldCardExtra: React.CSSProperties = isMobile
    ? { background: '#fff', borderRadius: 12, boxShadow: '0 8px 20px -14px rgba(0,0,0,.4)' }
    : {};
  const fieldBoxBg = isMobile ? '#fff' : 'transparent';
  const searchBtnRadius = isMobile ? '13px' : isRTL ? '13px 0 0 13px' : '0 13px 13px 0';

  const cabinLabel = cabin === 'economy' ? t.cabinEconomy : t.cabinBusiness;
  const paxSummary = `${formatToman(adults, locale)} ${t.lblAdults}${children ? `، ${formatToman(children, locale)} ${t.lblChildren}` : ''}${infants ? `، ${formatToman(infants, locale)} ${t.lblInfants}` : ''}، ${cabinLabel}`;

  function originDisplay() {
    if (!origin) return t.selectPlaceholder;
    const ap = airports.find((a) => a.code === origin);
    return cityName(origin, ap?.cityFa);
  }

  function destDisplay() {
    if (!dest) return t.selectPlaceholder;
    const ap = airports.find((a) => a.code === dest);
    return cityName(dest, ap?.cityFa);
  }

  function onSearch() {
    if (!origin || !dest || !dateIso) {
      setError(t.missing);
      return;
    }
    if (origin === dest) {
      setError(t.sameCity);
      return;
    }
    setError(null);
    navigate(`/results?origin=${origin}&dest=${dest}&date=${dateIso.slice(0, 10)}`);
  }

  const tabs: { id: TopTab; label: string }[] = [
    { id: 'book', label: t.tabBook },
    { id: 'manage', label: t.tabManage },
    { id: 'checkin', label: t.tabCheckin },
  ];

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px 38px', position: 'relative' }}>
      <div
        id="search-card"
        style={{
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 34px 74px -26px rgba(13,38,102,.45)',
          border: '1px solid #eef1f5',
          marginTop: isMobile ? -46 : -72,
          position: 'relative',
          zIndex: 30,
          overflow: 'visible',
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid #eef1f5', borderRadius: '18px 18px 0 0', overflow: 'hidden' }}>
          {tabs.map((tab) => {
            const active = topTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTopTab(tab.id)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '15px 6px 12px',
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  color: active ? '#0d2640' : '#8a96a6',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '3px solid #1668c4' : '3px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16, background: panelBg, borderRadius: '0 0 17px 17px' }}>
          {topTab === 'book' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: svcTrackBg, borderRadius: 11, padding: 3 }}>
                  {(['domestic', 'intl'] as ServiceType[]).map((svc) => {
                    const active = service === svc;
                    return (
                      <button
                        key={svc}
                        type="button"
                        onClick={() => setService(svc)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 13px',
                          borderRadius: 8,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          border: 'none',
                          fontFamily: 'inherit',
                          color: active ? (isMobile ? '#1668c4' : '#1668c4') : isMobile ? '#fff' : '#5a6678',
                          fontWeight: active ? 700 : 500,
                          background: active ? '#fff' : 'transparent',
                          boxShadow: active ? '0 2px 6px rgba(13,38,102,.12)' : 'none',
                        }}
                      >
                        {svc === 'domestic' ? <DomesticFlightIcon size={18} /> : <IntlFlightIcon size={18} />}
                        {svc === 'domestic' ? t.svcDomestic : t.svcIntl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: isMobile ? 14 : 25, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <TripRadio active={tripType === 'one'} label={t.tripOneWay} onClick={() => setTripType('one')} isMobile={isMobile} />
                <TripRadio active={tripType === 'round'} label={t.tripRoundTrip} onClick={() => setTripType('round')} isMobile={isMobile} />
                <TripRadio active={tripType === 'multi'} label={t.tripMultiCity} onClick={() => setTripType('multi')} isMobile={isMobile} />
              </div>

              {error && (
                <p style={{ marginBottom: 12, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>
              )}

              <div
                style={{
                  display: isMobile ? 'grid' : 'flex',
                  gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'none',
                  gap: isMobile ? 10 : 0,
                  alignItems: 'stretch',
                  position: 'relative',
                  border: isMobile ? 'none' : '1.5px solid #e3e9f1',
                  borderRadius: 14,
                  background: isMobile ? 'transparent' : '#fff',
                  flexWrap: 'wrap',
                }}
              >
                <AirportCell
                  label={t.lblOrigin}
                  value={origin}
                  display={originDisplay()}
                  airports={airports}
                  onPick={setOrigin}
                  testId="home-origin"
                  fieldStyle={{ gridColumn: isMobile ? '1' : 'auto', ...fieldCardExtra }}
                  isRTL={isRTL}
                />

                <div
                  onClick={() => {
                    setOrigin(dest);
                    setDest(origin);
                  }}
                  style={{
                    alignSelf: 'center',
                    justifySelf: 'center',
                    gridColumn: isMobile ? '1 / -1' : 'auto',
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
                  }}
                >
                  ⇄
                </div>

                <AirportCell
                  label={t.lblDestination}
                  value={dest}
                  display={destDisplay()}
                  airports={airports}
                  onPick={setDest}
                  testId="home-dest"
                  fieldStyle={{
                    gridColumn: isMobile ? '2' : 'auto',
                    borderRight: isMobile ? 'none' : '1px solid #eef1f5',
                    ...fieldCardExtra,
                  }}
                  isRTL={isRTL}
                />

                <div style={{ flex: '1.1 1 120px', minWidth: 120, borderRight: isMobile ? 'none' : '1px solid #eef1f5', gridColumn: isMobile ? '1 / -1' : 'auto', ...fieldCardExtra }}>
                  <JalaliDatePicker label={t.lblDepartDate} value={dateIso} onChange={setDateIso} minDate={TODAY_ISO} testId="home-date" />
                </div>

                {showReturn && (
                  <div style={{ flex: '1.1 1 120px', minWidth: 120, borderRight: isMobile ? 'none' : '1px solid #eef1f5', gridColumn: isMobile ? '1 / -1' : 'auto', opacity: tripType === 'round' ? 1 : 0.45, ...fieldCardExtra }}>
                    <JalaliDatePicker label={t.lblReturnDate} value={returnIso} onChange={setReturnIso} minDate={dateIso ?? TODAY_ISO} testId="home-return-date" />
                  </div>
                )}

                <div style={{ flex: '1.2 1 150px', minWidth: 150, position: 'relative', borderRight: isMobile ? 'none' : '1px solid #eef1f5', gridColumn: isMobile ? '1' : 'auto', ...fieldCardExtra }}>
                  <div onClick={() => setPaxOpen((v) => !v)} style={{ cursor: 'pointer', padding: '5px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
                      <UserIcon />
                      {t.lblPaxClass}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap' }}>
                      {paxSummary}
                      <span style={{ color: '#9aa4b2', fontSize: 10 }}>▾</span>
                    </div>
                  </div>
                  {paxOpen && (
                    <>
                      <div onClick={() => setPaxOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 38 }} />
                      <div style={{ position: 'absolute', top: 74, [isRTL ? 'right' : 'left']: 0, width: 312, maxWidth: '88vw', background: '#fff', border: '1px solid #e6eaf0', borderRadius: 14, boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)', padding: '5px 15px 15px', zIndex: 40 }}>
                        {[
                          { label: t.lblAdults, sub: t.lblAdultsAge, val: adults, dec: () => setAdults((n) => Math.max(1, n - 1)), inc: () => setAdults((n) => n + 1) },
                          { label: t.lblChildren, sub: t.lblChildrenAge, val: children, dec: () => setChildren((n) => Math.max(0, n - 1)), inc: () => setChildren((n) => n + 1) },
                          { label: t.lblInfants, sub: t.lblInfantsAge, val: infants, dec: () => setInfants((n) => Math.max(0, n - 1)), inc: () => setInfants((n) => n + 1) },
                        ].map((row, i) => (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < 2 ? '1px solid #f2f4f7' : undefined }}>
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#16202e' }}>{row.label}</div>
                              <div style={{ fontSize: '10.5px', color: '#9aa4b2' }}>{row.sub}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                              <span onClick={row.dec} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #d5dde7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1668c4', fontSize: 18, cursor: 'pointer', userSelect: 'none' }}>−</span>
                              <span style={{ width: 22, textAlign: 'center', fontWeight: 700, fontSize: '13.5px' }}>{formatToman(row.val, locale)}</span>
                              <span onClick={row.inc} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #d5dde7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1668c4', fontSize: 16, cursor: 'pointer', userSelect: 'none' }}>+</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ borderTop: '1px solid #eef1f5', marginTop: 6, paddingTop: 11 }}>
                          <div style={{ fontSize: '11.5px', color: '#8a96a6', fontWeight: 600, marginBottom: 10 }}>{t.lblCabinClass}</div>
                          <div style={{ display: 'flex', gap: 7 }}>
                            {(['economy', 'business'] as Cabin[]).map((c) => (
                              <span
                                key={c}
                                onClick={() => setCabin(c)}
                                style={{
                                  flex: 1,
                                  textAlign: 'center',
                                  padding: '7px 0',
                                  borderRadius: 9,
                                  border: cabin === c ? '1.5px solid #1668c4' : '1.5px solid #e2e7ee',
                                  background: cabin === c ? '#eef4fb' : '#fff',
                                  color: cabin === c ? '#1668c4' : '#5a6678',
                                  fontSize: '11.5px',
                                  fontWeight: cabin === c ? 700 : 500,
                                  cursor: 'pointer',
                                }}
                              >
                                {c === 'economy' ? t.cabinEconomy : t.cabinBusiness}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div onClick={() => setPaxOpen(false)} style={{ marginTop: 16, height: 44, borderRadius: 10, background: '#1668c4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                          {t.btnConfirm}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {isMobile && (
                  <div style={{ flex: '1.2 1 150px', minWidth: 150, position: 'relative', gridColumn: '2', ...fieldCardExtra }}>
                    <div onClick={() => setClassBoxOpen((v) => !v)} style={{ cursor: 'pointer', padding: '5px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
                        <PlaneIcon size={14} />
                        {t.lblFlightType}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#16202e', whiteSpace: 'nowrap' }}>
                        {cabinLabel}
                        <span style={{ color: '#9aa4b2', fontSize: 10 }}>▾</span>
                      </div>
                    </div>
                    {classBoxOpen && (
                      <>
                        <div onClick={() => setClassBoxOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 38 }} />
                        <div style={{ position: 'absolute', top: 74, [isRTL ? 'right' : 'left']: 0, width: 190, maxWidth: '80vw', background: '#fff', border: '1px solid #e6eaf0', borderRadius: 14, boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)', padding: 10, zIndex: 40, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(['economy', 'business'] as Cabin[]).map((c) => (
                            <span
                              key={c}
                              onClick={() => {
                                setCabin(c);
                                setClassBoxOpen(false);
                              }}
                              style={{
                                padding: '9px 10px',
                                borderRadius: 9,
                                border: cabin === c ? '1.5px solid #1668c4' : '1.5px solid #e2e7ee',
                                background: cabin === c ? '#eef4fb' : '#fff',
                                color: cabin === c ? '#1668c4' : '#5a6678',
                                fontSize: '12.5px',
                                fontWeight: cabin === c ? 700 : 500,
                                cursor: 'pointer',
                              }}
                            >
                              {c === 'economy' ? t.cabinEconomy : t.cabinBusiness}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  data-testid="home-search-submit"
                  onClick={onSearch}
                  style={{
                    flex: 'none',
                    alignSelf: 'stretch',
                    gridColumn: isMobile ? '1 / -1' : 'auto',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '0 21px',
                    background: '#1668c4',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: searchBtnRadius,
                    justifyContent: 'center',
                    border: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  <SearchIcon />
                  {t.btnSearch}
                </button>
              </div>

              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18 }}>
                  <span style={{ fontSize: '11.5px', color: '#5a6678', fontWeight: 600 }}>{t.lblFlightType}</span>
                  <div style={{ display: 'inline-flex', background: '#eef1f5', borderRadius: 10, padding: 3 }}>
                    {(['economy', 'business'] as Cabin[]).map((c) => (
                      <span
                        key={c}
                        onClick={() => setCabin(c)}
                        style={{
                          padding: '7px 17px',
                          borderRadius: 8,
                          fontSize: '11.5px',
                          fontWeight: cabin === c ? 700 : 500,
                          color: cabin === c ? '#1668c4' : '#5a6678',
                          background: cabin === c ? '#fff' : 'transparent',
                          boxShadow: cabin === c ? '0 2px 6px rgba(13,38,102,.12)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {c === 'economy' ? t.cabinEconomy : t.cabinBusiness}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {topTab === 'manage' && (
            <div style={{ padding: '6px 2px 4px' }}>
              <div style={{ fontSize: '12.5px', color: isMobile ? '#cfe0f5' : '#5a6678', marginBottom: 16, lineHeight: 1.9 }}>{t.manageIntro}</div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 11 }}>
                <div style={{ flex: 1, background: fieldBoxBg, borderRadius: 12, padding: '13px 15px', boxShadow: isMobile ? '0 8px 20px -12px rgba(0,0,0,.3)' : 'none' }}>
                  <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.lblBookingCode}</div>
                  <input value={pnr} onChange={(ev) => setPnr(ev.target.value)} placeholder={t.phBookingCode} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }} />
                </div>
                <div style={{ flex: 1, background: fieldBoxBg, borderRadius: 12, padding: '13px 15px', boxShadow: isMobile ? '0 8px 20px -12px rgba(0,0,0,.3)' : 'none' }}>
                  <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.lblLastName}</div>
                  <input value={lastName} onChange={(ev) => setLastName(ev.target.value)} placeholder={t.phLastName} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/manage-booking${pnr ? `?pnr=${encodeURIComponent(pnr)}` : ''}`)}
                style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, background: '#1668c4', color: '#fff', fontSize: '13.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.btnViewBooking}
              </button>
            </div>
          )}

          {topTab === 'checkin' && (
            <div style={{ padding: '6px 2px 4px' }}>
              <div style={{ fontSize: '12.5px', color: isMobile ? '#cfe0f5' : '#5a6678', marginBottom: 16, lineHeight: 1.9 }}>{t.checkinIntro}</div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 11 }}>
                <div style={{ flex: 1, background: fieldBoxBg, borderRadius: 12, padding: '13px 15px', boxShadow: isMobile ? '0 8px 20px -12px rgba(0,0,0,.3)' : 'none' }}>
                  <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.lblFlightNo}</div>
                  <input value={flightNo} onChange={(ev) => setFlightNo(ev.target.value)} placeholder={t.phFlightNo} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }} />
                </div>
                <div style={{ flex: 1, background: fieldBoxBg, borderRadius: 12, padding: '13px 15px', boxShadow: isMobile ? '0 8px 20px -12px rgba(0,0,0,.3)' : 'none' }}>
                  <div style={{ fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>{t.lblFlightDate}</div>
                  <input placeholder={t.phFlightDate} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#16202e', background: 'transparent' }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/flight-status')}
                style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, background: '#1668c4', color: '#fff', fontSize: '13.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.btnViewStatus}
              </button>
            </div>
          )}
        </div>
      </div>

      {!isMobile && (
        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 15 }}>
            <span style={{ fontSize: '14.5px', color: '#0d2640', fontWeight: 800, whiteSpace: 'nowrap' }}>{t.popularRoutesTitle}</span>
            <span style={{ fontSize: '11.5px', color: '#5a6678' }}>{t.popularRoutesSub}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {popularRoutes.map((r) => (
              <button
                type="button"
                key={`${r.fromCode}-${r.toCode}`}
                data-testid={`popular-route-${r.toCode}`}
                onClick={() => navigate(`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`)}
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  background: '#fff',
                  border: '1px solid #e8eef6',
                  borderRadius: 12,
                  padding: '16px 11px',
                  boxShadow: '0 12px 28px -20px rgba(13,38,102,.45)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#16202e', whiteSpace: 'nowrap' }}>
                    {cityName(r.fromCode)} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>{locale === 'en' ? '→' : '←'}</span> {cityName(r.toCode)}
                  </span>
                  <PlaneIcon />
                </div>
                <div style={{ fontSize: 11, color: '#9aa4b2' }}>
                  {t.fromPrice}{' '}
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1668c4' }}>{formatToman(r.tomanPrice, locale)}</span>{' '}
                  {t.toman}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ marginTop: 30, position: 'relative', borderRadius: 18, overflow: 'hidden', minHeight: 150, boxShadow: '0 14px 34px -22px rgba(13,38,102,.4)', background: 'linear-gradient(100deg,#0d2666 0%,#1668c4 60%,#3f8ede 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(13,38,102,.92) 10%,rgba(22,104,196,.55) 60%,rgba(22,104,196,.15) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 2, padding: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff22', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: '10.5px', fontWeight: 700, marginBottom: 11 }}>
              {t.airlineBadge}
            </div>
            <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#fff', marginBottom: 7, lineHeight: 1.5 }}>{t.airlineTitle}</div>
            <p style={{ fontSize: 12, color: '#cfe0f5', margin: '0 0 15px', lineHeight: 1.8, maxWidth: 280 }}>{t.airlineSub}</p>
            <button
              type="button"
              onClick={() => navigate('/destinations')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#0d2640', padding: '9px 18px', borderRadius: 11, fontSize: '12.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.airlineBtn} <span>{locale === 'en' ? '→' : '←'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
