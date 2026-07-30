import { Link } from 'react-router-dom';
import { faDigits } from '../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';

// صفحه 404 — matches design-reference/صفحه 404.dc.html. The design file
// has no isEN/isAR sample data for this page, so all EN/AR text here is
// hand-translated.
const STR: Record<StoredLocale, {
  title: string;
  body: string;
  homeLink: string;
  searchLink: string;
  errorCodeLabel: string;
  errorCodeSuffix: string;
}> = {
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

export default function NotFoundPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const dir = locale === 'en' ? 'ltr' : 'rtl';

  return (
    <div dir={dir} style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", minHeight: '100vh', background: 'linear-gradient(160deg,#0d2640 30%,#124a86)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 34 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✈</div>
          <span style={{ fontWeight: 900, fontSize: 18 }}>blujet</span>
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: '-4px', color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,.35)', marginBottom: 18 }}>
          {faDigits(404)}
        </div>
        <h1 style={{ fontSize: 23, fontWeight: 900, margin: '0 0 12px' }}>{t.title}</h1>
        <p style={{ fontSize: 13.5, color: '#c9dcf3', lineHeight: 2, margin: '0 0 26px' }}>{t.body}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 30 }}>
          <Link
            to="/"
            style={{ background: '#fff', color: '#1668c4', padding: '12px 26px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}
          >
            {t.homeLink}
          </Link>
          <Link
            to="/destinations"
            style={{ background: '#ffffff22', border: '1px solid #ffffff55', color: '#fff', padding: '12px 23px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}
          >
            {t.searchLink}
          </Link>
        </div>
        <div style={{ fontSize: 11, color: '#7d92ad' }}>
          {t.errorCodeLabel}: {faDigits(404)} — {t.errorCodeSuffix}
        </div>
      </div>
    </div>
  );
}
