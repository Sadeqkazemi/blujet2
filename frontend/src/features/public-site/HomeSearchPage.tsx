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
  { label: 'استعلام وضعیت پرواز', href: '/results' },
];

export default function HomeSearchPage() {
  const navigate = useNavigate();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const popularRoutes = airports.length > 1 ? airports.slice(1, 6).map((a) => ({ from: airports[0], to: a })) : [];

  return (
    <div dir="rtl" style={{ fontFamily: 'Vazirmatn, sans-serif', fontSize: '14.5px', background: '#f6f8fb', color: '#16202e', minHeight: '100vh' }}>
      <PublicHeader />

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
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
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14.5px', fontWeight: 800, color: origin ? '#0d2640' : '#9aa4b2', background: 'transparent', fontFamily: 'inherit' }}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9aa4b2', fontWeight: 600, marginBottom: 3 }}>
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
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14.5px', fontWeight: 800, color: dest ? '#0d2640' : '#9aa4b2', background: 'transparent', fontFamily: 'inherit' }}
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

              {popularRoutes.length > 0 && (
                <div style={{ marginTop: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 15 }}>
                    <span style={{ fontSize: '14.5px', color: '#0d2640', fontWeight: 800 }}>مسیرهای پرتردد</span>
                    <span style={{ fontSize: '11.5px', color: '#5a6678' }}>جستجوی سریع پرطرفدارترین مسیرها</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    {popularRoutes.map((r) => (
                      <button
                        type="button"
                        key={r.to.id}
                        data-testid={`popular-route-${r.to.code}`}
                        onClick={() => navigate(`/results?origin=${r.from.code}&dest=${r.to.code}&date=${TODAY_ISO}`)}
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
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#16202e' }}>
                          {r.from.cityFa} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>←</span> {r.to.cityFa}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 26px 49px' }}>
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

      <PublicFooter />
    </div>
  );
}
