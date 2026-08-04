import type { StoredLocale } from '../../../hooks/useLocale';
import { formatJalaliDate } from '../../../lib/jalali';

export interface ResultsSearchSummaryProps {
  locale: StoredLocale;
  origin: string;
  dest: string;
  date: string;
  returnDate?: string;
  adults: number;
  cabinLabel: string;
  title: string;
  changeSearchLabel: string;
  editShortLabel: string;
  isMobile: boolean;
  onEdit: () => void;
}

export default function ResultsSearchSummary({
  locale,
  origin,
  dest,
  date,
  returnDate,
  adults,
  cabinLabel,
  title,
  changeSearchLabel,
  editShortLabel,
  isMobile,
  onEdit,
}: ResultsSearchSummaryProps) {
  const arrow = locale === 'en' ? '→' : '←';
  const paxMeta =
    locale === 'en'
      ? `${adults} passenger${adults > 1 ? 's' : ''} · ${cabinLabel}`
      : locale === 'ar'
        ? `${adults} مسافر · ${cabinLabel}`
        : `${adults} مسافر · ${cabinLabel}`;

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e6eaf0' }}>
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: isMobile ? '12px 16px 14px' : '14px 26px 12px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 11 : 15, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: isMobile ? 44 : 58,
              height: isMobile ? 44 : 58,
              borderRadius: 15,
              background: '#eef4fb',
              color: '#1668c4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 19 : 25,
              flex: 'none',
            }}
          >
            ✈
          </div>
          <div style={{ lineHeight: 1.45, flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <h2
                style={{
                  fontSize: isMobile ? 16.5 : 21,
                  fontWeight: 900,
                  color: '#0d2640',
                  margin: '0 0 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </h2>
              {isMobile && (
                <button
                  type="button"
                  onClick={onEdit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: '#1668c4',
                    fontSize: 13,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    flex: 'none',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {editShortLabel} <span style={{ fontSize: 14 }}>✎</span>
                </button>
              )}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: '#3b4554',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: '#0d2640', fontWeight: 800 }} dir="ltr">
                {origin}
              </span>
              <span style={{ color: '#1668c4' }}>{arrow}</span>
              <span style={{ color: '#0d2640', fontWeight: 800 }} dir="ltr">
                {dest}
              </span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#cbd6e4' }} />
              <span>{formatJalaliDate(`${date}T12:00:00Z`)}</span>
              {returnDate && (
                <>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#cbd6e4' }} />
                  <span>
                    {formatJalaliDate(`${returnDate}T12:00:00Z`)}{' '}
                    {locale === 'en' ? 'return' : locale === 'ar' ? 'عودة' : 'برگشت'}
                  </span>
                </>
              )}
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#cbd6e4' }} />
              <span style={{ color: '#7a8696' }}>{paxMeta}</span>
            </div>
          </div>
        </div>
        {!isMobile && (
          <button
            type="button"
            onClick={onEdit}
            data-testid="change-search-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '12px 21px',
              border: '1.5px solid #1668c4',
              color: '#1668c4',
              borderRadius: 11,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: '#fff',
              fontFamily: 'inherit',
            }}
          >
            {changeSearchLabel} <span style={{ fontSize: 15.5 }}>✎</span>
          </button>
        )}
      </div>
    </div>
  );
}
