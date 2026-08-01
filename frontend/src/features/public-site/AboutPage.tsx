import { useEffect, useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { fetchPublicSiteContent } from '../../api/settings';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';

// درباره ما — static content matching design-reference/درباره ما.dc.html
// (fa/en/ar all directly provided by the design bundle's own strings).

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const STATS: { value: Tr; label: Tr }[] = [
  { value: { fa: '۴.۸M', en: '4.8M', ar: '۴.۸M' }, label: { fa: 'مسافر سالانه', en: 'Passengers per year', ar: 'مسافر سنويًا' } },
  { value: { fa: '۳۲۰+', en: '320+', ar: '۳۲۰+' }, label: { fa: 'مسیر پروازی', en: 'Flight routes', ar: 'مسار طيران' } },
  { value: { fa: '۴۵', en: '45', ar: '۴۵' }, label: { fa: 'ایرلاین طرف قرارداد', en: 'Partner airlines', ar: 'شركة طيران شريكة' } },
  { value: { fa: '۲۴/۷', en: '24/7', ar: '۲۴/۷' }, label: { fa: 'پشتیبانی', en: 'Support', ar: 'الدعم' } },
];

const VALUES: { icon: string; title: Tr; desc: Tr; bg: string; color: string }[] = [
  { icon: '◎', title: { fa: 'شفافیت', en: 'Transparency', ar: 'الشفافية' }, desc: { fa: 'بدون هزینهٔ پنهان؛ قیمت نهایی همان است که می‌بینید.', en: 'No hidden fees — the final price is what you see.', ar: 'بدون رسوم خفية؛ السعر النهائي هو ما تراه.' }, bg: '#eef4fb', color: '#1668c4' },
  { icon: '⚡', title: { fa: 'سرعت', en: 'Speed', ar: 'السرعة' }, desc: { fa: 'خرید بلیط در کمتر از دو دقیقه و صدور آنی.', en: 'Ticket purchase in under two minutes with instant issuance.', ar: 'شراء التذكرة في أقل من دقيقتين مع إصدار فوري.' }, bg: '#fff7e6', color: '#caa53a' },
  { icon: '🛡', title: { fa: 'اعتماد', en: 'Trust', ar: 'الثقة' }, desc: { fa: 'درگاه پرداخت امن و حفاظت کامل از اطلاعات مسافران.', en: 'A secure payment gateway with full protection of passenger data.', ar: 'بوابة دفع آمنة وحماية كاملة لبيانات المسافرين.' }, bg: '#e8f5ee', color: '#1f8a5b' },
];

const STR: Record<StoredLocale, {
  eyebrow: string;
  heroTitle: string;
  heroDesc: string;
  missionTitle: string;
  missionDesc: string;
  visionTitle: string;
  visionDesc: string;
  valuesHeading: string;
}> = {
  fa: {
    eyebrow: 'درباره blujet',
    heroTitle: 'سفر را ساده، مطمئن و در دسترس می‌کنیم',
    heroDesc: 'blujet یک پلتفرم رزرو آنلاین بلیط هواپیماست که از سال ۱۳۹۲ با هدف ساده‌سازی تجربهٔ سفر هوایی برای مسافران ایرانی فعالیت می‌کند.',
    missionTitle: 'مأموریت ما',
    missionDesc: 'دسترس‌پذیر کردن سفر هوایی با شفاف‌ترین قیمت‌ها، فرایند خرید بدون پیچیدگی و خدماتی که در تمام مراحل سفر کنار مسافر است.',
    visionTitle: 'چشم‌انداز',
    visionDesc: 'تبدیل‌شدن به مرجع نخست رزرو سفر در منطقه با اتکا به فناوری، صداقت در قیمت‌گذاری و تجربهٔ کاربری بی‌نقص.',
    valuesHeading: 'ارزش‌های ما',
  },
  en: {
    eyebrow: 'About blujet',
    heroTitle: 'Making air travel simple, reliable, and accessible',
    heroDesc: 'blujet is an online flight booking platform that has been simplifying air travel for Iranian passengers since 2013.',
    missionTitle: 'Our Mission',
    missionDesc: 'Making air travel accessible with the most transparent pricing, an uncomplicated booking process, and services that stay with travelers at every step.',
    visionTitle: 'Our Vision',
    visionDesc: "Becoming the region's leading travel booking reference through technology, pricing honesty, and a flawless user experience.",
    valuesHeading: 'Our Values',
  },
  ar: {
    eyebrow: 'عن blujet',
    heroTitle: 'نجعل السفر الجوي بسيطًا وموثوقًا ومتاحًا',
    heroDesc: 'blujet منصة حجز تذاكر طيران عبر الإنترنت تعمل منذ عام ٢٠١٣ على تبسيط تجربة السفر الجوي للمسافرين الإيرانيين.',
    missionTitle: 'مهمتنا',
    missionDesc: 'إتاحة السفر الجوي بأكثر الأسعار شفافية، وعملية شراء بسيطة، وخدمات ترافق المسافر في كل مرحلة من رحلته.',
    visionTitle: 'الرؤية',
    visionDesc: 'أن نصبح المرجع الأول لحجز السفر في المنطقة عبر التكنولوجيا والصدق في التسعير وتجربة مستخدم لا تشوبها شائبة.',
    valuesHeading: 'قيمنا',
  },
};

export default function AboutPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [aboutText, setAboutText] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicSiteContent(locale)
      .then((res) => setAboutText(res.aboutUsText.trim() || null))
      .catch(() => {
        /* static fallback */
      });
  }, [locale]);

  const heroDesc = aboutText ?? t.heroDesc;
  const gridCols2 = isMobile ? '1fr' : '1fr 1fr';
  const gridCols3 = isMobile ? '1fr' : 'repeat(3,1fr)';
  const gridCols4 = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(135deg,#0d2640,#16406e)', color: '#fff', padding: '44px 22px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', color: '#7fa8da', fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
            {t.eyebrow}
          </div>
          <h1 style={{ fontSize: isMobile ? 26 : 32.5, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.4, letterSpacing: '-.6px' }}>{t.heroTitle}</h1>
          <p style={{ fontSize: '14.5px', color: '#aac4e2', margin: 0, lineHeight: 2 }}>
            {heroDesc}
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1320, margin: '-40px auto 0', padding: '0 26px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols4, gap: 15 }}>
          {STATS.map((s) => (
            <div key={s.label.fa} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 16, textAlign: 'center', boxShadow: '0 10px 30px -22px rgba(13,38,102,.5)' }}>
              <div style={{ fontSize: 27, fontWeight: 900, color: '#1668c4' }}>{s.value[locale]}</div>
              <div style={{ fontSize: '11.5px', color: '#8a96a6', marginTop: 5 }}>{s.label[locale]}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1320, margin: '48px auto 0', padding: '0 26px', display: 'grid', gridTemplateColumns: gridCols2, gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 21 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: '#eef4fb', color: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></svg>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0d2640', margin: '0 0 10px' }}>{t.missionTitle}</h2>
          <p style={{ fontSize: '12.5px', color: '#5a6678', margin: 0, lineHeight: 2 }}>
            {t.missionDesc}
          </p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 21 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: '#eef9f1', color: '#1f8a5b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></svg>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0d2640', margin: '0 0 10px' }}>{t.visionTitle}</h2>
          <p style={{ fontSize: '12.5px', color: '#5a6678', margin: 0, lineHeight: 2 }}>
            {t.visionDesc}
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1320, margin: '48px auto 0', padding: '0 26px 56px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0d2640', margin: '0 0 20px', textAlign: 'center' }}>{t.valuesHeading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols3, gap: 15 }}>
          {VALUES.map((v) => (
            <div key={v.title.fa} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: v.bg, color: v.color, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                {v.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d2640', marginBottom: 6 }}>{v.title[locale]}</div>
              <div style={{ fontSize: '11.5px', color: '#8a96a6', lineHeight: 1.9 }}>{v.desc[locale]}</div>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
