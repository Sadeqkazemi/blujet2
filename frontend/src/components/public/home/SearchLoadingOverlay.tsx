import type { StoredLocale } from '../../../hooks/useLocale';
import { airportDisplayName } from '../flight-search/airport-utils';
import type { Airport } from '../../../types/public-site';

const STR: Record<
  StoredLocale,
  { headline: string; prefix: string; mid: string; suffix: string }
> = {
  fa: {
    headline: 'پروازت را با blujet پیدا کن',
    prefix: 'blujet در حال جستجوی بهترین پروازها از',
    mid: 'به',
    suffix: 'برای شماست',
  },
  en: {
    headline: 'Find your flight with blujet',
    prefix: 'blujet is searching for the best flights from',
    mid: 'to',
    suffix: 'for you',
  },
  ar: {
    headline: 'اعثر على رحلتك مع blujet',
    prefix: 'blujet يبحث عن أفضل الرحلات من',
    mid: 'إلى',
    suffix: 'لك',
  },
};

interface SearchLoadingOverlayProps {
  locale: StoredLocale;
  visible: boolean;
  originCode: string;
  destCode: string;
  airports: Airport[];
}

/** design-reference-v2/صفحه اصلی.dc.html search loading overlay. */
export default function SearchLoadingOverlay({
  locale,
  visible,
  originCode,
  destCode,
  airports,
}: SearchLoadingOverlayProps) {
  if (!visible) return null;

  const t = STR[locale];
  const fromAirport = airports.find((a) => a.code === originCode);
  const toAirport = airports.find((a) => a.code === destCode);
  const fromName = fromAirport ? airportDisplayName(fromAirport, locale) : originCode;
  const toName = toAirport ? airportDisplayName(toAirport, locale) : destCode;

  return (
    <div
      data-testid="search-loading-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: 'rgba(246,248,251,.9)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#fff',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 30px 80px -24px rgba(13,38,64,.4)',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 210,
            background: 'linear-gradient(135deg,#1668c4,#0d2640)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.16,
              background:
                'radial-gradient(circle at 18% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 72% 22%, #fff 0 2px, transparent 3px)',
              backgroundSize: '120px 120px',
            }}
          />
          <div style={{ position: 'absolute', top: 26, right: 30, left: 30, color: '#fff', zIndex: 2 }}>
            <div style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-.5px', lineHeight: 1.5 }}>{t.headline}</div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'rgba(255,255,255,.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '35%',
                background: '#fff',
                animation: 'bjbar 1.4s ease-in-out infinite',
              }}
            />
          </div>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid #eef4fb',
              borderTopColor: '#1668c4',
              animation: 'bjspin 0.8s linear infinite',
              flex: 'none',
            }}
          />
          <div style={{ flex: 1, fontSize: 14, color: '#3b4554', fontWeight: 600 }}>
            {t.prefix} <b style={{ color: '#16202e' }}>{fromName}</b> {t.mid}{' '}
            <b style={{ color: '#16202e' }}>{toName}</b> {t.suffix}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bjspin { to { transform: rotate(360deg); } }
        @keyframes bjbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }
      `}</style>
    </div>
  );
}
