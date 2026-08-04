import { useEffect, useRef, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { formatToman } from '../../../lib/fa-format';
import type { CabinClass } from '../../../types/public-site';

const STR: Record<
  StoredLocale,
  {
    label: string;
    adults: string;
    adultsAge: string;
    children: string;
    childrenAge: string;
    infants: string;
    infantsAge: string;
    cabinClass: string;
    economy: string;
    business: string;
    confirm: string;
    pickDateFirst: string;
  }
> = {
  fa: {
    label: 'مسافران و کلاس',
    adults: 'بزرگسال',
    adultsAge: '۱۲ سال به بالا',
    children: 'کودک',
    childrenAge: '۲ تا ۱۲ سال',
    infants: 'نوزاد',
    infantsAge: 'زیر ۲ سال',
    cabinClass: 'کلاس پروازی',
    economy: 'اکونومی',
    business: 'بیزینس',
    confirm: 'تأیید',
    pickDateFirst: 'ابتدا تاریخ پرواز را انتخاب کنید',
  },
  en: {
    label: 'Passengers & class',
    adults: 'Adult',
    adultsAge: '12+ years',
    children: 'Child',
    childrenAge: '2–12 years',
    infants: 'Infant',
    infantsAge: 'Under 2 years',
    cabinClass: 'Cabin class',
    economy: 'Economy',
    business: 'Business',
    confirm: 'Confirm',
    pickDateFirst: 'Select a travel date first',
  },
  ar: {
    label: 'المسافرون والدرجة',
    adults: 'بالغ',
    adultsAge: '١٢ سنة فأكثر',
    children: 'طفل',
    childrenAge: 'من ٢ إلى ١٢ سنة',
    infants: 'رضيع',
    infantsAge: 'أقل من سنتين',
    cabinClass: 'درجة السفر',
    economy: 'اقتصادية',
    business: 'درجة الأعمال',
    confirm: 'تأكيد',
    pickDateFirst: 'اختر تاريخ السفر أولاً',
  },
};

export interface PassengerCabinState {
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
}

interface PassengerCabinPickerProps {
  value: PassengerCabinState;
  onChange: (next: PassengerCabinState) => void;
  locale: StoredLocale;
  enabled: boolean;
  testId?: string;
  /** Extra root styles (grid placement / mobile white-card look). */
  rootStyle?: React.CSSProperties;
}

function CounterRow({
  label,
  sub,
  count,
  onDec,
  onInc,
  locale,
}: {
  label: string;
  sub: string;
  count: number;
  onDec: () => void;
  onInc: () => void;
  locale: StoredLocale;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 0',
        borderBottom: '1px solid #f2f4f7',
      }}
    >
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#16202e' }}>{label}</div>
        <div style={{ fontSize: '10.5px', color: '#9aa4b2' }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <button type="button" onClick={onDec} style={counterBtnStyle}>
          −
        </button>
        <span style={{ width: 22, textAlign: 'center', fontWeight: 700, fontSize: '13.5px' }}>
          {formatToman(count, locale)}
        </span>
        <button type="button" onClick={onInc} style={counterBtnStyle}>
          +
        </button>
      </div>
    </div>
  );
}

const counterBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1.5px solid #d5dde7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#1668c4',
  fontSize: 18,
  cursor: 'pointer',
  background: '#fff',
  fontFamily: 'inherit',
};

export default function PassengerCabinPicker({
  value,
  onChange,
  locale,
  enabled,
  testId,
  rootStyle,
}: PassengerCabinPickerProps) {
  const t = STR[locale];
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const parts: string[] = [
    `${formatToman(value.adults, locale)} ${t.adults}`,
  ];
  if (value.children) parts.push(`${formatToman(value.children, locale)} ${t.children}`);
  if (value.infants) parts.push(`${formatToman(value.infants, locale)} ${t.infants}`);
  const cabinLabel = value.cabin === 'BUSINESS' ? t.business : t.economy;
  const summary = `${parts.join(' · ')} · ${cabinLabel}`;

  function setCabin(cabin: CabinClass) {
    onChange({ ...value, cabin });
  }

  return (
    <div
      ref={rootRef}
      style={{
        flex: '1.2 1 150px',
        minWidth: 150,
        position: 'relative',
        borderRight: isMobile ? 'none' : '1px solid #eef1f5',
        ...rootStyle,
      }}
    >
      <div
        data-testid={testId}
        onClick={() => enabled && setOpen((v) => !v)}
        style={{
          cursor: enabled ? 'pointer' : 'not-allowed',
          padding: '5px 13px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          opacity: enabled ? 1 : 0.45,
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
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          {t.label}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            fontWeight: 700,
            color: '#16202e',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {summary}
          <span style={{ color: '#9aa4b2', fontSize: 10 }}>▾</span>
        </div>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 38 }} />
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
                    padding: '5px 15px calc(15px + env(safe-area-inset-bottom))',
                    zIndex: 40,
                  }
                : {
                    position: 'absolute',
                    top: 74,
                    left: 0,
                    width: 312,
                    maxWidth: '88vw',
                    background: '#fff',
                    border: '1px solid #e6eaf0',
                    borderRadius: 14,
                    boxShadow: '0 18px 44px -12px rgba(13,38,102,.30)',
                    padding: '5px 15px 15px',
                    zIndex: 40,
                  }
            }
          >
            <CounterRow
              label={t.adults}
              sub={t.adultsAge}
              count={value.adults}
              locale={locale}
              onDec={() => onChange({ ...value, adults: Math.max(1, value.adults - 1) })}
              onInc={() => onChange({ ...value, adults: value.adults + 1 })}
            />
            <CounterRow
              label={t.children}
              sub={t.childrenAge}
              count={value.children}
              locale={locale}
              onDec={() => onChange({ ...value, children: Math.max(0, value.children - 1) })}
              onInc={() => onChange({ ...value, children: value.children + 1 })}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0' }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#16202e' }}>{t.infants}</div>
                <div style={{ fontSize: '10.5px', color: '#9aa4b2' }}>{t.infantsAge}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, infants: Math.max(0, value.infants - 1) })}
                  style={counterBtnStyle}
                >
                  −
                </button>
                <span style={{ width: 22, textAlign: 'center', fontWeight: 700, fontSize: '13.5px' }}>
                  {formatToman(value.infants, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, infants: value.infants + 1 })}
                  style={counterBtnStyle}
                >
                  +
                </button>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #eef1f5', marginTop: 6, paddingTop: 11 }}>
              <div style={{ fontSize: '11.5px', color: '#8a96a6', fontWeight: 600, marginBottom: 10 }}>
                {t.cabinClass}
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                {[(['ECONOMY', t.economy] as const), (['BUSINESS', t.business] as const)].map(([cab, lbl]) => {
                  const active = value.cabin === cab;
                  return (
                    <button
                      key={cab}
                      type="button"
                      data-testid={testId ? `${testId}-cabin-${cab}` : undefined}
                      onClick={() => setCabin(cab)}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '7px 0',
                        borderRadius: 9,
                        border: active ? '1.5px solid #1668c4' : '1.5px solid #e2e7ee',
                        background: active ? '#eef4fb' : '#fff',
                        color: active ? '#1668c4' : '#5a6678',
                        fontSize: '11.5px',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 16,
                width: '100%',
                height: 44,
                borderRadius: 10,
                background: '#1668c4',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
              }}
            >
              {t.confirm}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { STR as PASSENGER_PICKER_STR };
