import type { StoredLocale } from '../../../hooks/useLocale';

const LABEL: Record<StoredLocale, string> = {
  fa: 'نتایج جستجو',
  en: 'Search results',
  ar: 'نتائج البحث',
};

export interface ResultsMobileSubHeaderProps {
  locale: StoredLocale;
  onBack: () => void;
}

export default function ResultsMobileSubHeader({ locale, onBack }: ResultsMobileSubHeaderProps) {
  const backPath = locale === 'en' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';

  return (
    <div
      data-testid="results-mobile-subheader"
      style={{
        background: '#fff',
        borderBottom: '1px solid #eef1f5',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <button
        type="button"
        aria-label={locale === 'en' ? 'Back' : 'بازگشت'}
        onClick={onBack}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#f3f5f8',
          border: '1px solid #e6eaf0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0d2640',
          cursor: 'pointer',
          flex: 'none',
          padding: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={backPath} />
        </svg>
      </button>
      <span style={{ fontSize: 15, fontWeight: 800, color: '#16202e' }}>{LABEL[locale]}</span>
    </div>
  );
}
