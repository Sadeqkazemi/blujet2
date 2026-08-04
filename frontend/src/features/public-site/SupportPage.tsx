import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { submitSupportTicket } from '../../api/support-tickets';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';

// Support / help-center page — content matches design-reference/پشتیبانی.dc.html.
// Phase 20 wires the ticket form to a real backend; the design's form had
// no name/phone input, but a real ticket system needs a way to contact the
// submitter back, so those two fields were added (see docs/API.md's Phase
// 20 notes). The FAQ and contact channels stay static content.

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const CATS: { icon: string; color: string; bg: string; title: Tr; desc: Tr }[] = [
  { icon: '🎫', color: '#1668c4', bg: '#eef4fb', title: { fa: 'رزرو و خرید بلیط', en: 'Booking & Purchase', ar: 'حجز وشراء التذكرة' }, desc: { fa: 'مراحل خرید، پرداخت و دریافت بلیط', en: 'Steps for buying, paying, and receiving your ticket', ar: 'خطوات الشراء والدفع واستلام التذكرة' } },
  { icon: '↩', color: '#d64545', bg: '#fbf0ef', title: { fa: 'استرداد و تغییر', en: 'Refunds & Changes', ar: 'الاسترداد والتغيير' }, desc: { fa: 'کنسلی، تغییر تاریخ و بازگشت وجه', en: 'Cancellation, date changes, and refunds', ar: 'الإلغاء وتغيير التاريخ واسترداد المبلغ' } },
  { icon: '🧳', color: '#1f8a5b', bg: '#eef9f1', title: { fa: 'بار و صندلی', en: 'Baggage & Seats', ar: 'الأمتعة والمقاعد' }, desc: { fa: 'قوانین بار، انتخاب صندلی و خدمات', en: 'Baggage rules, seat selection, and services', ar: 'قواعد الأمتعة واختيار المقعد والخدمات' } },
  { icon: '★', color: '#c47d1a', bg: '#fbf6ea', title: { fa: 'باشگاه مشتریان', en: 'Loyalty Club', ar: 'نادي العملاء' }, desc: { fa: 'امتیازها، سطوح عضویت و مزایا', en: 'Points, membership tiers, and perks', ar: 'النقاط وفئات العضوية والمزايا' } },
];

const FAQS: { q: Tr; a: Tr }[] = [
  {
    q: { fa: 'چگونه بلیط خود را استرداد کنم؟', en: 'How do I refund my ticket?', ar: 'كيف أسترد تذكرتي؟' },
    a: {
      fa: 'از بخش «مدیریت رزرو» با وارد کردن کد رزرو و نام خانوادگی، بلیط را انتخاب و گزینهٔ استرداد را بزنید. مبلغ قابل بازگشت بر اساس قوانین نرخ بلیط محاسبه و حداکثر ظرف ۷۲ ساعت کاری به حساب شما واریز می‌شود.',
      en: 'Under "Manage Booking", enter your booking code and last name, select the ticket, and choose the refund option. The refundable amount is calculated per the ticket\'s fare rules and deposited to your account within a maximum of 72 business hours.',
      ar: 'من «إدارة الحجز»، أدخل رمز الحجز واسم العائلة، اختر التذكرة، ثم اختر خيار الاسترداد. يُحسب المبلغ القابل للاسترداد وفق قواعد أجرة التذكرة ويُودَع في حسابك خلال ٧٢ ساعة عمل كحد أقصى.',
    },
  },
  {
    q: { fa: 'چک‌این آنلاین از چه زمانی فعال می‌شود؟', en: 'When does online check-in open?', ar: 'متى يُفتح تسجيل الوصول عبر الإنترنت؟' },
    a: {
      fa: 'چک‌این آنلاین از ۲۴ ساعت تا ۵ ساعت پیش از پرواز فعال است. پس از انجام چک‌این، کارت پرواز به‌صورت الکترونیکی برای شما صادر و قابل دانلود خواهد بود.',
      en: 'Online check-in is open from 24 hours to 5 hours before the flight. After checking in, your electronic boarding pass will be issued and downloadable.',
      ar: 'يُفتح تسجيل الوصول عبر الإنترنت من ٢٤ ساعة إلى ٥ ساعات قبل الرحلة. بعد تسجيل الوصول، تصدر بطاقة الصعود إلكترونيًا وتكون قابلة للتنزيل.',
    },
  },
  {
    q: { fa: 'اگر پرداخت انجام شد ولی بلیط صادر نشد چه کنم؟', en: "What if I paid but the ticket wasn't issued?", ar: 'ماذا أفعل إذا تم الدفع ولم تُصدر التذكرة؟' },
    a: {
      fa: 'در صورت کسر وجه و عدم صدور بلیط، مبلغ به‌صورت خودکار طی ۲۴ تا ۷۲ ساعت به حساب شما بازمی‌گردد. برای پیگیری فوری می‌توانید تیکت ثبت کنید یا با پشتیبانی تماس بگیرید.',
      en: 'If the amount was deducted but no ticket was issued, it is automatically refunded to your account within 24 to 72 hours. For urgent follow-up, submit a ticket or contact support.',
      ar: 'في حال خصم المبلغ دون إصدار التذكرة، يُعاد المبلغ تلقائيًا إلى حسابك خلال ٢٤ إلى ٧٢ ساعة. للمتابعة العاجلة يمكنك تقديم تذكرة دعم أو الاتصال بالدعم.',
    },
  },
  {
    q: { fa: 'میزان بار مجاز هر بلیط چقدر است؟', en: 'What is the baggage allowance per ticket?', ar: 'ما هو وزن الأمتعة المسموح به لكل تذكرة؟' },
    a: {
      fa: 'در نرخ اکونومی ۲۰ کیلوگرم و در نرخ بیزنس ۴۰ کیلوگرم بار رایگان لحاظ می‌شود. بار اضافه را می‌توانید هنگام خرید یا از بخش خدمات اضافه خریداری کنید.',
      en: '20kg free baggage is included in Economy fares and 40kg in Business fares. Extra baggage can be purchased during checkout or from the additional-services section.',
      ar: 'يُسمح بـ ٢٠ كجم مجانًا في درجة الاقتصادية و٤٠ كجم في درجة الأعمال. يمكن شراء أمتعة إضافية عند الشراء أو من قسم الخدمات الإضافية.',
    },
  },
  {
    q: { fa: 'چگونه امتیاز باشگاه مشتریان جمع کنم؟', en: 'How do I earn Loyalty Club points?', ar: 'كيف أجمع نقاط نادي العملاء؟' },
    a: {
      fa: 'با هر خرید بلیط به‌صورت خودکار امتیاز دریافت می‌کنید. امتیازها قابل تبدیل به تخفیف، ارتقای صندلی و بار اضافه هستند و در پنل کاربری قابل مشاهده‌اند.',
      en: 'You automatically earn points with every ticket purchase. Points can be converted into discounts, seat upgrades, and extra baggage, and are visible in your account panel.',
      ar: 'تحصل على نقاط تلقائيًا مع كل عملية شراء تذكرة. يمكن تحويل النقاط إلى خصومات وترقية مقعد وأمتعة إضافية، وهي مرئية في لوحة حسابك.',
    },
  },
];

// Canonical fa strings — the value actually submitted to the backend and
// shown to staff in the (Persian-only) admin ticket queue. Only the
// dropdown's visible label translates; the submitted `subject` value
// always stays this Persian string, matching how every other ticket in
// the real system is stored.
const SUBJECTS = ['استرداد و تغییر بلیط', 'مشکل در پرداخت', 'بار و چک‌این', 'باشگاه مشتریان', 'سایر موارد'];
const SUBJECT_LABELS: Record<string, Tr> = {
  'استرداد و تغییر بلیط': { fa: 'استرداد و تغییر بلیط', en: 'Refund & ticket change', ar: 'استرداد وتغيير التذكرة' },
  'مشکل در پرداخت': { fa: 'مشکل در پرداخت', en: 'Payment issue', ar: 'مشكلة في الدفع' },
  'بار و چک‌این': { fa: 'بار و چک‌این', en: 'Baggage & check-in', ar: 'الأمتعة وتسجيل الوصول' },
  'باشگاه مشتریان': { fa: 'باشگاه مشتریان', en: 'Loyalty club', ar: 'نادي العملاء' },
  'سایر موارد': { fa: 'سایر موارد', en: 'Other', ar: 'أخرى' },
};

const STR: Record<StoredLocale, {
  heroTitle: string;
  heroDesc: string;
  searchPlaceholder: string;
  searchLabel: string;
  faqHeading: string;
  noFaqMatch: string;
  ticketHeading: string;
  ticketSub: string;
  ticketSentTitle: string;
  trackingCodeLabel: string;
  namePlaceholder: string;
  phonePlaceholder: string;
  msgPlaceholder: string;
  ticketSend: string;
  directContact: string;
  phone24: string;
  liveChat: string;
  onlineNow: string;
  email: string;
}> = {
  fa: {
    heroTitle: 'چطور می‌توانیم کمک کنیم؟',
    heroDesc: 'پاسخ پرسش‌های متداول را پیدا کنید یا با تیم پشتیبانی ۲۴ ساعته در ارتباط باشید.',
    searchPlaceholder: 'سؤال خود را جستجو کنید…',
    searchLabel: 'جستجو',
    faqHeading: 'پرسش‌های متداول',
    noFaqMatch: 'پرسشی مطابق جستجوی شما پیدا نشد',
    ticketHeading: 'ثبت تیکت پشتیبانی',
    ticketSub: 'درخواست خود را ثبت کنید؛ کارشناسان ما حداکثر ظرف ۲ ساعت پاسخ می‌دهند.',
    ticketSentTitle: 'تیکت شما ثبت شد',
    trackingCodeLabel: 'کد پیگیری',
    namePlaceholder: 'نام و نام خانوادگی',
    phonePlaceholder: 'شماره تماس',
    msgPlaceholder: 'توضیح درخواست خود را بنویسید…',
    ticketSend: 'ارسال تیکت',
    directContact: 'تماس مستقیم',
    phone24: 'تلفن ۲۴ ساعته',
    liveChat: 'گفتگوی آنلاین',
    onlineNow: 'هم‌اکنون آنلاین',
    email: 'ایمیل',
  },
  en: {
    heroTitle: 'How can we help?',
    heroDesc: 'Find answers to frequently asked questions or reach our 24-hour support team.',
    searchPlaceholder: 'Search the help center… e.g. refund a ticket',
    searchLabel: 'Search',
    faqHeading: 'Frequently Asked Questions',
    noFaqMatch: 'No question matches your search',
    ticketHeading: 'Submit a Support Ticket',
    ticketSub: 'Submit your request; our agents respond within 2 hours.',
    ticketSentTitle: 'Your ticket has been submitted',
    trackingCodeLabel: 'Tracking code',
    namePlaceholder: 'Full name',
    phonePlaceholder: 'Phone number',
    msgPlaceholder: 'Describe your request…',
    ticketSend: 'Submit Ticket',
    directContact: 'Direct Contact',
    phone24: '24-Hour Phone',
    liveChat: 'Live Chat',
    onlineNow: 'Online now',
    email: 'Email',
  },
  ar: {
    heroTitle: 'كيف يمكننا المساعدة؟',
    heroDesc: 'اعثر على إجابات للأسئلة الشائعة أو تواصل مع فريق الدعم على مدار الساعة.',
    searchPlaceholder: 'ابحث في مركز المساعدة… مثلاً: استرداد تذكرة',
    searchLabel: 'بحث',
    faqHeading: 'الأسئلة الشائعة',
    noFaqMatch: 'لا يوجد سؤال يطابق بحثك',
    ticketHeading: 'تقديم تذكرة دعم',
    ticketSub: 'قدّم طلبك؛ سيرد فريقنا خلال ساعتين كحد أقصى.',
    ticketSentTitle: 'تم تقديم تذكرتك',
    trackingCodeLabel: 'رمز التتبع',
    namePlaceholder: 'الاسم الكامل',
    phonePlaceholder: 'رقم الهاتف',
    msgPlaceholder: 'وصف الطلب…',
    ticketSend: 'إرسال التذكرة',
    directContact: 'اتصال مباشر',
    phone24: 'هاتف على مدار الساعة',
    liveChat: 'محادثة مباشرة',
    onlineNow: 'متصل الآن',
    email: 'البريد الإلكتروني',
  },
};

const ERR: Record<StoredLocale, string> = {
  fa: 'خطا در ثبت تیکت.',
  en: 'Error submitting the ticket.',
  ar: 'خطأ في تقديم التذكرة.',
};

export default function SupportPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [q, setQ] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const query = q.trim();
  const visibleFaqs = query ? FAQS.filter((f) => f.q[locale].includes(query) || f.a[locale].includes(query)) : FAQS;

  const canSubmit = name.trim() && phone.trim() && msg.trim();

  async function onSubmitTicket() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitSupportTicket({
        requesterName: name.trim(),
        requesterPhone: phone.trim(),
        subject,
        body: msg.trim(),
      });
      setTrackingCode(res.trackingCode);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : ERR[locale]);
    } finally {
      setSubmitting(false);
    }
  }

  const gridCols4 = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  return (
    <PublicPageShell>
      {/* HERO + SEARCH — contained rounded card per design */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '23px 26px 0' }}>
        <div style={{ background: 'linear-gradient(135deg,#0d2640,#16406e)', color: '#fff', padding: '36px 28px 41px', borderRadius: 20 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontSize: isMobile ? 24 : 30.5, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.6px' }}>{t.heroTitle}</h1>
            <p style={{ fontSize: '13.5px', color: '#aac4e2', margin: '0 0 26px' }}>{t.heroDesc}</p>
            <div style={{ display: 'flex', background: '#fff', borderRadius: 14, padding: 6, boxShadow: '0 18px 40px -16px rgba(0,0,0,.45)' }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.searchPlaceholder}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: '13.5px', padding: '0 13px', color: '#16202e', minWidth: 0 }}
              />
              <span style={{ height: 48, padding: '0 23px', borderRadius: 10, background: '#1668c4', color: '#fff', display: 'flex', alignItems: 'center', gap: 7, fontSize: '13.5px', fontWeight: 800, flex: 'none' }}>
                {t.searchLabel}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY CARDS */}
      <section style={{ maxWidth: 1320, margin: '-36px auto 0', padding: '0 26px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols4, gap: 15 }}>
          {CATS.map((c) => (
            <div key={c.title.fa} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 15, boxShadow: '0 8px 24px -18px rgba(13,38,102,.4)' }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: c.bg, color: c.color, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                {c.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 5, color: '#0d2640' }}>{c.title[locale]}</div>
              <div style={{ fontSize: '11.5px', color: '#8a96a6', lineHeight: 1.7 }}>{c.desc[locale]}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1320, margin: '48px auto 0', padding: '0 26px 56px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: 25, alignItems: 'start' }}>
        {/* FAQ */}
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 18px', color: '#0d2640' }}>{t.faqHeading}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleFaqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q.fa} style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: locale === 'en' ? 'left' : 'right' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>{f.q[locale]}</span>
                    <span style={{ color: '#1668c4', fontSize: 18, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .15s', flex: 'none' }}>+</span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 16px 15px', fontSize: 12, color: '#5a6678', lineHeight: 1.95 }}>{f.a[locale]}</div>
                  )}
                </div>
              );
            })}
            {visibleFaqs.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: '#8a96a6' }}>
                {t.noFaqMatch}
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR: direct contact + dark ticket form */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: 15 }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 16px', color: '#0d2640' }}>{t.directContact}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, background: '#eef4fb', color: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>☎</span>
                <div>
                  <div style={{ fontSize: 11, color: '#9aa4b2' }}>{t.phone24}</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#16202e' }} dir="ltr">021 — 91000000</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, background: '#eef9f1', color: '#1f8a5b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</span>
                <div>
                  <div style={{ fontSize: 11, color: '#9aa4b2' }}>{t.liveChat}</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1f8a5b' }}>{t.onlineNow}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 12, background: '#fbf3ec', color: '#c47d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✉</span>
                <div>
                  <div style={{ fontSize: 11, color: '#9aa4b2' }}>{t.email}</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#16202e' }} dir="ltr">support@blujet.ir</div>
                </div>
              </div>
            </div>
          </div>

          <div data-testid="support-ticket-panel" style={{ background: '#0d2640', color: '#fff', borderRadius: 14, padding: 15 }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 6px' }}>{t.ticketHeading}</h3>
            <p style={{ fontSize: '11.5px', color: '#aac4e2', margin: '0 0 16px', lineHeight: 1.8 }}>{t.ticketSub}</p>
            {sent ? (
              <div data-testid="ticket-sent" style={{ background: 'rgba(31,138,91,.18)', border: '1px solid #2ea36b', borderRadius: 11, padding: 11, textAlign: 'center' }}>
                <div style={{ fontSize: 23.5, marginBottom: 6 }}>✓</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{t.ticketSentTitle}</div>
                <div style={{ fontSize: '10.5px', color: '#aac4e2', marginTop: 4 }}>
                  {t.trackingCodeLabel}: <span data-testid="ticket-tracking-code" dir="ltr">{trackingCode}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  data-testid="ticket-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  style={{ height: 44, border: 'none', borderRadius: 10, background: 'rgba(255,255,255,.1)', color: '#fff', padding: '0 10px', fontFamily: 'inherit', fontSize: 12, outline: 'none' }}
                />
                <input
                  data-testid="ticket-phone"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  style={{ height: 44, border: 'none', borderRadius: 10, background: 'rgba(255,255,255,.1)', color: '#fff', padding: '0 10px', fontFamily: 'inherit', fontSize: 12, outline: 'none' }}
                />
                <select
                  data-testid="ticket-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ height: 44, border: 'none', borderRadius: 10, background: 'rgba(255,255,255,.1)', color: '#fff', padding: '0 10px', fontFamily: 'inherit', fontSize: 12, outline: 'none', cursor: 'pointer' }}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s} style={{ color: '#16202e' }}>
                      {SUBJECT_LABELS[s][locale]}
                    </option>
                  ))}
                </select>
                <textarea
                  data-testid="ticket-msg"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder={t.msgPlaceholder}
                  rows={4}
                  style={{ minHeight: 90, border: 'none', borderRadius: 10, background: 'rgba(255,255,255,.1)', color: '#fff', padding: 10, fontFamily: 'inherit', fontSize: 12, outline: 'none', resize: 'vertical' }}
                />
                {error && <p style={{ margin: 0, fontSize: 11, color: '#ffb4b4' }}>{error}</p>}
                <button
                  data-testid="ticket-submit"
                  onClick={() => void onSubmitTicket()}
                  disabled={!canSubmit || submitting}
                  style={{
                    height: 46,
                    borderRadius: 11,
                    background: canSubmit && !submitting ? '#1668c4' : '#4a6e8a',
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {t.ticketSend}
                </button>
              </div>
            )}
          </div>
        </aside>
      </section>
    </PublicPageShell>
  );
}
