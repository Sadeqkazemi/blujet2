import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { faDigits } from '../../lib/fa-format';

// فراموشی رمز — mock-only page matching design-reference/فراموشی رمز.dc.html:
// three steps (identifier → 5-digit code with resend countdown → new
// password) ending in the success state. No backend reset flow exists yet,
// so every step advances client-side like the design mock.

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
  const [step, setStep] = useState<'id' | 'code' | 'password' | 'done'>('id');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const timer = faDigits(`${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`);

  function savePassword(e: React.FormEvent) {
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
    setStep('done');
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
                {step === 'id' && 'موبایل یا ایمیل حساب خود را وارد کنید تا کد بازیابی برایتان ارسال شود.'}
                {step === 'code' && 'کد تأیید ۵ رقمی ارسال شد — آن را وارد کنید.'}
                {step === 'password' && 'رمز عبور جدید حساب خود را تعیین کنید.'}
              </p>
            </>
          )}
          {error && <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>}

          {step === 'id' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep('code');
                setLeft(RESEND_SECONDS);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>موبایل یا ایمیل حساب</label>
                <input data-testid="fp-id" dir="ltr" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
              </div>
              <button
                type="submit"
                data-testid="fp-send"
                disabled={!identifier.trim()}
                style={{ border: 'none', borderRadius: 11, background: identifier.trim() ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: identifier.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                ارسال کد بازیابی
              </button>
            </form>
          )}

          {step === 'code' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep('password');
                setError(null);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <input
                data-testid="fp-code"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="_ _ _ _ _"
                style={{ ...inputStyle, fontSize: 16, letterSpacing: 6, textAlign: 'center' }}
              />
              <button
                type="submit"
                data-testid="fp-verify"
                disabled={code.trim().length < 5}
                style={{ border: 'none', borderRadius: 11, background: code.trim().length >= 5 ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: code.trim().length >= 5 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                تأیید کد
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: '#8a96a6' }}>کد را دریافت نکردید؟</span>
                {left > 0 ? (
                  <span style={{ color: '#9aa4b2' }}>ارسال مجدد ({timer})</span>
                ) : (
                  <span onClick={() => setLeft(RESEND_SECONDS)} style={{ color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                    ارسال مجدد
                  </span>
                )}
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                style={{ border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
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
              <Link to="/login" style={{ display: 'inline-block', background: '#1668c4', color: '#fff', padding: '11px 30px', borderRadius: 11, fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
                ورود به حساب
              </Link>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login" style={{ fontSize: 12, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
            ‹ بازگشت به صفحه ورود
          </Link>
        </div>
      </div>
    </div>
  );
}
