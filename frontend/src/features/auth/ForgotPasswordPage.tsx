import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { setPassword as apiSetPassword } from '../../api/auth';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';

// فراموشی رمز — matches design-reference/فراموشی رمز.dc.html: a customer-
// only flow (the design's own "بازگشت/ورود به حساب" links point at ورود و
// ثبت‌نام.dc.html, never the staff login). Staff has no self-service reset
// — see LoginPage.tsx's "فراموشی رمز عبور؟" link, which shows the design's
// own "contact IT" toast instead of coming here.
//
// Real backend: reuses the existing customer OTP challenge (POST
// /auth/otp/request + /auth/otp/verify) to prove phone ownership, then
// POST /auth/set-password (no current-password check needed). This also
// doubles as first-time password setup for a customer who only ever used
// OTP login — see docs/API.md's Phase 21 section.

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

export default function ForgotPasswordPage() {
  const { requestOtp, verifyOtp, signOut } = useAuth();
  const [step, setStep] = useState<'id' | 'code' | 'password' | 'done'>('id');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const timer = faDigits(`${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`);

  async function sendCode() {
    setError(null);
    setSubmitting(true);
    try {
      const id = await requestOtp!(phone.trim());
      setChallengeId(id);
      setStep('code');
      setLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ارسال کد بازیابی.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyOtp!(challengeId, code.trim());
      setStep('password');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'کد وارد شده نادرست است.');
    } finally {
      setSubmitting(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pass1.length < 8) {
      setError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (pass1 !== pass2) {
      setError('تکرار رمز با رمز جدید یکسان نیست.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiSetPassword(pass1);
      // The customer just proved phone ownership via OTP, which also logs
      // them in — end that session so they log in fresh with the new
      // password/OTP, matching the design's "ورود به حساب" step.
      await signOut();
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ذخیره رمز عبور.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", minHeight: '100vh', background: '#f6f8fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>✈</div>
          <span style={{ fontWeight: 900, fontSize: 18, color: '#0d2640' }}>blujet</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 20, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: '26px 26px' }}>
          {step !== 'done' && (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0d2640', margin: '0 0 6px', textAlign: 'center' }}>بازیابی رمز عبور</h1>
              <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 18px', textAlign: 'center', lineHeight: 1.9 }}>
                {step === 'id' && 'موبایل حساب خود را وارد کنید تا کد بازیابی برایتان پیامک شود.'}
                {step === 'code' && 'کد تأیید ارسال شد — آن را وارد کنید.'}
                {step === 'password' && 'رمز عبور جدید حساب خود را تعیین کنید.'}
              </p>
            </>
          )}
          {error && <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>}

          {step === 'id' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>موبایل حساب</label>
                <input data-testid="fp-id" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
              </div>
              <button
                type="submit"
                data-testid="fp-send"
                disabled={!phone.trim() || submitting}
                style={{ border: 'none', borderRadius: 11, background: phone.trim() && !submitting ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: phone.trim() && !submitting ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                ارسال کد بازیابی
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={(e) => void confirmCode(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                data-testid="fp-code"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="_ _ _ _ _ _"
                style={{ ...inputStyle, fontSize: 16, letterSpacing: 6, textAlign: 'center' }}
              />
              <button
                type="submit"
                data-testid="fp-verify"
                disabled={code.trim().length < 4 || submitting}
                style={{ border: 'none', borderRadius: 11, background: code.trim().length >= 4 && !submitting ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: code.trim().length >= 4 && !submitting ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                تأیید کد
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: '#8a96a6' }}>کد را دریافت نکردید؟</span>
                {left > 0 ? (
                  <span style={{ color: '#6b7787' }}>ارسال مجدد ({timer})</span>
                ) : (
                  <span onClick={() => void sendCode()} style={{ color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                    ارسال مجدد
                  </span>
                )}
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={(e) => void savePassword(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>رمز عبور جدید</label>
                <input type="password" data-testid="fp-pass1" dir="ltr" value={pass1} onChange={(e) => setPass1(e.target.value)} placeholder="حداقل ۸ کاراکتر" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>تکرار رمز عبور جدید</label>
                <input type="password" data-testid="fp-pass2" dir="ltr" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="تکرار رمز" style={inputStyle} />
              </div>
              <button
                type="submit"
                data-testid="fp-save"
                disabled={submitting}
                style={{ border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                ذخیره رمز جدید
              </button>
            </form>
          )}

          {step === 'done' && (
            <div data-testid="fp-done" style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5ee', color: '#1f8a5b', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2640', marginBottom: 7 }}>رمز عبور با موفقیت تغییر کرد</div>
              <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 18px' }}>اکنون می‌توانید با رمز جدید وارد حساب خود شوید.</p>
              <Link to="/signin" style={{ display: 'inline-block', background: '#1668c4', color: '#fff', padding: '11px 30px', borderRadius: 11, fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
                ورود به حساب
              </Link>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/signin" style={{ fontSize: 12, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
            ‹ بازگشت به صفحه ورود
          </Link>
        </div>
      </div>
    </div>
  );
}
