import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';

// ورود و ثبتنام — rebuilt to match design-reference/ورود و ثبتنام.dc.html:
// ورود/ثبت‌نام tabs, کاربر/آژانس segment, OTP with resend countdown.
// Customer OTP uses the existing auth hooks (verification find-or-creates
// the account, so the signup tab's OTP is the same flow); agency signup is
// a mock submit per the "no backend work" scope.

const RESEND_SECONDS = 120;

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 13px',
  border: '1.5px solid #e3e9f1',
  borderRadius: 11,
  fontFamily: 'inherit',
  fontSize: 13.5,
  outline: 'none',
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 };

function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 11,
    background: enabled ? '#1668c4' : '#aab8c8',
    color: '#fff',
    padding: '12px 0',
    width: '100%',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'inherit',
  };
}

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return { left, start: () => setLeft(RESEND_SECONDS) };
}

function fmtTimer(s: number) {
  return faDigits(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
}

export default function CustomerLoginPage() {
  const { status, user, requestOtp, verifyOtp, agencyLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [acct, setAcct] = useState<'user' | 'agency'>('user');

  // user OTP flow (shared by login and signup tabs)
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  // agency
  const [agencyId, setAgencyId] = useState('');
  const [agencyPass, setAgencyPass] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [agencySubmitted, setAgencySubmitted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useCountdown();

  const destination = location.state?.from ?? '/';
  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'USER') navigate(destination, { replace: true });
  }, [status, user, navigate, destination]);

  const isLogin = mode === 'login';
  const isAgency = acct === 'agency';

  async function sendOtp() {
    setError(null);
    setBusy(true);
    try {
      const id = await requestOtp!(phone.trim());
      setChallengeId(id);
      timer.start();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ارسال کد.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyOtp!(challengeId!, code.trim());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'کد نامعتبر است.');
    } finally {
      setBusy(false);
    }
  }

  async function onAgencyLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await agencyLogin!(agencyId.trim(), agencyPass);
      navigate('/agency', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'ورود آژانس ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  const seg = (on: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center',
    padding: '8px 0',
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: on ? 700 : 600,
    color: on ? '#1668c4' : '#6b7585',
    background: on ? '#fff' : 'transparent',
    boxShadow: on ? '0 2px 7px rgba(13,38,102,.14)' : 'none',
    cursor: 'pointer',
  });

  function resetFlow() {
    setChallengeId(null);
    setCode('');
    setError(null);
  }

  const subtitle = isLogin
    ? isAgency
      ? 'با حساب آژانس همکار خود وارد پنل B2B شوید.'
      : 'برای ادامه، وارد حساب کاربری خود شوید.'
    : isAgency
      ? 'آژانس خود را ثبت کنید و به نرخ‌های ویژه همکاران دسترسی پیدا کنید.'
      : 'حساب کاربری جدید بسازید و سفرتان را آغاز کنید.';

  return (
    <PublicPageShell>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '44px 22px 72px' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 20, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: '24px 26px' }}>
          {/* mode tabs */}
          <div style={{ display: 'flex', borderBottom: '1.5px solid #eef1f5', marginBottom: 16 }}>
            {(
              [
                ['login', 'ورود'],
                ['signup', 'ثبت‌نام'],
              ] as const
            ).map(([m, lbl]) => (
              <span
                key={m}
                data-testid={`signin-tab-${m}`}
                onClick={() => {
                  setMode(m);
                  resetFlow();
                  setAgencySubmitted(false);
                }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 0',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: mode === m ? '#1668c4' : '#6b7787',
                  borderBottom: mode === m ? '2.5px solid #1668c4' : '2.5px solid transparent',
                  marginBottom: -1.5,
                }}
              >
                {lbl}
              </span>
            ))}
          </div>

          {/* account segment */}
          <div style={{ display: 'flex', background: '#eef1f5', borderRadius: 11, padding: 3, marginBottom: 14 }}>
            <span data-testid="signin-acct-user" onClick={() => { setAcct('user'); resetFlow(); }} style={seg(!isAgency)}>
              کاربر
            </span>
            <span data-testid="signin-acct-agency" onClick={() => { setAcct('agency'); resetFlow(); }} style={seg(isAgency)}>
              آژانس
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 16px', lineHeight: 1.9 }}>{subtitle}</p>
          {error && <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>}

          {/* ---- USER LOGIN / SIGNUP (same OTP flow; signup adds profile fields) ---- */}
          {!isAgency && !challengeId && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendOtp();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {!isLogin && (
                <>
                  <div>
                    <label style={labelStyle}>نام و نام خانوادگی</label>
                    <input data-testid="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: نگار رضایی" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>ایمیل (اختیاری)</label>
                    <input data-testid="signup-email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={inputStyle} />
                  </div>
                </>
              )}
              <div>
                <label style={labelStyle}>شماره موبایل</label>
                <input data-testid="signin-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
              </div>
              {!isLogin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#5a6678', cursor: 'pointer' }}>
                  <input type="checkbox" data-testid="signup-terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.
                  </span>
                </label>
              )}
              <button
                type="submit"
                data-testid="signin-request"
                disabled={busy || !phone.trim() || (!isLogin && (!fullName.trim() || !terms))}
                style={primaryBtn(!busy && !!phone.trim() && (isLogin || (!!fullName.trim() && terms)))}
              >
                دریافت کد
              </button>
              {isLogin && (
                <p style={{ fontSize: 11, color: '#8a96a6', margin: 0, lineHeight: 1.8, textAlign: 'center' }}>
                  با ورود، قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.
                </p>
              )}
            </form>
          )}

          {!isAgency && challengeId && (
            <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>کد تأیید (OTP)</label>
                <input
                  data-testid="signin-code"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="- - - - - -"
                  style={{ ...inputStyle, fontSize: 15, letterSpacing: 4, textAlign: 'center' }}
                />
              </div>
              <button type="submit" data-testid="signin-verify" disabled={busy || !code.trim()} style={primaryBtn(!busy && !!code.trim())}>
                {isLogin ? 'تأیید و ورود' : 'ایجاد حساب کاربری'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {timer.left > 0 ? (
                  <span data-testid="signin-resend-timer" style={{ fontSize: 11.5, color: '#6b7787' }}>
                    ارسال مجدد کد ({fmtTimer(timer.left)})
                  </span>
                ) : (
                  <span data-testid="signin-resend" onClick={() => void sendOtp()} style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                    ارسال مجدد کد
                  </span>
                )}
                <span onClick={resetFlow} style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                  ورود با شماره دیگری؟ ویرایش
                </span>
              </div>
            </form>
          )}

          {/* ---- AGENCY LOGIN ---- */}
          {isAgency && isLogin && (
            <form onSubmit={onAgencyLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>نام کاربری / کد آژانس</label>
                <input data-testid="agency-id" dir="ltr" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} placeholder="کد آژانس همکار" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>رمز عبور</label>
                <input type="password" data-testid="agency-pass" dir="ltr" value={agencyPass} onChange={(e) => setAgencyPass(e.target.value)} style={inputStyle} />
              </div>
              <button type="submit" data-testid="agency-login-btn" disabled={busy || !agencyId.trim() || !agencyPass} style={primaryBtn(!busy && !!agencyId.trim() && !!agencyPass)}>
                ورود به پنل آژانس
              </button>
            </form>
          )}

          {/* ---- AGENCY SIGNUP (mock submit) ---- */}
          {isAgency && !isLogin && (
            agencySubmitted ? (
              <div data-testid="agency-signup-done" style={{ background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, color: '#1f8a5b', marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>درخواست همکاری ثبت شد</div>
                <div style={{ fontSize: 11.5, color: '#5a6678', lineHeight: 1.9 }}>
                  حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAgencySubmitted(true);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div>
                  <label style={labelStyle}>نام شرکت/آژانس</label>
                  <input data-testid="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="نام آژانس" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>شماره مجوز بند ب</label>
                  <input data-testid="agency-license" dir="ltr" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="XXXX-XXXX" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>نام مدیر آژانس</label>
                  <input placeholder="نام مسئول" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>شماره موبایل</label>
                  <input dir="ltr" placeholder="09xxxxxxxxx" style={inputStyle} />
                </div>
                <button type="submit" data-testid="agency-signup-btn" disabled={!agencyName.trim() || !licenseNo.trim()} style={primaryBtn(!!agencyName.trim() && !!licenseNo.trim())}>
                  ثبت درخواست همکاری
                </button>
                <p style={{ fontSize: 10.5, color: '#8a96a6', margin: 0, lineHeight: 1.9 }}>
                  حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.
                </p>
              </form>
            )
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#6b7585' }}>
          کارمند یا مدیر هستید؟{' '}
          <a href="/login" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
            ورود مدیران و کارمندان
          </a>
        </div>
      </div>
    </PublicPageShell>
  );
}
