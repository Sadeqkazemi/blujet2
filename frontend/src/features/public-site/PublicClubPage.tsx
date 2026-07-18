import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';

// Public marketing page for the customer club — content matches
// design-reference/باشگاه مشتریان.dc.html. The design's client-side "join"
// modal is replaced with a login link: membership on this stack is earned
// through real purchases (points ledger), not a free-text signup form.

const STATS = [
  { value: '۵٪', label: 'کش‌بک در هر خرید' },
  { value: '۲۰۰+', label: 'مقصد پروازی' },
  { value: '۳', label: 'سطح عضویت' },
  { value: '۲۴/۷', label: 'پشتیبانی اعضا' },
];

const TIERS = [
  {
    name: 'نقره‌ای',
    range: '۰ تا ۵٬۰۰۰ امتیاز',
    border: '#e6eaf0',
    head: 'linear-gradient(135deg,#9aa7b8,#6f7d90)',
    perks: ['۲٪ کش‌بک در هر خرید', 'جمع‌آوری امتیاز پایه', 'پشتیبانی اعضا', 'پیشنهادهای فصلی'],
  },
  {
    name: 'طلایی',
    range: '۵٬۰۰۰ تا ۱۵٬۰۰۰ امتیاز',
    border: '#caa53a',
    head: 'linear-gradient(135deg,#caa53a,#9a7d22)',
    perks: ['۵٪ کش‌بک در هر خرید', 'ارتقای رایگان به بیزنس', 'پذیرش اختصاصی فرودگاه', 'درخواست خودرو با تخفیف'],
  },
  {
    name: 'پلاتین',
    range: 'بالای ۱۵٬۰۰۰ امتیاز',
    border: '#1668c4',
    head: 'linear-gradient(135deg,#1668c4,#0d2640)',
    perks: ['۷٪ کش‌بک + هدایای ویژه', 'ارتقای تضمینی صندلی', 'لانژ اختصاصی فرودگاه', 'مدیر سفر اختصاصی'],
  },
];

const CARD_STEPS = [
  { num: '۱', title: 'کسب امتیاز', desc: 'با هر پرواز امتیاز جمع کنید تا به حد ۵٬۰۰۰ برسید.' },
  { num: '۲', title: 'ارسال درخواست', desc: 'درخواست صدور کارت برای ادمین سایت ارسال می‌شود.' },
  { num: '۳', title: 'ارجاع برای تأیید', desc: 'درخواست به رئیس هیئت مدیره یا مدیر ارشد ارجاع می‌شود.' },
  { num: '۴', title: 'صدور کارت', desc: 'پس از تأیید، کارت عضویت برای مسافر صادر می‌گردد.' },
];

const EARN = [
  { icon: '✈', title: 'پرواز کنید', desc: 'به ازای هر خرید بلیط امتیاز بگیرید.' },
  { icon: '%', title: 'کش‌بک بگیرید', desc: 'بخشی از مبلغ به کیف پول برمی‌گردد.' },
  { icon: '🎁', title: 'معرفی دوستان', desc: 'با دعوت دوستان امتیاز هدیه بگیرید.' },
  { icon: '★', title: 'ماموریت‌ها', desc: 'با تکمیل ماموریت‌ها امتیاز جمع کنید.' },
];

const SERVICES = [
  { icon: '🚗', title: 'درخواست خودرو', desc: 'رزرو خودرو فرودگاه تا مقصد با تخفیف ویژه اعضا.', bg: '#eef4fb', color: '#1668c4' },
  { icon: '↑', title: 'ارتقای صندلی', desc: 'ارتقای رایگان یا تخفیف‌دار به کلاس بیزنس.', bg: '#fff7e6', color: '#caa53a' },
  { icon: '⚑', title: 'پذیرش ویژه', desc: 'چک‌این سریع و پذیرش اختصاصی بدون صف.', bg: '#e8f5ee', color: '#1f8a5b' },
];

export default function PublicClubPage() {
  const { status, user } = useAuth();
  const loggedIn = status === 'authenticated' && user?.role === 'USER';

  return (
    <PublicPageShell>
      {/* HERO */}
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#1668c4)', color: '#fff', padding: '41px 22px 37px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: '#ffffff22', border: '1px solid #ffffff44', padding: '6px 12px', borderRadius: 28, fontSize: '11.5px', fontWeight: 700, marginBottom: 20 }}>
            باشگاه مشتریان blujet
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-.8px' }}>هر پرواز، یک قدم به مزایای بیشتر</h1>
          <p style={{ fontSize: '15.5px', color: '#d6e4f7', margin: '0 0 28px', lineHeight: 1.85 }}>
            با هر سفر امتیاز جمع کنید، کش‌بک بگیرید و از خدمات اختصاصی مثل ارتقای رایگان، پذیرش ویژه‌ی فرودگاه و درخواست خودرو بهره‌مند شوید.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {!loggedIn && (
              <Link
                to="/login"
                style={{ background: '#fff', color: '#1668c4', padding: '11px 24px', borderRadius: 12, fontSize: '13.5px', fontWeight: 800, textDecoration: 'none' }}
              >
                عضویت رایگان
              </Link>
            )}
            <Link
              to={loggedIn ? '/manage-booking' : '/login'}
              style={{ textDecoration: 'none', background: '#ffffff22', border: '1px solid #ffffff55', color: '#fff', padding: '11px 21px', borderRadius: 12, fontSize: '13.5px', fontWeight: 700 }}
            >
              حساب من
            </Link>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section style={{ maxWidth: 1320, margin: '-30px auto 0', padding: '0 26px', position: 'relative' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, boxShadow: '0 18px 40px -22px rgba(13,38,102,.3)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ padding: 16, textAlign: 'center', borderLeft: '1px solid #f2f4f7' }}>
              <div style={{ fontSize: 25, fontWeight: 900, color: '#1668c4' }}>{s.value}</div>
              <div style={{ fontSize: '11.5px', color: '#6b7585', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TIERS */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '37px 22px 14px' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <h2 style={{ fontSize: 27, fontWeight: 900, color: '#0d2640', margin: '0 0 10px' }}>سطوح عضویت</h2>
          <p style={{ fontSize: '13.5px', color: '#6b7585', margin: 0 }}>هر چه بیشتر پرواز کنید، به سطح بالاتر و مزایای بیشتر می‌رسید.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {TIERS.map((t) => (
            <div key={t.name} style={{ background: '#fff', border: `2px solid ${t.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ background: t.head, color: '#fff', padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{t.name}</div>
                <div style={{ fontSize: '11.5px', opacity: 0.9, marginTop: 4 }}>{t.range}</div>
              </div>
              <div style={{ padding: 15 }}>
                {t.perks.map((pk) => (
                  <div key={pk} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 12, color: '#3b4554' }}>
                    <span style={{ color: '#1f8a5b', fontWeight: 800 }}>✓</span>
                    {pk}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MEMBERSHIP CARD ISSUANCE */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 22px 14px' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-block', background: '#eef4fb', color: '#1668c4', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 800, marginBottom: 12 }}>
              صدور کارت عضویت
            </div>
            <h2 style={{ fontSize: '21.5px', fontWeight: 900, color: '#0d2640', margin: '0 0 10px' }}>با رسیدن به حد امتیاز، کارت بگیرید</h2>
            <p style={{ fontSize: 13, color: '#6b7585', lineHeight: 1.8, maxWidth: 680, margin: '0 auto' }}>
              به محض رسیدن به آستانه‌ی <b style={{ color: '#0d2640' }}>۵٬۰۰۰ امتیاز</b>، واجد شرایط دریافت کارت عضویت می‌شوید. درخواست شما برای ادمین سایت
              ارسال و سپس برای تأیید به رئیس هیئت مدیره یا مدیر ارشد ارجاع می‌شود؛ پس از تأیید، کارت برای مسافر صادر می‌گردد.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 11 }}>
            {CARD_STEPS.map((s) => (
              <div key={s.num} style={{ textAlign: 'center', background: '#f7faff', border: '1px solid #e6eefb', borderRadius: 15, padding: '18px 13px' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#1668c4', color: '#fff', fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 13px' }}>
                  {s.num}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0d2640', marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: '11.5px', color: '#6b7585', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EARN */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 22px 14px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0d2640', margin: '0 0 8px' }}>چطور امتیاز جمع کنم؟</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {EARN.map((e) => (
            <div key={e.title} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eef4fb', color: '#1668c4', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                {e.icon}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0d2640', marginBottom: 6 }}>{e.title}</div>
              <div style={{ fontSize: '11.5px', color: '#6b7585', lineHeight: 1.7 }}>{e.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MEMBER SERVICES */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 22px 47px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0d2640', margin: '0 0 8px' }}>خدمات اختصاصی اعضا</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {SERVICES.map((s) => (
            <div key={s.title} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: s.bg, color: s.color, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', marginBottom: 7 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#6b7585', lineHeight: 1.8 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
