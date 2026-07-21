import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAirports } from '../../api/publicSite';
import type { Airport } from '../../types/public-site';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import JalaliDatePicker from '../../components/JalaliDatePicker';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const QUICK_LINKS = [
  { label: 'انتخاب صندلی', href: '/results' },
  { label: 'خرید بار اضافه', href: '/results' },
  { label: 'تغییر و استرداد بلیط', href: '/ticket' },
  { label: 'استعلام وضعیت پرواز', href: '/flight-status' },
];

// Marketing mock content matching design-reference/صفحه اصلی.dc.html — the
// backend has no offers/featured-routes API, so these figures are the
// design's own placeholders; every card still links into the REAL search.
const POPULAR_ROUTES = [
  { from: 'تهران', fromCode: 'THR', to: 'مشهد', toCode: 'MHD', price: '۱٬۶۰۰٬۰۰۰' },
  { from: 'تهران', fromCode: 'THR', to: 'استانبول', toCode: 'IST', price: '۴٬۲۰۰٬۰۰۰' },
  { from: 'تهران', fromCode: 'THR', to: 'دبی', toCode: 'DXB', price: '۳٬۸۰۰٬۰۰۰' },
  { from: 'مشهد', fromCode: 'MHD', to: 'کیش', toCode: 'KIH', price: '۲٬۱۰۰٬۰۰۰' },
  { from: 'شیراز', fromCode: 'SYZ', to: 'تهران', toCode: 'THR', price: '۱٬۴۵۰٬۰۰۰' },
];

const OFFERS = [
  { from: 'تهران', fromCode: 'THR', to: 'استانبول', toCode: 'IST', cabin: 'اکونومی', was: '۵٬۲۰۰٬۰۰۰', now: '۴٬۲۰۰٬۰۰۰', off: '٪۱۹', deadline: 'مهلت: ۲ روز', grad: 'linear-gradient(160deg,#bcd6f2,#e3eefb)' },
  { from: 'تهران', fromCode: 'THR', to: 'دبی', toCode: 'DXB', cabin: 'اکونومی', was: '۴٬۹۰۰٬۰۰۰', now: '۳٬۸۰۰٬۰۰۰', off: '٪۲۲', deadline: 'مهلت: ۳ روز', grad: 'linear-gradient(160deg,#c8d9ec,#e8eef6)' },
  { from: 'مشهد', fromCode: 'MHD', to: 'کیش', toCode: 'KIH', cabin: 'اکونومی', was: '۲٬۸۰۰٬۰۰۰', now: '۲٬۱۰۰٬۰۰۰', off: '٪۲۵', deadline: 'مهلت: امروز', grad: 'linear-gradient(160deg,#bfe0d8,#e6f2ee)' },
  { from: 'تهران', fromCode: 'THR', to: 'مشهد', toCode: 'MHD', cabin: 'اکونومی', was: '۲٬۱۰۰٬۰۰۰', now: '۱٬۶۰۰٬۰۰۰', off: '٪۲۴', deadline: 'مهلت: ۱ روز', grad: 'linear-gradient(160deg,#cdd9ec,#eaeff7)' },
];

const POPULAR_DESTS = [
  { name: 'استانبول', code: 'IST', country: 'ترکیه', dur: '۳ ساعت پرواز', price: '۴٬۲۰۰٬۰۰۰', grad: 'linear-gradient(160deg,#bcd6f2,#e3eefb)' },
  { name: 'دبی', code: 'DXB', country: 'امارات', dur: '۲ ساعت پرواز', price: '۳٬۸۰۰٬۰۰۰', grad: 'linear-gradient(160deg,#c8d9ec,#e8eef6)' },
  { name: 'مشهد', code: 'MHD', country: 'ایران', dur: '۱.۵ ساعت پرواز', price: '۱٬۶۰۰٬۰۰۰', grad: 'linear-gradient(160deg,#bfe0d8,#e6f2ee)' },
  { name: 'کیش', code: 'KIH', country: 'ایران', dur: '۱.۵ ساعت پرواز', price: '۲٬۱۰۰٬۰۰۰', grad: 'linear-gradient(160deg,#cdd9ec,#eaeff7)' },
];

const ANNOUNCEMENT_TEXT =
  'اطلاعیه مهم: برخی پروازهای امروز به‌دلیل شرایط جوی با تأخیر انجام می‌شوند — آخرین وضعیت پروازها را بررسی کنید';

export default function HomeSearchPage() {
  const navigate = useNavigate();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annClosed, setAnnClosed] = useState(false);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setError('خطا در دریافت فهرست فرودگاه‌ها.'));
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !dest || !dateIso) {
      setError('مبدأ، مقصد و تاریخ را انتخاب کنید.');
      return;
    }
    if (origin === dest) {
      setError('مبدأ و مقصد نمی‌توانند یکسان باشند.');
      return;
    }
    navigate(`/results?origin=${origin}&dest=${dest}&date=${dateIso.slice(0, 10)}`);
  }

  function swap() {
    setOrigin(dest);
    setDest(origin);
  }


  return (
    <div dir="rtl" style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", fontSize: '14.5px', background: '#f6f8fb', color: '#16202e', minHeight: '100vh' }}>
      <PublicHeader />

      {!annClosed && (
        <div style={{ background: 'linear-gradient(90deg,#0a1f36,#0d2640 40%,#123457)', color: '#fff', position: 'relative', zIndex: 40 }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '11px 26px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, textAlign: 'center' }}>{ANNOUNCEMENT_TEXT}</span>
            <button
              type="button"
              onClick={() => navigate('/flight-status')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f2c94c', color: '#0d2640', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', flex: 'none', fontFamily: 'inherit' }}
            >
              مشاهده <span style={{ fontSize: 12 }}>←</span>
            </button>
            <button
              type="button"
              data-testid="ann-close"
              onClick={() => setAnnClosed(true)}
              aria-label="بستن"
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,.12)',
                color: '#cfe0f2',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section style={{ background: '#f6f8fb' }}>
        <div style={{ position: 'relative', height: 420, overflow: 'hidden', background: 'linear-gradient(110deg,#0d2640 0%,#123a63 50%,#1668c4 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ maxWidth: 600 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: '#ffffffe6',
                    border: '1px solid #fff',
                    padding: '6px 11px',
                    borderRadius: 30,
                    fontSize: '11.5px',
                    color: '#0d3b66',
                    fontWeight: 600,
                    marginBottom: 20,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b' }} /> در هر پرواز تا ۵٪ کش‌بک بگیرید
                </div>
                <h1 style={{ fontSize: '41.5px', lineHeight: 1.18, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-1px', color: '#fff' }}>
                  پرواز بعدی‌ات را با blujet رزرو کن
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: '#eaf1fb', margin: '0 0 24px', maxWidth: 500 }}>
                  بیش از ۲۰ مقصد داخلی و بین‌المللی، با بهترین قیمت، پشتیبانی شبانه‌روزی و امتیاز در هر سفر.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px 38px', position: 'relative' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 34px 74px -26px rgba(13,38,102,.45)',
              border: '1px solid #eef1f5',
              marginTop: -72,
              position: 'relative',
              zIndex: 30,
            }}
          >
            <form onSubmit={onSubmit} style={{ padding: '13px 16px 16px' }}>
              {error && (
                <p style={{ marginBottom: 12, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: 25, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#16202e', fontWeight: 700, fontSize: 13 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1668c4' }} />
                  </span>
                  یک‌طرفه
                </span>
                <span title="به‌زودی" style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#c5cedb', fontWeight: 500, fontSize: 13, cursor: 'not-allowed' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #dfe3e9' }} />
                  رفت و برگشت
                </span>
                <span title="به‌زودی" style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#c5cedb', fontWeight: 500, fontSize: 13, cursor: 'not-allowed' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #dfe3e9' }} />
                  چندمسیره
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'stretch', position: 'relative', border: '1.5px solid #e3e9f1', borderRadius: 14, background: '#fff', flexWrap: 'wrap' }}>
                <div style={{ flex: '1.5 1 165px', minWidth: 165, padding: '5px 20px 5px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7787', fontWeight: 600, marginBottom: 3 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
                      <circle cx="12" cy="11" r="2" />
                    </svg>
                    مبدا
                  </div>
                  <select
                    id="origin"
                    data-testid="home-origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14.5px', fontWeight: 800, color: origin ? '#0d2640' : '#6b7787', background: 'transparent', fontFamily: 'inherit' }}
                  >
                    <option value="">انتخاب کنید</option>
                    {airports.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.cityFa} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  onClick={swap}
                  style={{
                    alignSelf: 'center',
                    width: 40,
                    height: 40,
                    flex: 'none',
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1.5px solid #e3e9f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1668c4',
                    fontSize: '15.5px',
                    cursor: 'pointer',
                    zIndex: 3,
                    margin: '0 -20px',
                    boxShadow: '0 3px 10px rgba(13,38,102,.12)',
                  }}
                >
                  ⇄
                </div>

                <div style={{ flex: '1.5 1 165px', minWidth: 165, padding: '5px 20px', borderRight: '1px solid #eef1f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7787', fontWeight: 600, marginBottom: 3 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
                      <circle cx="12" cy="11" r="2" />
                    </svg>
                    مقصد
                  </div>
                  <select
                    id="dest"
                    data-testid="home-dest"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14.5px', fontWeight: 800, color: dest ? '#0d2640' : '#6b7787', background: 'transparent', fontFamily: 'inherit' }}
                  >
                    <option value="">انتخاب کنید</option>
                    {airports.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.cityFa} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1.1 1 120px', minWidth: 120, borderRight: '1px solid #eef1f5' }}>
                  <JalaliDatePicker label="تاریخ رفت" value={dateIso} onChange={setDateIso} minDate={TODAY_ISO} testId="home-date" />
                </div>

                <button
                  type="submit"
                  data-testid="home-search-submit"
                  style={{
                    flex: 'none',
                    margin: 8,
                    border: 'none',
                    borderRadius: 11,
                    background: '#1668c4',
                    color: '#fff',
                    padding: '0 28px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  جستجوی پرواز
                </button>
              </div>

              <div style={{ marginTop: 36 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 15 }}>
                  <span style={{ fontSize: '14.5px', color: '#0d2640', fontWeight: 800 }}>مسیرهای پرتردد</span>
                  <span style={{ fontSize: '11.5px', color: '#5a6678' }}>جستجوی سریع پرطرفدارترین مسیرها</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {POPULAR_ROUTES.map((r) => (
                    <button
                      type="button"
                      key={`${r.fromCode}-${r.toCode}`}
                      data-testid={`popular-route-${r.toCode}`}
                      onClick={() => navigate(`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`)}
                      style={{
                        textAlign: 'right',
                        background: '#fff',
                        border: '1px solid #e8eef6',
                        borderRadius: 12,
                        padding: '10px 11px',
                        boxShadow: '0 12px 28px -20px rgba(13,38,102,.45)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#16202e', marginBottom: 3 }}>
                        {r.from} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>←</span> {r.to}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#1668c4', fontWeight: 800 }}>
                        {r.price} <span style={{ fontSize: 9, fontWeight: 400, color: '#8a96a6' }}>تومان</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 26px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 13 }}>
          {QUICK_LINKS.map((q) => (
            <button
              type="button"
              key={q.label}
              onClick={() => navigate(q.href)}
              style={{
                textAlign: 'center',
                background: '#fff',
                border: '1px solid #eef2f7',
                borderRadius: 16,
                padding: '18px 11px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 9,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#10243d' }}>{q.label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* SPECIAL OFFERS */}
      <section id="offers" style={{ maxWidth: 1180, margin: '0 auto', padding: '44px 26px 7px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eaf6ef', color: '#1f8a5b', padding: '4px 10px', borderRadius: 20, fontSize: '11.5px', fontWeight: 700, marginBottom: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f8a5b' }} />
              زمان محدود
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.5px', color: '#16202e' }}>پیشنهادهای ویژه</h2>
            <p style={{ fontSize: 12, color: '#6b7585', margin: 0 }}>تخفیف‌های مدت‌دار روی پرطرفدارترین مسیرها — تا اتمام ظرفیت</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/destinations')}
            style={{ fontSize: '12.5px', color: '#1668c4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontFamily: 'inherit' }}
          >
            <span>←</span>مشاهده همه پیشنهادها
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          {OFFERS.map((o) => (
            <button
              type="button"
              key={`${o.fromCode}-${o.toCode}`}
              data-testid={`offer-${o.fromCode}-${o.toCode}`}
              onClick={() => navigate(`/results?origin=${o.fromCode}&dest=${o.toCode}&date=${TODAY_ISO}`)}
              style={{ textAlign: 'right', background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, overflow: 'hidden', boxShadow: '0 14px 34px -22px rgba(13,38,102,.4)', display: 'flex', flexDirection: 'column', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              <div style={{ position: 'relative', height: 100, background: o.grad, display: 'flex', alignItems: 'flex-end', padding: 8, width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', top: 12, right: 12, background: '#1f8a5b', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 9 }}>
                  {o.off} تخفیف
                </span>
                <span style={{ background: '#0d2640', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{o.cabin}</span>
              </div>
              <div style={{ padding: 11, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#16202e', marginBottom: 9 }}>
                  {o.from} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>←</span> {o.to}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 13 }}>
                  <span style={{ fontSize: '11.5px', color: '#6b7787', textDecoration: 'line-through' }}>{o.was}</span>
                  <span style={{ fontSize: '14.5px', fontWeight: 900, color: '#1668c4' }}>{o.now}</span>
                  <span style={{ fontSize: 11, color: '#6b7585' }}>تومان</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '10.5px', color: '#e5484d', fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5484d' }} />
                    {o.deadline}
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#fff', background: '#1668c4', padding: '6px 13px', borderRadius: 9 }}>رزرو</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* MID BANNER */}
      <section style={{ maxWidth: 1180, margin: '44px auto 0', padding: '0 26px' }}>
        <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', minHeight: 208, boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)', background: 'linear-gradient(100deg,#0d2666 0%,#1668c4 60%,#3f8ede 100%)' }}>
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 26, padding: '34px 46px', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#ffffff22', color: '#fff', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 600, marginBottom: 14 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7ee0b0' }} />
                حراج تابستانه blujet
              </div>
              <h2 style={{ fontSize: 25, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>تا ۴۰٪ تخفیف روی پروازهای خارجی</h2>
              <p style={{ fontSize: '13.5px', color: '#e7eefb', margin: 0, lineHeight: 1.7, maxWidth: 480 }}>
                رزرو تا پایان مرداد برای سفرهای تابستان — صندلی‌ها محدودند، فرصت را از دست نده.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/destinations')}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 25px', background: '#fff', color: '#1668c4', borderRadius: 12, fontSize: '13.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 28px -14px rgba(11,33,56,.5)' }}
            >
              مشاهده پروازها <span style={{ fontSize: '15.5px' }}>←</span>
            </button>
          </div>
        </div>
      </section>

      {/* POPULAR DESTINATIONS */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '39px 26px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 26 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.5px', color: '#16202e' }}>مقصدهای محبوب</h2>
            <p style={{ fontSize: 12, color: '#6b7585', margin: 0 }}>پرطرفدارترین پروازها با بهترین قیمت</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/destinations')}
            style={{ fontSize: '12.5px', color: '#1668c4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontFamily: 'inherit' }}
          >
            <span>←</span>مشاهده همه مقصدها
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          {POPULAR_DESTS.map((d) => (
            <button
              type="button"
              key={d.code}
              data-testid={`popular-dest-${d.code}`}
              onClick={() => navigate(`/results?origin=THR&dest=${d.code}&date=${TODAY_ISO}`)}
              style={{ textAlign: 'right', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 30px -18px rgba(13,38,102,.25)', cursor: 'pointer', border: 'none', fontFamily: 'inherit', padding: 0 }}
            >
              <div style={{ height: 150, background: d.grad, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 11 }}>
                <span style={{ background: '#ffffffe6', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#0d3b66' }}>{d.dur}</span>
              </div>
              <div style={{ padding: '11px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#16202e' }}>{d.name}</span>
                  <span style={{ fontSize: 11, color: '#6b7787' }}>{d.country}</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#6b7585' }}>
                  از <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1668c4' }}>{d.price}</span> تومان
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CLUB MEMBERSHIP BAND */}
      <section style={{ maxWidth: 1180, margin: '28px auto 0', padding: '0 26px' }}>
        <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)', background: 'linear-gradient(120deg,#1668c4,#0d3b66)', padding: '26px 46px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 33, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ maxWidth: 440 }}>
            <div style={{ display: 'inline-block', background: '#ffffff22', color: '#fff', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 600, marginBottom: 14 }}>
              کارت عضویت باشگاه
            </div>
            <h2 style={{ fontSize: '22.5px', fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>با رسیدن به حد امتیاز، کارت عضویت بگیر</h2>
            <p style={{ fontSize: 13, color: '#dce8f6', margin: '0 0 16px', lineHeight: 1.75 }}>
              از ۵٬۰۰۰ امتیاز واجد شرایط دریافت کارت می‌شوی؛ درخواست برای ادمین ارسال و پس از تأیید مدیران، کارت برایت صادر می‌شود.
            </p>
            <button
              type="button"
              onClick={() => navigate('/club')}
              style={{ display: 'inline-block', padding: '10px 21px', background: '#fff', color: '#1668c4', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
            >
              مشاهده شرایط و سطوح
            </button>
          </div>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, width: 290 }}>
            {[
              ['#cbd5e1', 'نقره‌ای', '۰ تا ۵٬۰۰۰ امتیاز'],
              ['#e7c66b', 'طلایی', '۵٬۰۰۰ تا ۱۵٬۰۰۰'],
              ['#9fd2ff', 'پلاتین', 'بالای ۱۵٬۰۰۰'],
            ].map(([dot, name, range]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff14', border: '1px solid #ffffff26', borderRadius: 12, padding: '9px 13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fff', fontWeight: 800, fontSize: '12.5px' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: dot }} />
                  {name}
                </span>
                <span style={{ color: '#cdd9ec', fontSize: '11.5px', fontWeight: 600 }}>{range}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP BAND */}
      <section style={{ maxWidth: 1180, margin: '28px auto 0', padding: '0 26px 49px' }}>
        <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.2)', background: '#fff', border: '1px solid #eef1f5', padding: '28px 46px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontSize: '11.5px', color: '#1668c4', fontWeight: 700, marginBottom: 10 }}>اپلیکیشن blujet</div>
            <h2 style={{ fontSize: '22.5px', fontWeight: 800, margin: '0 0 12px', color: '#0d2640', letterSpacing: '-.5px' }}>سفرت را همراه خودت ببر</h2>
            <p style={{ fontSize: 13, color: '#3f546b', lineHeight: 1.8, margin: '0 0 20px', maxWidth: 460 }}>
              رزرو سریع‌تر، مدیریت بلیط، کارت پرواز دیجیتال و دریافت آخرین تخفیف‌ها — همه در اپلیکیشن موبایل (نسخه PWA همین سایت قابل نصب است).
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0d2640', color: '#fff', padding: '9px 16px', borderRadius: 12, fontSize: '12.5px', fontWeight: 600 }}>
                <span style={{ fontSize: '14.5px' }}>⬇</span>App Store
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0d2640', color: '#fff', padding: '9px 16px', borderRadius: 12, fontSize: '12.5px', fontWeight: 600 }}>
                <span style={{ fontSize: '14.5px' }}>⬇</span>Google Play
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1.5px solid #d5e1f0', color: '#0d2640', padding: '9px 16px', borderRadius: 12, fontSize: '12.5px', fontWeight: 600 }}>
                بازار / مایکت
              </span>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
