import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';

// تماس با ما — content matching design-reference/تماس با ما.dc.html; the
// message form mirrors the design's client-side mock behavior.

const CHANNELS = [
  { icon: '☎', bg: '#eef4fb', color: '#1668c4', title: 'تلفن پشتیبانی ۲۴ ساعته', value: '۰۲۱ — ۹۱۰۰۰۰۰۰', ltr: true },
  { icon: '✉', bg: '#fbf6ea', color: '#c47d1a', title: 'ایمیل', value: 'support@blujet.ir', ltr: true },
  { icon: '📍', bg: '#eef9f1', color: '#1f8a5b', title: 'دفتر مرکزی', value: 'تهران، خیابان ولیعصر، برج blujet، طبقه ۱۲', ltr: false },
  { icon: '🕑', bg: '#fbf0ef', color: '#d64545', title: 'ساعات کاری دفتر', value: 'شنبه تا چهارشنبه، ۸ تا ۱۷', ltr: false },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim() && msg.trim();

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '41px 22px 35px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>تماس با ما</h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>هر ساعت از شبانه‌روز پاسخگوی شما هستیم.</p>
      </section>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '31px 22px 55px', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CHANNELS.map((c) => (
            <div key={c.title} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 15, padding: '16px 17px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, color: c.color, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>{c.title}</div>
                <div style={{ fontSize: 12, color: '#5a6678', marginTop: 3 }} dir={c.ltr ? 'ltr' : undefined}>
                  {c.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>ارسال پیام</h2>
          <p style={{ fontSize: 12, color: '#8a96a6', margin: '0 0 16px', lineHeight: 1.8 }}>فرم را پر کنید؛ در سریع‌ترین زمان با شما تماس می‌گیریم.</p>

          {sent ? (
            <div data-testid="contact-sent" style={{ background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, color: '#1f8a5b', marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', marginBottom: 4 }}>پیام شما ارسال شد</div>
              <div style={{ fontSize: 11.5, color: '#5a6678' }}>کارشناسان ما به‌زودی با شما تماس می‌گیرند.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <input
                  data-testid="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="نام و نام خانوادگی"
                  style={{ padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 12.5, outline: 'none' }}
                />
                <input
                  data-testid="contact-phone"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="شماره تماس"
                  style={{ padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 12.5, outline: 'none' }}
                />
              </div>
              <textarea
                data-testid="contact-msg"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="متن پیام…"
                rows={5}
                style={{ padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 12.5, outline: 'none', resize: 'vertical' }}
              />
              <button
                type="button"
                data-testid="contact-submit"
                disabled={!canSubmit}
                onClick={() => setSent(true)}
                style={{ alignSelf: 'flex-start', border: 'none', borderRadius: 11, background: canSubmit ? '#1668c4' : '#aab8c8', color: '#fff', padding: '11px 26px', fontSize: 13, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                ارسال پیام
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicPageShell>
  );
}
