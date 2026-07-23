import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import { fetchAirports } from '../../api/publicSite';
import { lookupFlightStatus } from '../../api/flight-status';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDate, dayjs } from '../../lib/jalali';
import { ApiRequestError } from '../../api/envelope';
import type { Airport } from '../../types/public-site';
import type { FlightStatusResult } from '../../types/flight-status';

// وضعیت پرواز — matches design-reference/وضعیت پرواز.dc.html's layout, now
// backed by the real FlightInstance data (Phase 22). The design's status
// card also shows گیت/تحویل بار/تأخیر/ترمینال — none of those are modeled
// anywhere in this codebase (no gate-assignment/baggage-belt/delay-minutes
// operational system exists yet), so this real version shows only what's
// real (route, times, aircraft, status) and drops the fabricated fields —
// see docs/API.md's Phase 22 section for the explicit deferral.

const STATUS_META: Record<FlightStatusResult['status'], { color: string; bg: string }> = {
  SCHEDULED: { color: '#1f8a5b', bg: '#1f8a5b' },
  DEPARTED: { color: '#1668c4', bg: '#1668c4' },
  CANCELLED: { color: '#d64545', bg: '#d64545' },
};

function todayIso() {
  return dayjs().toDate().toISOString();
}

export default function FlightStatusPage() {
  const [mode, setMode] = useState<'flightNo' | 'route'>('flightNo');
  const [flightNo, setFlightNo] = useState('');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(todayIso());
  const [airports, setAirports] = useState<Airport[]>([]);
  const [result, setResult] = useState<FlightStatusResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsOn, setSmsOn] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotFound(false);
    setResult(null);
    if (!dateIso) return;
    setSearching(true);
    try {
      const date = dateIso.slice(0, 10);
      const data =
        mode === 'flightNo'
          ? await lookupFlightStatus({ flightNo: flightNo.trim(), date })
          : await lookupFlightStatus({ origin, dest, date });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'NOT_FOUND') {
        setNotFound(true);
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'خطا در جستجوی وضعیت پرواز.');
      }
    } finally {
      setSearching(false);
    }
  }

  const canSearch = mode === 'flightNo' ? !!flightNo.trim() && !!dateIso : !!origin && !!dest && !!dateIso;

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
                  setResult(null);
                  setNotFound(false);
                  setError(null);
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

          <form onSubmit={(e) => void search(e)} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
                  <label htmlFor="fs-origin" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                    مبدأ
                  </label>
                  <select
                    id="fs-origin"
                    data-testid="fs-origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: '#fff' }}
                  >
                    <option value="">انتخاب کنید</option>
                    {airports.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.cityFa} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <label htmlFor="fs-dest" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                    مقصد
                  </label>
                  <select
                    id="fs-dest"
                    data-testid="fs-dest"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: '#fff' }}
                  >
                    <option value="">انتخاب کنید</option>
                    {airports.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.cityFa} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div style={{ flex: '1 1 150px', border: '1.5px solid #e3e9f1', borderRadius: 11 }}>
              <JalaliDatePicker label="تاریخ" value={dateIso} onChange={setDateIso} testId="fs-date" />
            </div>
            <button
              type="submit"
              data-testid="fs-search"
              disabled={!canSearch || searching}
              style={{ flex: 'none', border: 'none', borderRadius: 11, background: canSearch && !searching ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 26px', fontSize: 13.5, fontWeight: 800, cursor: canSearch && !searching ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
            >
              {searching ? 'در حال جستجو…' : 'جستجو'}
            </button>
          </form>
        </div>

        {error && (
          <p style={{ marginTop: 16, borderRadius: 10, background: '#fef2f2', padding: 12, fontSize: 12.5, color: '#e5484d' }}>{error}</p>
        )}

        {notFound && (
          <div data-testid="fs-not-found" style={{ marginTop: 22, background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2640', marginBottom: 8 }}>پروازی یافت نشد</div>
            <p style={{ fontSize: 12, color: '#8a96a6', margin: 0 }}>اطلاعات وارد‌شده با هیچ پروازی مطابقت ندارد. شماره پرواز یا مسیر و تاریخ را بررسی کنید.</p>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 22 }}>
            <div data-testid="fs-result" style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.3)' }}>
              <div style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                  <span>✈</span> blujet
                </span>
                <span style={{ fontSize: 12 }}>
                  <span dir="ltr">{result.flightNo}</span> · {formatJalaliDate(result.departureAt)}
                </span>
                <span
                  data-testid="fs-status-pill"
                  style={{ background: STATUS_META[result.status].bg, fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 14 }}
                >
                  {result.statusLabelFa}
                </span>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {result.originCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7787' }}>{result.originCityFa}</div>
                  <div className="font-num" style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>
                    {faDigits(dayjs(result.departureAt).calendar('jalali').format('HH:mm'))}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: '#8a96a6', fontSize: 11 }}>
                  <div style={{ borderTop: '2px dashed #d5e1f0', margin: '8px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -10, right: '50%', transform: 'translateX(50%)', background: '#fff', padding: '0 8px', color: '#1668c4' }}>✈</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {result.destCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7787' }}>{result.destCityFa}</div>
                  <div className="font-num" style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>
                    {faDigits(dayjs(result.arrivalAt).calendar('jalali').format('HH:mm'))}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f2f4f7', padding: '11px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: '#8a96a6', marginBottom: 3 }}>هواپیما</div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>{result.aircraftType}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <label
                title="به‌زودی"
                style={{ background: '#f6f8fb', border: '1px solid #e8eef6', borderRadius: 14, padding: '14px 16px', cursor: 'not-allowed', display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.7 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>اطلاع‌رسانی تأخیر (به‌زودی)</span>
                  <input type="checkbox" data-testid="fs-sms-toggle" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} disabled />
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
