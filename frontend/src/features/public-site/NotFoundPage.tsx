import { Link } from 'react-router-dom';
import { faDigits } from '../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { DIR, FONT } from '../../lib/i18n';

// صفحه 404 — visual parity with design-reference-v2/صفحه 404.dc.html
const STR: Record<
  StoredLocale,
  {
    title: string;
    body: string;
    homeLink: string;
    searchLink: string;
    errorCodeLabel: string;
    errorCodeSuffix: string;
  }
> = {
  fa: {
    title: 'صفحه‌ای که دنبالش بودید پیدا نشد',
    body: 'به نظر می‌رسد این پرواز از مسیر خارج شده است. آدرس واردشده اشتباه است یا این صفحه جابه‌جا شده. می‌توانید به صفحهٔ اصلی برگردید یا پروازتان را دوباره جستجو کنید.',
    homeLink: 'بازگشت به صفحهٔ اصلی',
    searchLink: 'جستجوی پرواز',
    errorCodeLabel: 'کد خطا',
    errorCodeSuffix: 'صفحه یافت نشد',
  },
  en: {
    title: "The page you're looking for wasn't found",
    body: 'It looks like this flight went off course. The address you entered is wrong, or this page has moved. You can go back to the homepage or search for your flight again.',
    homeLink: 'Back to homepage',
    searchLink: 'Search flights',
    errorCodeLabel: 'Error code',
    errorCodeSuffix: 'Page not found',
  },
  ar: {
    title: 'الصفحة التي تبحث عنها غير موجودة',
    body: 'يبدو أن هذه الرحلة خرجت عن مسارها. العنوان الذي أدخلته خاطئ أو تم نقل هذه الصفحة. يمكنك العودة إلى الصفحة الرئيسية أو البحث عن رحلتك مجددًا.',
    homeLink: 'العودة إلى الصفحة الرئيسية',
    searchLink: 'البحث عن رحلة',
    errorCodeLabel: 'رمز الخطأ',
    errorCodeSuffix: 'الصفحة غير موجودة',
  },
};

function format404(locale: StoredLocale): string {
  if (locale === 'fa') return faDigits('404');
  if (locale === 'ar') return '٤٠٤';
  return '404';
}

export default function NotFoundPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const dir = DIR[locale];
  const font = FONT[locale];
  const code = format404(locale);

  return (
    <>
      <style>{`
        @keyframes float404 {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes dash404 {
          to { stroke-dashoffset: -40; }
        }
      `}</style>
      <div
        dir={dir}
        data-testid="not-found-page"
        style={{
          fontFamily: font,
          minHeight: '100vh',
          background: '#f6f8fb',
          color: '#16202e',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header style={{ borderBottom: '1px solid #e9eef4', background: '#fff' }}>
          <div
            style={{
              maxWidth: 1180,
              margin: '0 auto',
              padding: '0 26px',
              height: 74,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#1668c4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 17,
                }}
              >
                ✈
              </div>
              <span style={{ fontWeight: 900, fontSize: 18 }}>blujet</span>
            </Link>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
            <div style={{ position: 'relative', marginBottom: 14, animation: 'float404 4s ease-in-out infinite' }}>
              <div
                data-testid="not-found-code"
                style={{
                  fontSize: 'clamp(80px, 26vw, 150px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: -4,
                  background: 'linear-gradient(120deg,#1668c4,#3b8ae0)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {code}
              </div>
              <svg
                viewBox="0 0 320 80"
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 8,
                  margin: '0 auto',
                  width: 'min(280px, 90%)',
                  height: 70,
                  overflow: 'visible',
                }}
              >
                <path
                  d="M20 60 C 90 60, 120 20, 180 26 C 240 32, 270 55, 300 30"
                  fill="none"
                  stroke="#c3d5ea"
                  strokeWidth="2.5"
                  strokeDasharray="6 8"
                  strokeLinecap="round"
                  style={{ animation: 'dash404 1.6s linear infinite' }}
                />
                <g transform="translate(296,28) rotate(28)">
                  <path d="M0 -9 L26 0 L0 9 L7 0 Z" fill="#1668c4" />
                </g>
              </svg>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 12px' }}>{t.title}</h1>
            <p style={{ fontSize: 14, color: '#5a6678', lineHeight: 2, margin: '0 0 28px' }}>{t.body}</p>

            <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 48,
                  padding: '0 24px',
                  background: '#1668c4',
                  color: '#fff',
                  borderRadius: 12,
                  fontSize: '13.5px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                {t.homeLink}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={dir === 'ltr' ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
                </svg>
              </Link>
              <Link
                to="/destinations"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 48,
                  padding: '0 24px',
                  background: '#fff',
                  border: '1.5px solid #d5e1f0',
                  color: '#0d2640',
                  borderRadius: 12,
                  fontSize: '13.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                {t.searchLink}
              </Link>
            </div>

            <div style={{ marginTop: 30, fontSize: 12, color: '#9aa4b2' }}>
              {t.errorCodeLabel}: {code} — {t.errorCodeSuffix}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
