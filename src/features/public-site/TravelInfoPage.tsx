import { useRef, useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { faDigits } from '../../lib/fa-format';

// اطلاعات سفر / قوانین و مقررات — content matches
// design-reference/قوانین و مقررات.dc.html verbatim.

const SECTIONS = [
  {
    title: 'خرید و صدور بلیط',
    items: [
      'قیمت نمایش‌داده‌شده شامل مالیات و عوارض است و هزینهٔ پنهانی وجود ندارد.',
      'پس از پرداخت موفق، بلیط الکترونیکی بلافاصله صادر و به ایمیل و شمارهٔ موبایل شما ارسال می‌شود.',
      'مسئولیت صحت اطلاعات هویتی مسافران (نام، نام خانوادگی و کد ملی/گذرنامه) بر عهدهٔ خریدار است.',
    ],
  },
  {
    title: 'استرداد و کنسلی',
    items: [
      'میزان جریمهٔ استرداد بر اساس نوع نرخ بلیط و سیاست ایرلاین تعیین می‌شود.',
      'درخواست استرداد از بخش «مدیریت رزرو» قابل ثبت است و مبلغ قابل بازگشت پیش از تأیید نمایش داده می‌شود.',
      'بازگشت وجه حداکثر ظرف ۷۲ ساعت کاری به حساب پرداخت‌کننده انجام می‌شود.',
    ],
  },
  {
    title: 'تغییر تاریخ و مشخصات',
    items: [
      'تغییر تاریخ پرواز در صورت موجود بودن ظرفیت و مطابق قوانین نرخ امکان‌پذیر است.',
      'اصلاح خطای تایپی در نام مسافر تا پیش از بستن فروش پرواز قابل انجام است.',
    ],
  },
  {
    title: 'بار و چک‌این',
    items: [
      'بار مجاز رایگان در نرخ اکونومی ۲۰ و در نرخ بیزنس ۴۰ کیلوگرم است.',
      'چک‌این آنلاین از ۲۴ تا ۵ ساعت پیش از پرواز فعال است.',
      'حمل اقلام ممنوعه طبق فهرست سازمان هواپیمایی کشوری اکیداً ممنوع است.',
    ],
  },
  {
    title: 'باشگاه مشتریان',
    items: [
      'امتیازها با هر خرید به‌صورت خودکار محاسبه و در پنل کاربری ثبت می‌شوند.',
      'امتیازها قابل تبدیل به تخفیف، بار اضافه و ارتقای صندلی هستند و تاریخ انقضا دارند.',
    ],
  },
  {
    title: 'حریم خصوصی و امنیت',
    items: [
      'اطلاعات شخصی و پرداخت کاربران با پروتکل‌های رمزنگاری محافظت می‌شود.',
      'پرداخت‌ها صرفاً از طریق درگاه‌های بانکی معتبر انجام می‌گیرد و اطلاعات کارت نزد ما ذخیره نمی‌شود.',
    ],
  },
];

export default function TravelInfoPage() {
  const [active, setActive] = useState(0);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '39px 22px 35px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>قوانین و مقررات</h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>آخرین به‌روزرسانی: ۱ تیر ۱۴۰۵ · لطفاً پیش از خرید بلیط مطالعه فرمایید.</p>
      </section>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '31px 22px 47px', display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24, alignItems: 'start' }}>
        {/* TOC */}
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 15, padding: 9, position: 'sticky', top: 100 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#8a96a6', padding: '8px 11px 6px' }}>فهرست</div>
          {SECTIONS.map((s, i) => (
            <button
              key={s.title}
              onClick={() => {
                setActive(i);
                sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'right',
                padding: '9px 11px',
                borderRadius: 9,
                border: 'none',
                background: active === i ? '#eef4fb' : 'transparent',
                color: active === i ? '#1668c4' : '#5a6678',
                fontWeight: active === i ? 800 : 600,
                fontSize: 12.5,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* SECTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SECTIONS.map((s, i) => (
            <div
              key={s.title}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '19px 21px', scrollMarginTop: 100 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: '#eef4fb', color: '#1668c4', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  {faDigits(i + 1)}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: 0 }}>{s.title}</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {s.items.map((it) => (
                  <div key={it} style={{ display: 'flex', gap: 9, fontSize: 12.5, color: '#3b4554', lineHeight: 1.9 }}>
                    <span style={{ color: '#1668c4', flex: 'none' }}>•</span>
                    {it}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ background: '#fff7e6', border: '1px solid #f2dfb0', borderRadius: 14, padding: '15px 18px', display: 'flex', gap: 11, fontSize: 12, color: '#7d651e', lineHeight: 1.9 }}>
            <span style={{ flex: 'none' }}>⚠️</span>
            قوانین استرداد و تغییر بسته به نوع نرخ بلیط و سیاست هر ایرلاین متفاوت است. مبلغ دقیق قابل بازگشت در مرحلهٔ استرداد در بخش «مدیریت رزرو» به شما
            نمایش داده می‌شود.
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
