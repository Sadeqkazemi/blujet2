import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { faDigits } from '../../lib/fa-format';

// وضعیت پرواز — mock-only page matching design-reference/وضعیت پرواز.dc.html:
// search by flight number OR route+date, shows a status card with the
// design's own sample flight. No dedicated backend lookup exists for
// arbitrary flight-number status (distinct from the PNR-based booking
// lookup on مدیریت رزرو), so this stays mock like that page.

const MOCK_STATUS = {
  airline: 'blujet',
  flightNo: 'BJ-410',
  date: '۲۵ تیر ۱۴۰۵',
  statusLabel: 'به‌موقع',
  depCode: 'THR',
  depCity: 'تهران',
  depTime: '۱۸:۲۰',
  depTerminal: '۲',
  duration: '۱ ساعت و ۲۵ دقیقه',
  distance: '۶۵۰ کیلومتر',
  arrCode: 'MHD',
  arrCity: 'مشهد',
  arrTime: '۱۹:۵۰',
  arrTerminal: '۱',
  aircraft: 'ایرباس A320',
  gate: 'B12',
  belt: '۳',
  delayLabel: 'بدون تأخیر',
};

export default function FlightStatusPage() {
  const [mode, setMode] = useState<'flightNo' | 'route'>('flightNo');
  const [flightNo, setFlightNo] = useState('');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [date, setDate] = useState('');
  const [result, setResult] = useState<'idle' | 'found' | 'not-found'>('idle');
  const [smsOn, setSmsOn] = useState(false);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'flightNo') {
      setResult(flightNo.trim().toUpperCase() === 'BJ-410' ? 'found' : 'not-found');
    } else {
      setResult(origin.trim() && dest.trim() && date.trim() ? 'found' : 'not-found');
    }
  }

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '41px 22px 65px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>وضعیت پرواز</h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>با شماره پرواز یا مسیر و تاریخ، آخرین وضعیت پرواز را ببینید.</p>
      </section>

      <div style={{ maxWidth: 720, margin: '-34px auto 0', padding: '0 22px 60px', position: 'relative' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: 20 }}>
          <div style={{ display: 'flex', background: '#eef1f5', borderRadius: 11, padding: 3, marginBottom: 16, maxWidth: 320 }}>
            {(
              [
                ['flightNo', 'شماره پرواز'],
                ['route', 'مبدأ و مقصد'],
              ] as const
            ).map(([m, lbl]) => (
              <span
                key={m}
                data-testid={`fs-mode-${m}`}
                onClick={() => {
                  setMode(m);
                  setResult('idle');
                }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: mode === m ? 700 : 600,
                  color: mode === m ? '#1668c4' : '#6b7787',
                  background: mode === m ? '#fff' : 'transparent',
                  boxShadow: mode === m ? '0 2px 7px rgba(13,38,102,.14)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {lbl}
              </span>
            ))}
          </div>

          <form onSubmit={search} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {mode === 'flightNo' ? (
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="fs-flightno" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  شماره پرواز
                </label>
                <input
                  id="fs-flightno"
                  data-testid="fs-flightno"
                  dir="ltr"
                  value={flightNo}
                  onChange={(e) => setFlightNo(e.target.value)}
                  placeholder="مثلاً BJ-410"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
                />
              </div>
            ) : (
              <>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>مبدأ</label>
                  <input
                    data-testid="fs-origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="تهران"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
                  />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>مقصد</label>
                  <input
                    data-testid="fs-dest"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    placeholder="مشهد"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
                  />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>تاریخ</label>
                  <input
                    data-testid="fs-date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="۲۵ تیر ۱۴۰۵"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              data-testid="fs-search"
              style={{ flex: 'none', border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 26px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              جستجو
            </button>
          </form>
        </div>

        {result === 'not-found' && (
          <div data-testid="fs-not-found" style={{ marginTop: 22, background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2640', marginBottom: 8 }}>پروازی یافت نشد</div>
            <p style={{ fontSize: 12, color: '#8a96a6', margin: 0 }}>اطلاعات وارد‌شده با هیچ پروازی مطابقت ندارد. شماره پرواز یا مسیر و تاریخ را بررسی کنید.</p>
          </div>
        )}

        {result === 'found' && (
          <div style={{ marginTop: 22 }}>
            <div data-testid="fs-result" style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.3)' }}>
              <div style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                  <span>✈</span> {MOCK_STATUS.airline}
                </span>
                <span style={{ fontSize: 12 }}>
                  <span dir="ltr">{MOCK_STATUS.flightNo}</span> · {MOCK_STATUS.date}
                </span>
                <span style={{ background: '#1f8a5b', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 14 }}>{MOCK_STATUS.statusLabel}</span>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {MOCK_STATUS.depCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7787' }}>{MOCK_STATUS.depCity}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{MOCK_STATUS.depTime}</div>
                  <div style={{ fontSize: 10.5, color: '#8a96a6', marginTop: 2 }}>ترمینال {faDigits(MOCK_STATUS.depTerminal)}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: '#8a96a6', fontSize: 11 }}>
                  <div>{MOCK_STATUS.duration}</div>
                  <div style={{ borderTop: '2px dashed #d5e1f0', margin: '8px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -10, right: '50%', transform: 'translateX(50%)', background: '#fff', padding: '0 8px', color: '#1668c4' }}>✈</span>
                  </div>
                  <div>{MOCK_STATUS.distance}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {MOCK_STATUS.arrCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7787' }}>{MOCK_STATUS.arrCity}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{MOCK_STATUS.arrTime}</div>
                  <div style={{ fontSize: 10.5, color: '#8a96a6', marginTop: 2 }}>ترمینال {faDigits(MOCK_STATUS.arrTerminal)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid #f2f4f7' }}>
                {[
                  ['هواپیما', MOCK_STATUS.aircraft],
                  ['گیت', MOCK_STATUS.gate],
                  ['تحویل بار', MOCK_STATUS.belt],
                  ['تأخیر', MOCK_STATUS.delayLabel],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '11px 14px', textAlign: 'center', borderLeft: '1px solid #f2f4f7' }}>
                    <div style={{ fontSize: 10.5, color: '#8a96a6', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <label style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>اطلاع‌رسانی تأخیر</span>
                  <input type="checkbox" data-testid="fs-sms-toggle" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} />
                </span>
                <span style={{ fontSize: 11, color: '#8a96a6' }}>فعال‌سازی پیامک تغییر وضعیت پرواز</span>
              </label>
              <Link to="/manage-booking" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 14, padding: '14px 16px', textDecoration: 'none' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640', marginBottom: 6 }}>مدیریت رزرو</div>
                <div style={{ fontSize: 11, color: '#8a96a6' }}>تغییر صندلی، دانلود بلیط یا استرداد</div>
              </Link>
              <Link to="/support" style={{ background: '#fff', border: '1px solid #e8eef6', borderRadius: 14, padding: '14px 16px', textDecoration: 'none' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640', marginBottom: 6 }}>پشتیبانی ۲۴ ساعته</div>
                <div style={{ fontSize: 11, color: '#8a96a6' }}>در صورت هرگونه سؤال با ما تماس بگیرید</div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </PublicPageShell>
  );
}
