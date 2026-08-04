import { Link } from 'react-router-dom';
import { faDigits } from '../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { DIR, FONT } from '../../lib/i18n';

// صفحه تعمیر و نگهداری — visual parity with design-reference-v2/در حال تعمیر و نگهداری.dc.html
const STR: Record<
  StoredLocale,
  {
    badge: string;
    title: string;
    body: string;
    etaLabel: string;
    etaValue: string;
    supportLabel: string;
  }
> = {
  fa: {
    badge: 'در حال به‌روزرسانی',
    title: 'سایت در حال تعمیر و نگهداری است',
    body: 'برای بهبود سرویس و ارتقای سامانه، سایت به‌طور موقت در دسترس نیست. کمی بعد دوباره در خدمت شما خواهیم بود. از صبوری شما سپاسگزاریم.',
    etaLabel: 'زمان تقریبی بازگشت:',
    etaValue: `حدود ${faDigits(2)} ساعت آینده`,
    supportLabel: 'پشتیبانی',
  },
  en: {
    badge: 'Updating',
    title: 'The site is under maintenance',
    body: "We're temporarily offline to improve our service and upgrade the system. We'll be back shortly. Thank you for your patience.",
    etaLabel: 'Estimated return:',
    etaValue: `in about ${faDigits(2)} hours`,
    supportLabel: 'Support',
  },
  ar: {
    badge: 'جارٍ التحديث',
    title: 'الموقع قيد الصيانة',
    body: 'الموقع غير متاح مؤقتًا لتحسين الخدمة وتطوير النظام. سنعود قريبًا لخدمتكم. شكرًا لصبركم.',
    etaLabel: 'الوقت التقريبي للعودة:',
    etaValue: `خلال ${faDigits(2)} ساعات تقريبًا`,
    supportLabel: 'الدعم الفني',
  },
};

export default function MaintenancePage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const dir = DIR[locale];
  const font = FONT[locale];

  return (
    <>
      <style>{`
        @keyframes spinM {
          to { transform: rotate(360deg); }
        }
        @keyframes spinMr {
          to { transform: rotate(-360deg); }
        }
        @keyframes pulseM {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        dir={dir}
        data-testid="maintenance-page"
        style={{ fontFamily: font, minHeight: '100vh', background: '#f6f8fb', color: '#16202e', display: 'flex', flexDirection: 'column' }}
      >
        <header style={{ borderBottom: '1px solid #e9eef4', background: '#fff' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px', height: 74, display: 'flex', alignItems: 'center' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17 }}>✈</div>
              <span style={{ fontWeight: 900, fontSize: 18 }}>blujet</span>
            </Link>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
          <div style={{ maxWidth: 580, width: '100%', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 'clamp(100px, 32vw, 150px)', height: 'clamp(100px, 32vw, 150px)', margin: '0 auto 26px' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#1668c4" strokeWidth="1.4" style={{ animation: 'spinM 9s linear infinite', transformOrigin: 'center' }} aria-hidden>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
                  <circle cx="12" cy="12" r="4.5" />
                </svg>
              </div>
              <div style={{ position: 'absolute', top: -4, left: -2, opacity: 0.55 }}>
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#8fb4de" strokeWidth="1.5" style={{ animation: 'spinMr 6s linear infinite', transformOrigin: 'center' }} aria-hidden>
                  <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#b26b00',
                background: '#fff3dd',
                border: '1px solid #f4dfae',
                padding: '6px 14px',
                borderRadius: 20,
                marginBottom: 18,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0a020', animation: 'pulseM 1.4s ease-in-out infinite' }} />
              {t.badge}
            </span>

            <h1 style={{ fontSize: 'clamp(20px, 5.5vw, 25px)', fontWeight: 900, margin: '0 0 13px' }}>{t.title}</h1>
            <p style={{ fontSize: '13.5px', color: '#5a6678', lineHeight: 2, margin: '0 0 26px' }}>{t.body}</p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #e9eef4', borderRadius: 14, padding: '14px 18px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1668c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span style={{ fontSize: '12.5px', color: '#5a6678' }}>
                  {t.etaLabel} <b style={{ color: '#16202e' }}>{t.etaValue}</b>
                </span>
              </div>
              <div style={{ width: 1, height: 22, background: '#e9eef4' }} />
              <Link to="/contact" style={{ fontSize: '12.5px', fontWeight: 700, color: '#1668c4', textDecoration: 'none' }}>
                {t.supportLabel}
              </Link>
            </div>

            <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', fontSize: 12, color: '#9aa4b2' }}>
              <span dir="ltr">{faDigits('021-91000000')}</span>
              <span>·</span>
              <span dir="ltr">support@blujet.ir</span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
