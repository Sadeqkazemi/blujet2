import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';
import type { Airport } from '../../../types/public-site';
import { airportCityLabel, airportDisplayName } from './airport-utils';

const STR: Record<
  StoredLocale,
  { placeholder: string; listLabel: string; empty: string; pickOriginFirst: string }
> = {
  fa: {
    placeholder: 'نام شهر یا کد فرودگاه را بنویسید…',
    listLabel: 'شهرهای دارای فرودگاه',
    empty: 'شهری با این نام یافت نشد',
    pickOriginFirst: 'ابتدا شهر مبدا را انتخاب کنید',
  },
  en: {
    placeholder: 'Search city or airport code…',
    listLabel: 'Cities with airports',
    empty: 'No matching city found',
    pickOriginFirst: 'Select an origin city first',
  },
  ar: {
    placeholder: 'ابحث عن المدينة أو رمز المطار…',
    listLabel: 'مدن بها مطارات',
    empty: 'لم يتم العثور على مدينة مطابقة',
    pickOriginFirst: 'اختر مدينة المبدأ أولاً',
  },
};

interface AirportCityPickerProps {
  airports: Airport[];
  value: string;
  onChange: (code: string) => void;
  label: string;
  locale: StoredLocale;
  disabled?: boolean;
  excludeCode?: string;
  requireOriginFirst?: boolean;
  originSelected?: boolean;
  testId?: string;
  /** Extra root styles (grid placement / mobile white-card look). */
  rootStyle?: React.CSSProperties;
}

export default function AirportCityPicker({
  airports,
  value,
  onChange,
  label,
  locale,
  disabled = false,
  excludeCode,
  requireOriginFirst = false,
  originSelected = true,
  testId,
  rootStyle,
}: AirportCityPickerProps) {
  const t = STR[locale];
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => airports.find((a) => a.code === value),
    [airports, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports.filter((a) => {
      if (excludeCode && a.code === excludeCode) return false;
      if (!q) return true;
      const city = airportCityLabel(a, locale).toLowerCase();
      return city.includes(q) || a.code.toLowerCase().includes(q) || a.cityFa.includes(q);
    });
  }, [airports, excludeCode, locale, query]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function openPicker() {
    if (disabled) return;
    if (requireOriginFirst && !originSelected) return;
    setOpen(true);
  }

  const display = selected ? airportDisplayName(selected, locale) : null;
  const dim = requireOriginFirst && !originSelected ? 0.45 : 1;

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: '1.5 1 165px', minWidth: 165, ...rootStyle }}>
      <div
        data-testid={testId}
        onClick={openPicker}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '5px 20px 5px 13px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          opacity: dim,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#9aa4b2',
            fontWeight: 600,
            marginBottom: 3,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
            <circle cx="12" cy="11" r="2" />
          </svg>
          {label}
        </div>
        <div
          style={{
            fontSize: '14.5px',
            fontWeight: 800,
            color: display ? '#16202e' : '#9aa4b2',
          }}
        >
          {display ?? (locale === 'en' ? 'Select' : locale === 'ar' ? 'اختر' : 'انتخاب کنید')}
        </div>
      </div>

      {open && (
        <>
          <div
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 38 }}
          />
          <div
            style={
              isMobile
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
                    padding: '13px 13px calc(13px + env(safe-area-inset-bottom))',
                    zIndex: 40,
                  }
                : {
                    position: 'absolute',
                    top: 74,
                    right: 0,
                    width: 318,
                    maxWidth: '88vw',
                    background: '#fff',
                    border: '1px solid #e6eaf0',
                    borderRadius: 14,
                    boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)',
                    padding: 13,
                    zIndex: 40,
                  }
            }
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.placeholder}
              autoFocus
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
            <div style={{ fontSize: '10.5px', color: '#9aa4b2', fontWeight: 700, margin: '0 4px 6px' }}>
              {t.listLabel}
            </div>
            <div style={{ maxHeight: isMobile ? '50vh' : 248, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filtered.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  data-testid={testId ? `${testId}-option-${a.code}` : undefined}
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
                    textAlign: locale === 'en' ? 'left' : 'right',
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f2f6fb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.5.5 0 0 0-.5.8l3.9 4.2-2.5 2.5-2-.5a.4.4 0 0 0-.4.7l2.3 1.9 1.9 2.3a.4.4 0 0 0 .7-.4l-.5-2 2.5-2.5 4.2 3.9a.5.5 0 0 0 .8-.5z" />
                    </svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 700, color: '#16202e' }}>
                    {airportCityLabel(a, locale)}{' '}
                    <span dir="ltr" style={{ color: '#9aa4b2', fontWeight: 600 }}>
                      ({a.code})
                    </span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: 15, textAlign: 'center', fontSize: '11.5px', color: '#9aa4b2' }}>
                  {t.empty}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {requireOriginFirst && !originSelected && (
        <span style={{ display: 'none' }} aria-hidden>
          {t.pickOriginFirst}
        </span>
      )}
    </div>
  );
}
