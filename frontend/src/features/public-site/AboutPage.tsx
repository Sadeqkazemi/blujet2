import PublicPageShell from '../../components/public/PublicPageShell';

// درباره ما — static content matching design-reference/درباره ما.dc.html.

const STATS = [
  { value: '۴.۸M', label: 'مسافر سالانه' },
  { value: '۳۲۰+', label: 'مسیر پروازی' },
  { value: '۴۵', label: 'ایرلاین طرف قرارداد' },
  { value: '۲۴/۷', label: 'پشتیبانی' },
];

const VALUES = [
  { icon: '◎', title: 'شفافیت', desc: 'بدون هزینهٔ پنهان؛ قیمت نهایی همان است که می‌بینید.', bg: '#eef4fb', color: '#1668c4' },
  { icon: '⚡', title: 'سرعت', desc: 'خرید بلیط در کمتر از دو دقیقه و صدور آنی.', bg: '#fff7e6', color: '#caa53a' },
  { icon: '🛡', title: 'اعتماد', desc: 'درگاه پرداخت امن و حفاظت کامل از اطلاعات مسافران.', bg: '#e8f5ee', color: '#1f8a5b' },
];

export default function AboutPage() {
  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '45px 22px 60px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: '#ffffff22', border: '1px solid #ffffff44', padding: '6px 12px', borderRadius: 28, fontSize: '11.5px', fontWeight: 700, marginBottom: 18 }}>
            درباره blujet
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 14px', letterSpacing: '-.6px' }}>سفر را ساده، مطمئن و در دسترس می‌کنیم</h1>
          <p style={{ fontSize: 14, color: '#c9dcf3', margin: 0, lineHeight: 1.95 }}>
            blujet یک پلتفرم رزرو آنلاین بلیط هواپیماست که از سال ۱۳۹۲ با هدف ساده‌سازی تجربهٔ سفر هوایی برای مسافران ایرانی فعالیت می‌کند.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: '-30px auto 0', padding: '0 22px', position: 'relative' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, boxShadow: '0 18px 40px -22px rgba(13,38,102,.3)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ padding: 18, textAlign: 'center', borderLeft: '1px solid #f2f4f7' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#1668c4' }}>{s.value}</div>
              <div style={{ fontSize: '11.5px', color: '#6b7585', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '37px 22px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '22px 24px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eef4fb', color: '#1668c4', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}>
            🎯
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 9px' }}>مأموریت ما</h2>
          <p style={{ fontSize: 12.5, color: '#5a6678', margin: 0, lineHeight: 2 }}>
            دسترس‌پذیر کردن سفر هوایی با شفاف‌ترین قیمت‌ها، فرایند خرید بدون پیچیدگی و خدماتی که در تمام مراحل سفر کنار مسافر است.
          </p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '22px 24px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff7e6', color: '#caa53a', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}>
            🔭
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 9px' }}>چشم‌انداز</h2>
          <p style={{ fontSize: 12.5, color: '#5a6678', margin: 0, lineHeight: 2 }}>
            تبدیل‌شدن به مرجع نخست رزرو سفر در منطقه با اتکا به فناوری، صداقت در قیمت‌گذاری و تجربهٔ کاربری بی‌نقص.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 22px 55px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0d2640', margin: '0 0 18px', textAlign: 'center' }}>ارزش‌های ما</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {VALUES.map((v) => (
            <div key={v.title} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: v.bg, color: v.color, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                {v.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', marginBottom: 7 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: '#6b7585', lineHeight: 1.9 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
