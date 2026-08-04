import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { fetchClubPoints } from '../../api/publicSite';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { formatToman } from '../../lib/fa-format';

const TIER_LABEL: Record<string, Record<StoredLocale, string>> = {
  SILVER: { fa: 'نقره‌ای', en: 'Silver', ar: 'فضي' },
  GOLD: { fa: 'طلایی', en: 'Gold', ar: 'ذهبي' },
  PLATINUM: { fa: 'پلاتین', en: 'Platinum', ar: 'بلاتيني' },
};

// Public marketing page for the customer club — content matches
// design-reference/باشگاه مشتریان.dc.html. The design's client-side "join"
// modal is replaced with a login link: membership on this stack is earned
// through real purchases (points ledger), not a free-text signup form.

interface Item {
  value?: Record<StoredLocale, string>;
  title: Record<StoredLocale, string>;
  desc?: Record<StoredLocale, string>;
  icon?: string;
}

const STATS: Item[] = [
  { value: { fa: '۵٪', en: '5%', ar: '٥٪' }, title: { fa: 'کش‌بک در هر خرید', en: 'Cashback per purchase', ar: 'استرداد نقدي في كل عملية شراء' } },
  { value: { fa: '۲۰۰+', en: '200+', ar: '٢٠٠+' }, title: { fa: 'مقصد پروازی', en: 'Flight destinations', ar: 'وجهة طيران' } },
  { value: { fa: '۳', en: '3', ar: '٣' }, title: { fa: 'سطح عضویت', en: 'Membership tiers', ar: 'فئة العضوية' } },
  { value: { fa: '۲۴/۷', en: '24/7', ar: '٢٤/٧' }, title: { fa: 'پشتیبانی اعضا', en: 'Member support', ar: 'دعم الأعضاء' } },
];

interface Tier {
  name: Record<StoredLocale, string>;
  range: Record<StoredLocale, string>;
  border: string;
  head: string;
  accent: string;
  iconBg: string;
  tierIcon: string;
  popular?: boolean;
  perks: Record<StoredLocale, string>[];
}

const TIERS: Tier[] = [
  {
    name: { fa: 'نقره‌ای', en: 'Silver', ar: 'فضي' },
    range: { fa: '۰ تا ۵٬۰۰۰ امتیاز', en: '0–5,000 points', ar: 'من ٠ إلى ٥٬٠٠٠ نقطة' },
    border: '#e6eaf0',
    head: 'linear-gradient(135deg,#9aa7b8,#6f7d90)',
    accent: '#6f7d90',
    iconBg: '#eef1f5',
    tierIcon: '☆',
    perks: [
      { fa: '۲٪ کش‌بک در هر خرید', en: '2% cashback per purchase', ar: 'استرداد نقدي ٢٪ في كل عملية شراء' },
      { fa: 'جمع‌آوری امتیاز پایه', en: 'Base point accrual', ar: 'تجميع نقاط أساسي' },
      { fa: 'پشتیبانی اعضا', en: 'Member support', ar: 'دعم الأعضاء' },
      { fa: 'پیشنهادهای فصلی', en: 'Seasonal offers', ar: 'عروض موسمية' },
    ],
  },
  {
    name: { fa: 'طلایی', en: 'Gold', ar: 'ذهبي' },
    range: { fa: '۵٬۰۰۰ تا ۱۵٬۰۰۰ امتیاز', en: '5,000–15,000 points', ar: 'من ٥٬٠٠٠ إلى ١٥٬٠٠٠ نقطة' },
    border: '#caa53a',
    head: 'linear-gradient(135deg,#caa53a,#9a7d22)',
    accent: '#caa53a',
    iconBg: '#fff7e6',
    tierIcon: '★',
    popular: true,
    perks: [
      { fa: '۵٪ کش‌بک در هر خرید', en: '5% cashback per purchase', ar: 'استرداد نقدي ٥٪ في كل عملية شراء' },
      { fa: 'ارتقای رایگان به بیزنس', en: 'Free upgrade to Business', ar: 'ترقية مجانية إلى درجة الأعمال' },
      { fa: 'پذیرش اختصاصی فرودگاه', en: 'Dedicated airport reception', ar: 'تسجيل وصول مخصص في المطار' },
      { fa: 'درخواست خودرو با تخفیف', en: 'Discounted car requests', ar: 'طلب سيارة بخصم' },
    ],
  },
  {
    name: { fa: 'پلاتین', en: 'Platinum', ar: 'بلاتيني' },
    range: { fa: 'بالای ۱۵٬۰۰۰ امتیاز', en: 'Above 15,000 points', ar: 'أكثر من ١٥٬٠٠٠' },
    border: '#1668c4',
    head: 'linear-gradient(135deg,#1668c4,#0d2640)',
    accent: '#1668c4',
    iconBg: '#eef4fb',
    tierIcon: '◆',
    perks: [
      { fa: '۷٪ کش‌بک + هدایای ویژه', en: '7% cashback + special gifts', ar: 'استرداد نقدي ٧٪ + هدايا خاصة' },
      { fa: 'ارتقای تضمینی صندلی', en: 'Guaranteed seat upgrade', ar: 'ترقية مقعد مضمونة' },
      { fa: 'لانژ اختصاصی فرودگاه', en: 'Exclusive airport lounge', ar: 'صالة مطار حصرية' },
      { fa: 'مدیر سفر اختصاصی', en: 'Dedicated travel manager', ar: 'مدير سفر مخصص' },
    ],
  },
];

const CARD_STEPS: Item[] = [
  { value: { fa: '۱', en: '1', ar: '١' }, title: { fa: 'کسب امتیاز', en: 'Earn Points', ar: 'كسب النقاط' }, desc: { fa: 'با هر پرواز امتیاز جمع کنید تا به حد ۵٬۰۰۰ برسید.', en: 'Collect points on every flight until you reach 5,000.', ar: 'اجمع نقاطًا مع كل رحلة حتى تبلغ ٥٬٠٠٠ نقطة.' } },
  { value: { fa: '۲', en: '2', ar: '٢' }, title: { fa: 'ارسال درخواست', en: 'Submit Request', ar: 'إرسال الطلب' }, desc: { fa: 'درخواست صدور کارت برای ادمین سایت ارسال می‌شود.', en: 'Your card request is sent to the site admin.', ar: 'يُرسل طلب إصدار البطاقة إلى مسؤول الموقع.' } },
  { value: { fa: '۳', en: '3', ar: '٣' }, title: { fa: 'ارجاع برای تأیید', en: 'Referred for Approval', ar: 'الإحالة للموافقة' }, desc: { fa: 'ادمین درخواست را به رئیس هیئت مدیره یا مدیر ارشد ارجاع می‌دهد.', en: 'The admin refers the request to the Board Chair or Senior Manager.', ar: 'يحيل المسؤول الطلب إلى رئيس مجلس الإدارة أو المدير الأول.' } },
  { value: { fa: '۴', en: '4', ar: '٤' }, title: { fa: 'صدور کارت', en: 'Card Issued', ar: 'إصدار البطاقة' }, desc: { fa: 'پس از تأیید، کارت عضویت برای مسافر صادر می‌شود.', en: 'Once approved, the membership card is issued to the traveler.', ar: 'بعد الموافقة، تُصدر بطاقة العضوية للمسافر.' } },
];

const EARN: Item[] = [
  { icon: '✈', title: { fa: 'پرواز کنید', en: 'Fly', ar: 'سافر' }, desc: { fa: 'به ازای هر خرید بلیط امتیاز بگیرید.', en: 'Earn points with every ticket purchase.', ar: 'احصل على نقاط مع كل عملية شراء تذكرة.' } },
  { icon: '%', title: { fa: 'کش‌بک بگیرید', en: 'Get Cashback', ar: 'احصل على استرداد نقدي' }, desc: { fa: 'بخشی از مبلغ به کیف پول برمی‌گردد.', en: 'A portion of your payment returns to your wallet.', ar: 'يعود جزء من المبلغ إلى محفظتك.' } },
  { icon: '🎁', title: { fa: 'معرفی دوستان', en: 'Refer Friends', ar: 'دعوة الأصدقاء' }, desc: { fa: 'با دعوت دوستان امتیاز هدیه بگیرید.', en: 'Invite friends and earn bonus points.', ar: 'ادعُ أصدقاءك واحصل على نقاط إضافية.' } },
  { icon: '★', title: { fa: 'ماموریت‌ها', en: 'Missions', ar: 'المهام' }, desc: { fa: 'با تکمیل ماموریت‌ها امتیاز جمع کنید.', en: 'Complete missions to earn more points.', ar: 'أكمل المهام لجمع المزيد من النقاط.' } },
];

const SERVICES: (Item & { grad: string; shadow: string; blob: string })[] = [
  {
    icon: '🚗',
    title: { fa: 'درخواست خودرو', en: 'Car Request', ar: 'طلب سيارة' },
    desc: { fa: 'رزرو خودرو فرودگاه تا مقصد با تخفیف ویژه اعضا.', en: 'Book airport-to-destination car service at a special member discount.', ar: 'حجز سيارة من المطار إلى الوجهة بخصم خاص للأعضاء.' },
    grad: 'linear-gradient(135deg,#1668c4,#0d3b66)',
    shadow: '0 10px 24px -8px rgba(22,104,196,.45)',
    blob: '#eef4fb',
  },
  {
    icon: '↑',
    title: { fa: 'ارتقای صندلی', en: 'Seat Upgrade', ar: 'ترقية المقعد' },
    desc: { fa: 'ارتقای رایگان یا تخفیف‌دار به کلاس بیزنس.', en: 'Free or discounted upgrade to Business class.', ar: 'ترقية مجانية أو بخصم إلى درجة الأعمال.' },
    grad: 'linear-gradient(135deg,#caa53a,#9a7d22)',
    shadow: '0 10px 24px -8px rgba(202,165,58,.45)',
    blob: '#fff7e6',
  },
  {
    icon: '⚑',
    title: { fa: 'پذیرش ویژه', en: 'Priority Reception', ar: 'استقبال خاص' },
    desc: { fa: 'چک‌این سریع و پذیرش اختصاصی بدون صف.', en: 'Fast check-in and dedicated reception with no queues.', ar: 'تسجيل وصول سريع واستقبال حصري دون طابور.' },
    grad: 'linear-gradient(135deg,#1f8a5b,#0e4a30)',
    shadow: '0 10px 24px -8px rgba(31,138,91,.45)',
    blob: '#e8f5ee',
  },
];

const STR: Record<StoredLocale, {
  heroBadge: string;
  heroTitle: string;
  heroDesc: string;
  joinFree: string;
  myAccount: string;
  tiersHeading: string;
  tiersSub: string;
  cardBadge: string;
  cardHeading: string;
  earnHeading: string;
  servicesHeading: string;
  memberPointsLabel: string;
  mostPopular: string;
  cardIntroPre: string;
  cardThresholdPoints: string;
  cardIntroPost: string;
  silverCardLabel: string;
  goldCardLabel: string;
  platCardLabel: string;
  silverRange: string;
  goldRange: string;
  platRange: string;
  requestCard: string;
  samanChip: string;
  samanHeading: string;
  samanSub: string;
  samanPlaceholder: string;
  samanSubmit: string;
  ctaHeading: string;
  ctaDesc: string;
  ctaButton: string;
}> = {
  fa: {
    heroBadge: 'باشگاه مشتریان blujet',
    heroTitle: 'هر پرواز، یک قدم به مزایای بیشتر',
    heroDesc: 'با هر سفر امتیاز جمع کنید، کش‌بک بگیرید و از خدمات اختصاصی مثل ارتقای رایگان، پذیرش ویژه‌ی فرودگاه و درخواست خودرو بهره‌مند شوید.',
    joinFree: 'عضویت رایگان',
    myAccount: 'حساب من',
    tiersHeading: 'سطوح عضویت',
    tiersSub: 'هر چه بیشتر پرواز کنید، به سطح بالاتر و مزایای بیشتر می‌رسید.',
    cardBadge: 'صدور کارت بلوجت',
    cardHeading: 'با رسیدن به حد امتیاز، کارت بگیرید',
    earnHeading: 'چطور امتیاز بگیرم؟',
    servicesHeading: 'خدمات ویژه‌ی اعضا',
    memberPointsLabel: 'امتیاز باشگاه',
    mostPopular: 'پرکاربردترین',
    cardIntroPre: 'به محض رسیدن به آستانه‌ی',
    cardThresholdPoints: '۵٬۰۰۰ امتیاز',
    cardIntroPost: '، واجد شرایط دریافت کارت عضویت می‌شوید. درخواست شما برای ادمین سایت ارسال و سپس برای تأیید به رئیس هیئت مدیره یا مدیر ارشد ارجاع می‌شود؛ پس از تأیید، کارت برای مسافر صادر می‌گردد.',
    silverCardLabel: 'کارت نقره‌ای',
    goldCardLabel: 'کارت طلایی',
    platCardLabel: 'کارت پلاتین',
    silverRange: '۰–۵٬۰۰۰ امتیاز',
    goldRange: '۵٬۰۰۰–۱۵٬۰۰۰',
    platRange: '۱۵٬۰۰۰+',
    requestCard: 'درخواست صدور کارت',
    samanChip: 'SAMAN',
    samanHeading: 'خرید اقساطی بلیط با کارت بانک سامان',
    samanSub: 'شماره کارت بانک سامان خود را وارد کنید تا از امکان خرید اقساطی بلیط بهره‌مند شوید.',
    samanPlaceholder: 'شماره ۱۶ رقمی کارت',
    samanSubmit: 'ثبت کارت',
    ctaHeading: 'همین حالا عضو طلایی شوید',
    ctaDesc: 'با اولین خرید بلیط، عضو باشگاه مشتریان blujet شوید و از کش‌بک و مزایای اختصاصی بهره‌مند شوید.',
    ctaButton: 'عضویت رایگان',
  },
  en: {
    heroBadge: 'blujet Loyalty Club',
    heroTitle: 'Every flight, one step closer to more rewards',
    heroDesc: 'Earn points on every trip, get cashback, and enjoy exclusive perks like free upgrades, priority airport service, and car requests.',
    joinFree: 'Join for Free',
    myAccount: 'My Account',
    tiersHeading: 'Membership Tiers',
    tiersSub: 'The more you fly, the higher your tier and the greater your rewards.',
    cardBadge: 'blujet Card Issuance',
    cardHeading: 'Reach the point threshold, get your card',
    earnHeading: 'How do I earn points?',
    servicesHeading: 'Exclusive Member Services',
    memberPointsLabel: 'Club points',
    mostPopular: 'Most Popular',
    cardIntroPre: 'Once you reach the',
    cardThresholdPoints: '5,000-point',
    cardIntroPost: ' threshold, you become eligible for a membership card. Your request is sent to the site admin and then referred to the Board Chair or Senior Manager for approval; once approved, the card is issued to the traveler.',
    silverCardLabel: 'Silver card',
    goldCardLabel: 'Gold card',
    platCardLabel: 'Platinum card',
    silverRange: '0–5,000 pts',
    goldRange: '5,000–15,000',
    platRange: '15,000+',
    requestCard: 'Request Card Issuance',
    samanChip: 'SAMAN',
    samanHeading: 'Buy tickets in installments with your Saman Bank card',
    samanSub: 'Enter your Saman Bank card number to unlock installment ticket purchases.',
    samanPlaceholder: '16-digit card number',
    samanSubmit: 'Register card',
    ctaHeading: 'Become a Gold Member Today',
    ctaDesc: 'Join the blujet Loyalty Club with your first ticket purchase and enjoy cashback and exclusive perks.',
    ctaButton: 'Join for Free',
  },
  ar: {
    heroBadge: 'نادي عملاء blujet',
    heroTitle: 'كل رحلة خطوة أقرب لمزايا أكبر',
    heroDesc: 'اجمع نقاطًا مع كل رحلة، احصل على استرداد نقدي، واستمتع بخدمات حصرية مثل الترقية المجانية واستقبال مطار خاص وطلب السيارة.',
    joinFree: 'انضمام مجاني',
    myAccount: 'حسابي',
    tiersHeading: 'فئات العضوية',
    tiersSub: 'كلما زاد سفرك، ارتقيت إلى فئة أعلى وحصلت على مزايا أكبر.',
    cardBadge: 'إصدار بطاقة blujet',
    cardHeading: 'عند بلوغ حد النقاط، احصل على بطاقتك',
    earnHeading: 'كيف أجمع النقاط؟',
    servicesHeading: 'خدمات حصرية للأعضاء',
    memberPointsLabel: 'نقاط النادي',
    mostPopular: 'الأكثر شيوعًا',
    cardIntroPre: 'بمجرد بلوغ عتبة',
    cardThresholdPoints: '٥٬٠٠٠ نقطة',
    cardIntroPost: '، تصبح مؤهلاً للحصول على بطاقة العضوية. يُرسل طلبك إلى مسؤول الموقع ثم يُحال إلى رئيس مجلس الإدارة أو المدير الأول للموافقة؛ وبعد الموافقة، تُصدر البطاقة للمسافر.',
    silverCardLabel: 'بطاقة فضية',
    goldCardLabel: 'بطاقة ذهبية',
    platCardLabel: 'بطاقة بلاتينية',
    silverRange: '٠–٥٬٠٠٠',
    goldRange: '٥٬٠٠٠–١٥٬٠٠٠',
    platRange: '١٥٬٠٠٠+',
    requestCard: 'طلب إصدار البطاقة',
    samanChip: 'SAMAN',
    samanHeading: 'شراء التذاكر بالتقسيط ببطاقة بنك سامان',
    samanSub: 'أدخل رقم بطاقة بنك سامان للاستفادة من شراء التذاكر بالتقسيط.',
    samanPlaceholder: 'رقم البطاقة المكوّن من 16 رقمًا',
    samanSubmit: 'تسجيل البطاقة',
    ctaHeading: 'انضم كعضو ذهبي اليوم',
    ctaDesc: 'انضم إلى نادي blujet مع أول عملية شراء تذكرة واستمتع بالاسترداد النقدي والمزايا الحصرية.',
    ctaButton: 'انضمام مجاني',
  },
};

export default function PublicClubPage() {
  const { status, user } = useAuth();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const loggedIn = status === 'authenticated' && user?.role === 'USER';
  const [club, setClub] = useState<{ isMember: boolean; level: string | null; balance: number } | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    fetchClubPoints()
      .then(setClub)
      .catch(() => setClub(null));
  }, [loggedIn]);

  const gridCols3 = isMobile ? '1fr' : 'repeat(3,1fr)';
  const gridCols4 = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  return (
    <PublicPageShell>
      {/* Logged-in member status (design's member state) */}
      {loggedIn && club?.isMember && (
        <div data-testid="club-member-banner" style={{ background: '#0d2640' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 22px', flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
              {user?.fullName} — <span style={{ color: '#e7c66b' }}>★ {TIER_LABEL[club.level ?? '']?.[locale] ?? club.level}</span>
            </span>
            <span style={{ color: '#c9dcf3', fontSize: 12.5 }}>
              {t.memberPointsLabel}: <b style={{ color: '#fff' }}>{formatToman(club.balance, locale)}</b>
            </span>
          </div>
        </div>
      )}
      {/* HERO */}
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#1668c4)', color: '#fff', padding: '41px 22px 37px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: '#ffffff22', border: '1px solid #ffffff44', padding: '6px 12px', borderRadius: 28, fontSize: '11.5px', fontWeight: 700, marginBottom: 20 }}>
            {t.heroBadge}
          </div>
          <h1 style={{ fontSize: isMobile ? 26 : 38, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-.8px' }}>{t.heroTitle}</h1>
          <p style={{ fontSize: '15.5px', color: '#d6e4f7', margin: '0 0 28px', lineHeight: 1.85 }}>
            {t.heroDesc}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {!loggedIn && (
              <Link
                to="/signin"
                data-testid="club-join-hero"
                style={{ background: '#fff', color: '#1668c4', padding: '11px 24px', borderRadius: 12, fontSize: '13.5px', fontWeight: 800, textDecoration: 'none' }}
              >
                {t.joinFree}
              </Link>
            )}
            <Link
              to={loggedIn ? '/account' : '/signin'}
              style={{ textDecoration: 'none', background: '#ffffff22', border: '1px solid #ffffff55', color: '#fff', padding: '11px 21px', borderRadius: 12, fontSize: '13.5px', fontWeight: 700 }}
            >
              {t.myAccount}
            </Link>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section style={{ maxWidth: 1320, margin: '-30px auto 0', padding: '0 26px', position: 'relative' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, boxShadow: '0 18px 40px -22px rgba(13,38,102,.3)', display: 'grid', gridTemplateColumns: gridCols4 }}>
          {STATS.map((s) => (
            <div key={s.title.fa} style={{ padding: 16, textAlign: 'center', borderLeft: '1px solid #f2f4f7' }}>
              <div style={{ fontSize: 25, fontWeight: 900, color: '#1668c4' }}>{s.value?.[locale]}</div>
              <div style={{ fontSize: '11.5px', color: '#6b7585', marginTop: 4 }}>{s.title[locale]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TIERS */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '37px 22px 14px' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <h2 style={{ fontSize: 27, fontWeight: 900, color: '#0d2640', margin: '0 0 10px' }}>{t.tiersHeading}</h2>
          <p style={{ fontSize: '13.5px', color: '#6b7585', margin: 0 }}>{t.tiersSub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols3, gap: 22, alignItems: 'start' }}>
          {TIERS.map((tier) => (
            <div
              key={tier.name.fa}
              data-testid={`club-tier-${tier.name.en.toLowerCase()}`}
              style={{
                background: '#fff',
                border: `2px solid ${tier.border}`,
                borderRadius: 20,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: tier.popular ? '0 22px 50px -24px rgba(202,165,58,.45)' : undefined,
                marginTop: tier.popular && !isMobile ? 0 : tier.popular ? 0 : 0,
              }}
            >
              {tier.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#fff',
                    color: tier.accent,
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '5px 14px',
                    borderRadius: 20,
                    boxShadow: '0 6px 16px rgba(13,38,102,.18)',
                    zIndex: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.mostPopular}
                </div>
              )}
              <div style={{ background: tier.head, color: '#fff', padding: '34px 20px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: 24,
                  }}
                >
                  {tier.tierIcon}
                </div>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{tier.name[locale]}</div>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: 9,
                    background: 'rgba(255,255,255,.18)',
                    padding: '5px 14px',
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {tier.range[locale]}
                </div>
              </div>
              <div style={{ padding: '8px 20px 18px' }}>
                {tier.perks.map((pk) => (
                  <div
                    key={pk.fa}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '11px 0',
                      borderBottom: '1px solid #f4f6fa',
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: tier.iconBg,
                        color: tier.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#3b4554', fontWeight: 600 }}>{pk[locale]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MEMBERSHIP CARD ISSUANCE */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 22px 14px' }}>
        <div
          data-testid="club-card-issuance"
          style={{
            background: 'linear-gradient(135deg,#0d2640,#16406e)',
            border: '1px solid #1668c4',
            borderRadius: 18,
            padding: 24,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: -70, left: -50, width: 220, height: 220, borderRadius: '50%', background: '#ffffff0d' }} />
          <div style={{ position: 'relative', textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-block', background: '#ffffff1a', color: '#aac4e2', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 800, marginBottom: 12 }}>
              {t.cardBadge}
            </div>
            <h2 style={{ fontSize: '21.5px', fontWeight: 900, color: '#fff', margin: '0 0 10px' }}>{t.cardHeading}</h2>
            <p style={{ fontSize: 13, color: '#aac4e2', margin: 0, lineHeight: 1.8, maxWidth: 680, marginInline: 'auto' }}>
              {t.cardIntroPre} <b style={{ color: '#fff' }}>{t.cardThresholdPoints}</b>
              {t.cardIntroPost}
            </p>
          </div>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 11 }}>
            {CARD_STEPS.map((s, idx) => (
              <div
                key={s.title.fa}
                style={{
                  textAlign: 'center',
                  background: idx === 3 ? '#e8c65a22' : '#ffffff12',
                  border: idx === 3 ? '1px solid #e8c65a55' : '1px solid #ffffff1f',
                  borderRadius: 15,
                  padding: '18px 13px',
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: idx === 3 ? '#e8c65a' : '#fff',
                    color: '#0d2640',
                    fontWeight: 900,
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 13px',
                  }}
                >
                  {s.value?.[locale]}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#fff', marginBottom: 6 }}>{s.title[locale]}</div>
                <div style={{ fontSize: '11.5px', color: idx === 3 ? '#dfeaf7' : '#aac4e2', lineHeight: 1.7 }}>{s.desc?.[locale]}</div>
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            {[
              { label: t.silverCardLabel, range: t.silverRange, dot: '#c8cfd9', border: '#ffffff26' },
              { label: t.goldCardLabel, range: t.goldRange, dot: '#e8c65a', border: '#e8c65a55' },
              { label: t.platCardLabel, range: t.platRange, dot: '#7fb2f0', border: '#ffffff26' },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  flex: 1,
                  minWidth: 200,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  border: `1.5px solid ${card.border}`,
                  borderRadius: 13,
                  padding: '11px 13px',
                }}
              >
                <span style={{ width: 13, height: 13, borderRadius: '50%', background: card.dot, flex: 'none' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#fff' }}>{card.label}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: '11.5px', color: '#aac4e2', fontWeight: 600 }}>{card.range}</span>
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', textAlign: 'center', marginTop: 22 }}>
            <Link
              to={loggedIn ? '/account' : '/signin'}
              data-testid="club-request-card"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                color: '#0d2640',
                padding: '13px 28px',
                borderRadius: 12,
                fontSize: '13.5px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              {t.requestCard}
            </Link>
          </div>
        </div>
      </section>

      {/* EARN */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '14px 22px 14px' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: 24 }}>
          <h2 style={{ fontSize: '21.5px', fontWeight: 900, color: '#0d2640', margin: '0 0 26px', textAlign: 'center' }}>{t.earnHeading}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 }}>
            {EARN.map((e) => (
              <div key={e.title.fa} style={{ textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: '#eef4fb', color: '#1668c4', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  {e.icon}
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: 6, color: '#0d2640' }}>{e.title[locale]}</div>
                <div style={{ fontSize: '11.5px', color: '#6b7585', lineHeight: 1.7 }}>{e.desc?.[locale]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAMAN BANK BANNER — presentational; card registration lives in account panel */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '14px 22px' }}>
        <div
          data-testid="club-saman-banner"
          style={{
            background: 'linear-gradient(120deg,#0f3d3a,#146b5e 60%,#1c8a72)',
            borderRadius: 20,
            padding: isMobile ? 20 : 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 22,
            flexWrap: 'wrap',
            flexDirection: isMobile ? 'column' : 'row',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1, flex: '1 1 420px', minWidth: 280, flexDirection: isMobile ? 'column' : 'row', textAlign: isMobile ? 'center' : 'inherit' }}>
            <div style={{ width: 58, height: 58, borderRadius: 15, background: '#fff', color: '#146b5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flex: 'none' }}>
              {t.samanChip}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '18.5px', fontWeight: 900, color: '#fff' }}>{t.samanHeading}</div>
              <div style={{ fontSize: '12.5px', color: '#bfe6da', marginTop: 8, maxWidth: 380, lineHeight: 1.8 }}>{t.samanSub}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 1, flex: '1 1 340px', width: isMobile ? '100%' : undefined }}>
            <input
              readOnly
              placeholder={t.samanPlaceholder}
              dir="ltr"
              style={{
                flex: 1,
                minWidth: 200,
                background: 'rgba(255,255,255,.12)',
                border: '1.5px solid rgba(255,255,255,.35)',
                borderRadius: 12,
                padding: '15px 16px',
                fontSize: '13.5px',
                color: '#fff',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            />
            <Link
              to={loggedIn ? '/account' : '/signin'}
              style={{
                background: '#fff',
                color: '#146b5e',
                padding: '15px 28px',
                borderRadius: 12,
                fontSize: '13.5px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              {t.samanSubmit}
            </Link>
          </div>
        </div>
      </section>

      {/* MEMBER SERVICES */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 22px 16px' }}>
        <h2 style={{ fontSize: '21.5px', fontWeight: 900, color: '#0d2640', margin: '0 0 22px' }}>{t.servicesHeading}</h2>
        {isMobile ? (
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 14, padding: '4px 2px 8px' }}>
            {SERVICES.map((s) => (
              <div key={s.title.fa} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, flex: 'none', width: 78 }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    background: s.grad,
                    color: '#fff',
                    fontSize: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: s.shadow,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#16202e', textAlign: 'center', lineHeight: 1.4 }}>{s.title[locale]}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols3, gap: 18 }}>
            {SERVICES.map((s) => (
              <div key={s.title.fa} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: 22, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, left: -30, width: 110, height: 110, borderRadius: '50%', background: s.blob }} />
                <div
                  style={{
                    position: 'relative',
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    background: s.grad,
                    color: '#fff',
                    fontSize: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                    boxShadow: s.shadow,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ position: 'relative', fontSize: '15.5px', fontWeight: 800, marginBottom: 8, color: '#16202e' }}>{s.title[locale]}</div>
                <div style={{ position: 'relative', fontSize: 12, color: '#6b7585', lineHeight: 1.8 }}>{s.desc?.[locale]}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '16px 22px 41px' }}>
        <div data-testid="club-cta" style={{ background: 'linear-gradient(135deg,#caa53a,#9a7d22)', color: '#fff', borderRadius: 20, padding: 29, textAlign: 'center' }}>
          <h2 style={{ fontSize: 25, fontWeight: 900, margin: '0 0 12px' }}>{t.ctaHeading}</h2>
          <p style={{ fontSize: '13.5px', color: '#fff', opacity: 0.92, margin: '0 0 24px' }}>{t.ctaDesc}</p>
          {!loggedIn && (
            <Link
              to="/signin"
              data-testid="club-join-cta"
              style={{ display: 'inline-block', background: '#fff', color: '#9a7d22', padding: '11px 28px', borderRadius: 12, fontSize: '14.5px', fontWeight: 800, textDecoration: 'none' }}
            >
              {t.ctaButton}
            </Link>
          )}
        </div>
      </section>
    </PublicPageShell>
  );
}
