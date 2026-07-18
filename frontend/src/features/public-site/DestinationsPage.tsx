import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { faDigits } from '../../lib/fa-format';

// Mock catalog matching design-reference/مقاصد.dc.html verbatim — the
// backend has no featured-destinations/marketing-price API to source
// these figures from honestly, so this page is presentational; clicking
// a card goes to the REAL results page for that route.
interface Dest {
  name: string;
  code: string;
  region: 'dom' | 'intl';
  price: string;
  dur: string;
  perWeek: string;
  badge?: string;
  feat?: boolean;
  hue: [string, string];
}

const DESTS: Dest[] = [
  { name: 'کیش', code: 'KIH', region: 'dom', price: '۱٬۴۸۰٬۰۰۰', dur: '۱ ساعت ۴۵ دقیقه', perWeek: '۲۸ پرواز در هفته', badge: 'پرفروش این فصل', feat: true, hue: ['#1668c4', '#0d3b66'] },
  { name: 'مشهد', code: 'MHD', region: 'dom', price: '۹۸۰٬۰۰۰', dur: '۱ ساعت ۲۵ دقیقه', perWeek: '۴۲ پرواز در هفته', hue: ['#caa53a', '#7d651e'] },
  { name: 'استانبول', code: 'IST', region: 'intl', price: '۶٬۸۰۰٬۰۰۰', dur: '۳ ساعت ۱۵ دقیقه', perWeek: '۱۴ پرواز در هفته', badge: 'پرواز مستقیم', feat: true, hue: ['#d64545', '#7a2626'] },
  { name: 'دبی', code: 'DXB', region: 'intl', price: '۵٬۲۰۰٬۰۰۰', dur: '۲ ساعت ۱۰ دقیقه', perWeek: '۱۸ پرواز در هفته', hue: ['#1f8a5b', '#0e4a30'] },
  { name: 'شیراز', code: 'SYZ', region: 'dom', price: '۱٬۱۵۰٬۰۰۰', dur: '۱ ساعت ۲۰ دقیقه', perWeek: '۲۴ پرواز در هفته', hue: ['#8a5bc4', '#4a2d70'] },
  { name: 'اصفهان', code: 'IFN', region: 'dom', price: '۸۹۰٬۰۰۰', dur: '۵۵ دقیقه', perWeek: '۲۱ پرواز در هفته', hue: ['#12809c', '#0a4655'] },
  { name: 'تبریز', code: 'TBZ', region: 'dom', price: '۱٬۰۵۰٬۰۰۰', dur: '۱ ساعت ۱۰ دقیقه', perWeek: '۱۶ پرواز در هفته', hue: ['#c46a16', '#6e3a0a'] },
  { name: 'تفلیس', code: 'TBS', region: 'intl', price: '۵٬۹۰۰٬۰۰۰', dur: '۲ ساعت ۳۰ دقیقه', perWeek: '۶ پرواز در هفته', hue: ['#4a6e8a', '#243d50'] },
  { name: 'اهواز', code: 'AWZ', region: 'dom', price: '۹۵۰٬۰۰۰', dur: '۱ ساعت ۵ دقیقه', perWeek: '۱۹ پرواز در هفته', hue: ['#9c6a12', '#553a08'] },
  { name: 'نجف', code: 'NJF', region: 'intl', price: '۴٬۹۰۰٬۰۰۰', dur: '۱ ساعت ۵۰ دقیقه', perWeek: '۱۰ پرواز در هفته', hue: ['#6a8a4a', '#3a5026'] },
  { name: 'بندرعباس', code: 'BND', region: 'dom', price: '۱٬۳۲۰٬۰۰۰', dur: '۱ ساعت ۵۰ دقیقه', perWeek: '۱۲ پرواز در هفته', hue: ['#12809c', '#083945'] },
  { name: 'قشم', code: 'GSM', region: 'dom', price: '۱٬۳۹۰٬۰۰۰', dur: '۱ ساعت ۵۵ دقیقه', perWeek: '۸ پرواز در هفته', hue: ['#1668c4', '#123a66'] },
];

const ROUTES = [
  { from: 'تهران', fromCode: 'THR', to: 'مشهد', toCode: 'MHD', price: '۹۸۰٬۰۰۰', freq: 'روزانه ۶ پرواز' },
  { from: 'تهران', fromCode: 'THR', to: 'کیش', toCode: 'KIH', price: '۱٬۴۸۰٬۰۰۰', freq: 'روزانه ۴ پرواز' },
  { from: 'تهران', fromCode: 'THR', to: 'استانبول', toCode: 'IST', price: '۶٬۸۰۰٬۰۰۰', freq: 'روزانه ۲ پرواز' },
  { from: 'تهران', fromCode: 'THR', to: 'دبی', toCode: 'DXB', price: '۵٬۲۰۰٬۰۰۰', freq: 'روزانه ۲ پرواز' },
  { from: 'مشهد', fromCode: 'MHD', to: 'کیش', toCode: 'KIH', price: '۲٬۱۰۰٬۰۰۰', freq: 'هفته‌ای ۸ پرواز' },
  { from: 'تهران', fromCode: 'THR', to: 'نجف', toCode: 'NJF', price: '۴٬۹۰۰٬۰۰۰', freq: 'هفته‌ای ۱۰ پرواز' },
];

const PINS = [
  { city: 'تهران', top: '40%', right: '52%' },
  { city: 'مشهد', top: '30%', right: '22%' },
  { city: 'تبریز', top: '20%', right: '72%' },
  { city: 'شیراز', top: '70%', right: '55%' },
  { city: 'اصفهان', top: '50%', right: '56%' },
  { city: 'کیش', top: '82%', right: '46%' },
  { city: 'اهواز', top: '60%', right: '74%' },
];

const TABS: Array<['all' | 'dom' | 'intl', string]> = [
  ['all', 'همه مقاصد'],
  ['dom', 'پروازهای داخلی'],
  ['intl', 'پروازهای خارجی'],
];

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export default function DestinationsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'dom' | 'intl'>('all');
  const [q, setQ] = useState('');

  const query = q.trim();
  const filtered = DESTS.filter(
    (d) =>
      (tab === 'all' || d.region === tab) &&
      (!query || d.name.includes(query) || d.code.toUpperCase().includes(query.toUpperCase())),
  );
  const filterActive = tab !== 'all' || !!query;
  const gridTitle = query
    ? `نتایج جستجوی «${query}»`
    : tab === 'dom'
      ? 'مقاصد داخلی'
      : tab === 'intl'
        ? 'مقاصد بین‌المللی'
        : 'همه مقاصد';

  const goToResults = (destCode: string) =>
    navigate(`/results?origin=THR&dest=${destCode}&date=${TODAY_ISO}`);

  return (
    <PublicPageShell>
      {/* HERO + SEARCH */}
      <section style={{ background: 'linear-gradient(160deg,#0d2640 30%,#124a86)', color: '#fff', padding: '53px 22px 49px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: -80, width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ position: 'absolute', bottom: -160, right: '30%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(22,104,196,.25)' }} />
        <div style={{ maxWidth: 1320, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#9fc0e8', marginBottom: 12, letterSpacing: 2 }}>
            شبکه پروازی blujet · {faDigits(12)} مقصد فعال
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.8px' }}>مقصد بعدی شما کجاست؟</h1>
          <p style={{ fontSize: '14.5px', color: '#c9dcf3', margin: '0 auto 27px', maxWidth: 520, lineHeight: 1.9 }}>
            از پروازهای روزانه داخلی تا مسیرهای مستقیم بین‌المللی — جستجو کنید و مستقیم به رزرو بروید.
          </p>
          <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 26px 60px -20px rgba(0,0,0,.45)', padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa4b2" strokeWidth="2.2" strokeLinecap="round" style={{ marginRight: 9, flex: 'none' }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="نام شهر یا کد فرودگاه را بنویسید… مثلاً کیش یا IST"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: '13.5px', color: '#16202e', minWidth: 0 }}
            />
            <span style={{ flex: 'none', whiteSpace: 'nowrap', background: '#1668c4', color: '#fff', fontSize: '12.5px', fontWeight: 800, padding: '11px 21px', borderRadius: 11 }}>
              {faDigits(filtered.length)} مقصد
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 15, flexWrap: 'wrap' }}>
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '8px 19px',
                  borderRadius: 22,
                  border: `1.5px solid ${tab === key ? '#fff' : 'rgba(255,255,255,.22)'}`,
                  background: tab === key ? '#fff' : 'rgba(255,255,255,.08)',
                  color: tab === key ? '#1668c4' : '#c9dcf3',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* DESTINATION MOSAIC */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '37px 22px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 17 }}>
          <h2 style={{ fontSize: 21, fontWeight: 900, color: '#0d2640', margin: 0, whiteSpace: 'nowrap' }}>{gridTitle}</h2>
          <span style={{ fontSize: '11.5px', color: '#8a96a6' }}>با کلیک روی هر مقصد، مستقیم به نتایج پرواز همان مسیر می‌روید</span>
        </div>
        {filtered.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridAutoRows: 128, gridAutoFlow: 'dense', gap: 14 }}>
            {filtered.map((d) => (
              <a
                key={d.code}
                data-testid={`dest-card-${d.code}`}
                onClick={(e) => {
                  e.preventDefault();
                  goToResults(d.code);
                }}
                href={`/results?origin=THR&dest=${d.code}&date=${TODAY_ISO}`}
                style={{
                  position: 'relative',
                  gridColumn: `span ${!filterActive && d.feat ? 2 : 1}`,
                  gridRow: 'span 2',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'block',
                  textDecoration: 'none',
                  background: `linear-gradient(135deg,${d.hue[0]},${d.hue[1]})`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(13,38,64,0) 40%,rgba(13,38,64,.82))', pointerEvents: 'none' }} />
                {d.badge && (
                  <span style={{ position: 'absolute', top: 12, right: 12, whiteSpace: 'nowrap', background: '#caa53a', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 11px', borderRadius: 14 }}>
                    {d.badge}
                  </span>
                )}
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '9.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 12, pointerEvents: 'none' }}>
                  {d.region === 'dom' ? 'داخلی' : 'بین‌المللی'}
                </span>
                <div style={{ position: 'absolute', right: 0, left: 0, bottom: 0, padding: '13px 15px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, pointerEvents: 'none' }}>
                  <span style={{ lineHeight: 1.6 }}>
                    <span style={{ display: 'block', color: '#fff', fontSize: '16.5px', fontWeight: 900, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                      {d.name}{' '}
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#c9dcf3' }} dir="ltr">
                        {d.code}
                      </span>
                    </span>
                    <span style={{ display: 'block', color: '#c9dcf3', fontSize: '10.5px' }}>
                      {d.dur} · {d.perWeek}
                    </span>
                  </span>
                  <span style={{ textAlign: 'left', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'block', color: '#9fc0e8', fontSize: 9 }}>شروع از</span>
                    <span style={{ display: 'block', color: '#fff', fontSize: 14, fontWeight: 900 }}>
                      {d.price} <span style={{ fontSize: 9, fontWeight: 400, color: '#c9dcf3' }}>تومان</span>
                    </span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '42px 20px', textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, margin: '0 auto 12px', borderRadius: '50%', background: '#f1f5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              🔍
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>مقصدی با این مشخصات پیدا نشد</div>
            <div style={{ fontSize: 12, color: '#8a96a6' }}>نام شهر یا کد فرودگاه دیگری را امتحان کنید</div>
          </div>
        )}
      </section>

      {/* MAP BAND */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '33px 22px 8px' }}>
        <div style={{ background: 'linear-gradient(135deg,#0d2640,#123a66)', borderRadius: 22, padding: 29, display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 29, alignItems: 'center', color: '#fff' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9fc0e8', marginBottom: 10, letterSpacing: 1.5 }}>پوشش پروازی داخلی</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 13px', lineHeight: 1.5 }}>
              از هر جای ایران،
              <br />
              به هر جای ایران
            </h2>
            <p style={{ fontSize: 13, color: '#c9dcf3', lineHeight: 2, margin: '0 0 21px' }}>
              {faDigits(8)} فرودگاه داخلی با پروازهای روزانه به هم متصل‌اند. روی هر شهر نقشه کلیک کنید تا مقاصد همان شهر را ببینید.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                [faDigits(8), 'فرودگاه داخلی'],
                [faDigits(4), 'مقصد بین‌المللی'],
                [`+${faDigits(320)}`, 'پرواز در هفته'],
              ].map(([value, label]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 13, padding: '11px 17px' }}>
                  <div style={{ fontSize: 19, fontWeight: 900 }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#9fc0e8' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 10 }}>
            <div style={{ position: 'relative', width: '100%', height: 390, background: 'linear-gradient(150deg,#eaf2fb,#d7e6f7)', borderRadius: 12 }}>
              {PINS.map((p) => (
                <div
                  key={p.city}
                  onClick={() => {
                    setQ(p.city);
                    setTab('all');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ position: 'absolute', top: p.top, right: p.right, transform: 'translate(50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#1668c4', border: '3px solid #fff', boxShadow: '0 2px 7px rgba(13,38,102,.45)' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0d2640', background: '#fff', padding: '2px 7px', borderRadius: 9, whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(13,38,102,.12)' }}>
                    {p.city}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR ROUTES */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '33px 22px 47px' }}>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: '#0d2640', margin: '0 0 5px' }}>مسیرهای پرتردد</h2>
        <p style={{ fontSize: '12.5px', color: '#6b7585', margin: '0 0 18px' }}>ارزان‌ترین نرخ در پرطرفدارترین مسیرها</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13 }}>
          {ROUTES.map((r) => (
            <a
              key={`${r.fromCode}-${r.toCode}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`);
              }}
              href={`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`}
              style={{ textDecoration: 'none', background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}
            >
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ lineHeight: 1.6 }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, color: '#0d2640' }}>
                    {r.from}{' '}
                    <span style={{ fontSize: 10, color: '#8a96a6' }} dir="ltr">
                      {r.fromCode}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: '10.5px', color: '#8a96a6' }}>{r.freq}</span>
                </span>
                <span style={{ color: '#1668c4', fontSize: 15 }}>✈</span>
                <span style={{ lineHeight: 1.6, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, color: '#0d2640' }}>
                    {r.to}{' '}
                    <span style={{ fontSize: 10, color: '#8a96a6' }} dir="ltr">
                      {r.toCode}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1668c4' }}>
                    {r.price} <span style={{ fontSize: 9, fontWeight: 400, color: '#8a96a6' }}>تومان</span>
                  </span>
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
