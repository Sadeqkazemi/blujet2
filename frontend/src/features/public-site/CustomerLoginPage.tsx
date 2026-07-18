import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';

// ورود و ثبتنام (customer) — phone + SMS OTP per the design. One flow
// covers both login and signup since OTP verification find-or-creates the
// USER account server-side. Staff keep their separate /login surface.
export default function CustomerLoginPage() {
  const { status, user, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = location.state?.from ?? '/';

  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'USER') navigate(destination, { replace: true });
  }, [status, user, navigate, destination]);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const id = await requestOtp!(phone.trim());
      setChallengeId(id);
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

  return (
    <PublicPageShell>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '52px 22px 72px' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 20, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: '28px 26px' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, margin: '0 auto 12px' }}>
              ✈
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>ورود / ثبت‌نام</h1>
            <p style={{ fontSize: 12.5, color: '#6b7585', margin: 0, lineHeight: 1.8 }}>
              {challengeId ? 'کد پیامک‌شده به موبایل خود را وارد کنید.' : 'برای ادامه، وارد حساب کاربری خود شوید.'}
            </p>
          </div>

          {error && <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>}

          {!challengeId ? (
            <form onSubmit={onRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="cust-phone" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  شماره موبایل
                </label>
                <input
                  id="cust-phone"
                  data-testid="signin-phone"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxxx"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
                />
              </div>
              <button
                type="submit"
                data-testid="signin-request"
                disabled={busy || !phone.trim()}
                style={{ border: 'none', borderRadius: 11, background: phone.trim() ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: phone.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                دریافت کد
              </button>
              <p style={{ fontSize: 11, color: '#8a96a6', margin: '4px 0 0', lineHeight: 1.8, textAlign: 'center' }}>
                با ورود، قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.
              </p>
            </form>
          ) : (
            <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="cust-code" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
                  کد تأیید (OTP)
                </label>
                <input
                  id="cust-code"
                  data-testid="signin-code"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="- - - - - -"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 15, letterSpacing: 4, textAlign: 'center', outline: 'none' }}
                />
              </div>
              <button
                type="submit"
                data-testid="signin-verify"
                disabled={busy || !code.trim()}
                style={{ border: 'none', borderRadius: 11, background: code.trim() ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: code.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                تأیید و ورود
              </button>
              <button
                type="button"
                onClick={() => {
                  setChallengeId(null);
                  setCode('');
                  setError(null);
                }}
                style={{ background: 'none', border: 'none', color: '#1668c4', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ویرایش شماره موبایل
              </button>
            </form>
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
