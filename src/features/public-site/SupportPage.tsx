import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { faDigits } from '../../lib/fa-format';

// Support / help-center page — content matches design-reference/پشتیبانی.dc.html.
// The ticket form mirrors the design's client-side behavior (no ticketing
// backend exists yet); the FAQ and contact channels are static content.

const CATS = [
  { icon: '🎫', color: '#1668c4', bg: '#eef4fb', title: 'رزرو و خرید بلیط', desc: 'مراحل خرید، پرداخت و دریافت بلیط' },
  { icon: '↩', color: '#d64545', bg: '#fbf0ef', title: 'استرداد و تغییر', desc: 'کنسلی، تغییر تاریخ و بازگشت وجه' },
  { icon: '🧳', color: '#1f8a5b', bg: '#eef9f1', title: 'بار و صندلی', desc: 'قوانین بار، انتخاب صندلی و خدمات' },
  { icon: '★', color: '#c47d1a', bg: '#fbf6ea', title: 'باشگاه مشتریان', desc: 'امتیازها، سطوح عضویت و مزایا' },
];

const FAQS = [
  {
    q: 'چگونه بلیط خود را استرداد کنم؟',
    a: 'از بخش «مدیریت رزرو» با وارد کردن کد رزرو و نام خانوادگی، بلیط را انتخاب و گزینهٔ استرداد را بزنید. مبلغ قابل بازگشت بر اساس قوانین نرخ بلیط محاسبه و حداکثر ظرف ۷۲ ساعت کاری به حساب شما واریز می‌شود.',
  },
  {
    q: 'چک‌این آنلاین از چه زمانی فعال می‌شود؟',
    a: 'چک‌این آنلاین از ۲۴ ساعت تا ۵ ساعت پیش از پرواز فعال است. پس از انجام چک‌این، کارت پرواز به‌صورت الکترونیکی برای شما صادر و قابل دانلود خواهد بود.',
  },
  {
    q: 'اگر پرداخت انجام شد ولی بلیط صادر نشد چه کنم؟',
    a: 'در صورت کسر وجه و عدم صدور بلیط، مبلغ به‌صورت خودکار طی ۲۴ تا ۷۲ ساعت به حساب شما بازمی‌گردد. برای پیگیری فوری می‌توانید تیکت ثبت کنید یا با پشتیبانی تماس بگیرید.',
  },
  {
    q: 'میزان بار مجاز هر بلیط چقدر است؟',
    a: 'در نرخ اکونومی ۲۰ کیلوگرم و در نرخ بیزنس ۴۰ کیلوگرم بار رایگان لحاظ می‌شود. بار اضافه را می‌توانید هنگام خرید یا از بخش خدمات اضافه خریداری کنید.',
  },
  {
    q: 'چگونه امتیاز باشگاه مشتریان جمع کنم؟',
    a: 'با هر خرید بلیط به‌صورت خودکار امتیاز دریافت می‌کنید. امتیازها قابل تبدیل به تخفیف، ارتقای صندلی و بار اضافه هستند و در پنل کاربری قابل مشاهده‌اند.',
  },
];

const SUBJECTS = ['استرداد و تغییر بلیط', 'مشکل در پرداخت', 'بار و چک‌این', 'باشگاه مشتریان', 'سایر موارد'];

export default function SupportPage() {
  const [q, setQ] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const query = q.trim();
  const visibleFaqs = query ? FAQS.filter((f) => f.q.includes(query) || f.a.includes(query)) : FAQS;

  return (
    <PublicPageShell>
      {/* HERO + SEARCH */}
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '45px 22px 41px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 12px', letterSpacing: '-.6px' }}>چطور می‌توانیم کمک کنیم؟</h1>
          <p style={{ fontSize: 14, color: '#c9dcf3', margin: '0 0 24px', lineHeight: 1.9 }}>
            پاسخ پرسش‌های متداول را پیدا کنید یا با تیم پشتیبانی ۲۴ ساعته در ارتباط باشید.
          </p>
          <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 14, boxShadow: '0 22px 50px -18px rgba(0,0,0,.4)', padding: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa4b2" strokeWidth="2.2" strokeLinecap="round" style={{ marginRight: 9, flex: 'none' }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="سؤال خود را جستجو کنید…"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: '#16202e', minWidth: 0 }}
            />
            <span style={{ flex: 'none', background: '#1668c4', color: '#fff', fontSize: 12, fontWeight: 800, padding: '10px 19px', borderRadius: 10 }}>جستجو</span>
          </div>
        </div>
      </section>

      {/* CATEGORY CARDS */}
      <section style={{ maxWidth: 1180, margin: '-26px auto 0', padding: '0 22px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13 }}>
          {CATS.map((c) => (
            <div key={c.title} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 15, padding: '17px 15px', boxShadow: '0 14px 32px -20px rgba(13,38,102,.25)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, color: c.color, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 11 }}>
                {c.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: '#8a96a6', lineHeight: 1.7 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '33px 22px 47px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* FAQ */}
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0d2640', margin: '0 0 15px' }}>پرسش‌های متداول</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {visibleFaqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} style={{ background: '#fff', border: `1px solid ${open ? '#c9dcf3' : '#eef1f5'}`, borderRadius: 13, overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0d2640' }}>{f.q}</span>
                    <span style={{ color: '#1668c4', fontSize: 17, fontWeight: 800, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .15s', flex: 'none' }}>+</span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 16px 15px', fontSize: 12, color: '#5a6678', lineHeight: 2 }}>{f.a}</div>
                  )}
                </div>
              );
            })}
            {visibleFaqs.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 13, padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: '#8a96a6' }}>
                پرسشی مطابق جستجوی شما پیدا نشد
              </div>
            )}
          </div>

          {/* TICKET FORM */}
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: 20, marginTop: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>ثبت تیکت پشتیبانی</h3>
            <p style={{ fontSize: 12, color: '#8a96a6', margin: '0 0 15px', lineHeight: 1.8 }}>
              درخواست خود را ثبت کنید؛ کارشناسان ما حداکثر ظرف ۲ ساعت پاسخ می‌دهند.
            </p>
            {sent ? (
              <div style={{ background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '18px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: '#1f8a5b', marginBottom: 6 }}>✓</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640', marginBottom: 4 }}>تیکت شما ثبت شد</div>
                <div style={{ fontSize: 11.5, color: '#5a6678' }}>
                  کد پیگیری: <span dir="ltr">TK-{faDigits(8842)}</span>
                </div>
              </div>
            ) : (
              <>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e6eaf0', borderRadius: 10, fontFamily: 'inherit', fontSize: 12.5, color: '#16202e', marginBottom: 10, background: '#fff' }}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="توضیح درخواست خود را بنویسید…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e6eaf0', borderRadius: 10, fontFamily: 'inherit', fontSize: 12.5, color: '#16202e', marginBottom: 12, resize: 'vertical', boxSizing: 'border-box' }}
                />
                <button
                  onClick={() => {
                    if (msg.trim()) setSent(true);
                  }}
                  disabled={!msg.trim()}
                  style={{
                    background: msg.trim() ? '#1668c4' : '#aab8c8',
                    color: '#fff',
                    border: 'none',
                    padding: '11px 26px',
                    borderRadius: 11,
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: msg.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  ارسال تیکت
                </button>
              </>
            )}
          </div>
        </div>

        {/* DIRECT CONTACT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0d2640', margin: '0 0 3px' }}>تماس مستقیم</h2>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 15, padding: '16px 17px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef4fb', color: '#1668c4', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              ☎
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>تلفن ۲۴ ساعته</div>
              <div style={{ fontSize: 13, color: '#1668c4', fontWeight: 800, marginTop: 3 }} dir="ltr">
                ۰۲۱ — ۹۱۰۰۰۰۰۰
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 15, padding: '16px 17px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef9f1', color: '#1f8a5b', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              💬
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>گفتگوی آنلاین</div>
              <div style={{ fontSize: 11.5, color: '#1f8a5b', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b', display: 'inline-block' }} />
                هم‌اکنون آنلاین
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 15, padding: '16px 17px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fbf6ea', color: '#c47d1a', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              ✉
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>ایمیل</div>
              <div style={{ fontSize: 12, color: '#5a6678', marginTop: 3 }} dir="ltr">
                support@blujet.ir
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
