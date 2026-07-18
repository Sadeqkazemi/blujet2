import { Link } from 'react-router-dom';
import { faDigits } from '../../lib/fa-format';

// صفحه 404 — matches design-reference/صفحه 404.dc.html.
export default function NotFoundPage() {
  return (
    <div dir="rtl" style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", minHeight: '100vh', background: 'linear-gradient(160deg,#0d2640 30%,#124a86)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 34 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✈</div>
          <span style={{ fontWeight: 900, fontSize: 18 }}>blujet</span>
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: '-4px', color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,.35)', marginBottom: 18 }}>
          {faDigits(404)}
        </div>
        <h1 style={{ fontSize: 23, fontWeight: 900, margin: '0 0 12px' }}>صفحه‌ای که دنبالش بودید پیدا نشد</h1>
        <p style={{ fontSize: 13.5, color: '#c9dcf3', lineHeight: 2, margin: '0 0 26px' }}>
          به نظر می‌رسد این پرواز از مسیر خارج شده است. آدرس واردشده اشتباه است یا این صفحه جابه‌جا شده. می‌توانید به صفحهٔ اصلی برگردید یا پروازتان را دوباره جستجو کنید.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 30 }}>
          <Link
            to="/"
            style={{ background: '#fff', color: '#1668c4', padding: '12px 26px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, textDecoration: 'none' }}
          >
            بازگشت به صفحهٔ اصلی
          </Link>
          <Link
            to="/destinations"
            style={{ background: '#ffffff22', border: '1px solid #ffffff55', color: '#fff', padding: '12px 23px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}
          >
            جستجوی پرواز
          </Link>
        </div>
        <div style={{ fontSize: 11, color: '#7d92ad' }}>کد خطا: {faDigits(404)} — صفحه یافت نشد</div>
      </div>
    </div>
  );
}
