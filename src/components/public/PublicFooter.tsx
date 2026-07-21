import { Link } from 'react-router-dom';

/** Public-site footer — matches design-reference/صفحه اصلی.dc.html exactly. */
export default function PublicFooter() {
  return (
    <footer style={{ background: '#0d2640', color: '#aebfd4', marginTop: 72 }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '39px 26px 20px',
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
          gap: 33,
        }}
      >
        <div>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
              ✈
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>blujet</span>
          </Link>
          <p style={{ fontSize: '13.5px', lineHeight: 1.85, margin: '0 0 20px', maxWidth: 300 }}>
            رزرو آنلاین بلیط پروازهای داخلی و بین‌المللی با بهترین قیمت و خدمات باشگاه مشتریان.
          </p>
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>خدمات</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
            <Link to="/results" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              رزرو پرواز
            </Link>
            <Link to="/manage-booking" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              مدیریت رزرو
            </Link>
            <Link to="/club" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              باشگاه مشتریان
            </Link>
            <Link to="/manage-booking" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              استرداد بلیط
            </Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>شرکت</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
            <Link to="/about" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              درباره ما
            </Link>
            <Link to="/contact" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              تماس با ما
            </Link>
            <Link to="/travel-info" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              قوانین و مقررات
            </Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>پشتیبانی</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
            <Link to="/support" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              مرکز راهنما
            </Link>
            <Link to="/support" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              سوالات متداول
            </Link>
            <span dir="ltr" style={{ textAlign: 'right' }}>
              ۰۲۱ — ۹۱۰۰۰۰۰۰
            </span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #ffffff12' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '15px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#7d92ad' }}>
          <span>© ۱۴۰۵ blujet. تمامی حقوق محفوظ است.</span>
        </div>
      </div>
    </footer>
  );
}
