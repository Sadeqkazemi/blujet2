import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { setPassword as apiSetPassword } from '../../api/auth';
import { ApiRequestError } from '../../api/envelope';
import { faDigits } from '../../lib/fa-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';

// فراموشی رمز — matches design-reference/فراموشی رمز.dc.html: a customer-
// only flow (the design's own "بازگشت/ورود به حساب" links point at ورود و
// ثبت‌نام.dc.html, never the staff login). Staff has no self-service reset
// — see LoginPage.tsx's "فراموشی رمز عبور؟" link, which shows the design's
// own "contact IT" toast instead of coming here.
//
// Real backend, phone path: reuses the existing customer OTP challenge
// (POST /auth/otp/request + /auth/otp/verify) to prove phone ownership,
// then POST /auth/set-password (no current-password check needed). This
// also doubles as first-time password setup for a customer who only ever
// used OTP login — see docs/API.md's Phase 21 section.
//
// Real backend, email path (Phase 51): an alternative identifier for
// customers whose account has a VERIFIED email (Phase 17's
// emailVerifiedAt) — POST /auth/password-reset/email/request + /verify,
// same TwoFactorChallenge machinery under its own purpose. Offered in every
// locale (not just en/ar) since gating a security recovery method by UI
// display language would be an arbitrary, fragile restriction — some fa
// customers may also lack a reachable phone at reset time, and some en/ar
// customers may have one; the real gate is "does this account have a
// verified email", not which language the page is shown in.

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

type Method = 'phone' | 'email';

const STR: Record<StoredLocale, {
  heading: string;
  subtitlePhoneId: string;
  subtitleEmailId: string;
  subtitleCode: string;
  subtitlePassword: string;
  methodPhone: string;
  methodEmail: string;
  phoneLabel: string;
  emailLabel: string;
  sendCode: string;
  confirmCode: string;
  resendQuestion: string;
  resendNow: string;
  resendIn: string;
  newPasswordLabel: string;
  repeatPasswordLabel: string;
  savePassword: string;
  doneTitle: string;
  doneBody: string;
  loginBtn: string;
  backLink: string;
  errShort: string;
  errMismatch: string;
  errSendPhone: string;
  errSendEmail: string;
  errCode: string;
  errSave: string;
}> = {
  fa: {
    heading: 'بازیابی رمز عبور',
    subtitlePhoneId: 'موبایل حساب خود را وارد کنید تا کد بازیابی برایتان پیامک شود.',
    subtitleEmailId: 'ایمیل تأییدشدهٔ حساب خود را وارد کنید تا کد بازیابی برایتان ایمیل شود.',
    subtitleCode: 'کد تأیید ارسال شد — آن را وارد کنید.',
    subtitlePassword: 'رمز عبور جدید حساب خود را تعیین کنید.',
    methodPhone: 'موبایل',
    methodEmail: 'ایمیل',
    phoneLabel: 'موبایل حساب',
    emailLabel: 'ایمیل حساب',
    sendCode: 'ارسال کد بازیابی',
    confirmCode: 'تأیید کد',
    resendQuestion: 'کد را دریافت نکردید؟',
    resendNow: 'ارسال مجدد',
    resendIn: 'ارسال مجدد',
    newPasswordLabel: 'رمز عبور جدید',
    repeatPasswordLabel: 'تکرار رمز عبور جدید',
    savePassword: 'ذخیره رمز جدید',
    doneTitle: 'رمز عبور با موفقیت تغییر کرد',
    doneBody: 'اکنون می‌توانید با رمز جدید وارد حساب خود شوید.',
    loginBtn: 'ورود به حساب',
    backLink: '‹ بازگشت به صفحه ورود',
    errShort: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
    errMismatch: 'تکرار رمز با رمز جدید یکسان نیست.',
    errSendPhone: 'خطا در ارسال کد بازیابی.',
    errSendEmail: 'خطا در ارسال کد بازیابی به ایمیل.',
    errCode: 'کد وارد شده نادرست است.',
    errSave: 'خطا در ذخیره رمز عبور.',
  },
  en: {
    heading: 'Reset Password',
    subtitlePhoneId: 'Enter your account mobile number to receive a recovery code by SMS.',
    subtitleEmailId: "Enter your account's verified email to receive a recovery code by email.",
    subtitleCode: 'A verification code was sent — enter it below.',
    subtitlePassword: 'Set a new password for your account.',
    methodPhone: 'Mobile',
    methodEmail: 'Email',
    phoneLabel: 'Account Mobile Number',
    emailLabel: 'Account Email',
    sendCode: 'Send Recovery Code',
    confirmCode: 'Confirm Code',
    resendQuestion: "Didn't receive the code?",
    resendNow: 'Resend',
    resendIn: 'Resend',
    newPasswordLabel: 'New Password',
    repeatPasswordLabel: 'Repeat New Password',
    savePassword: 'Save New Password',
    doneTitle: 'Your password was changed successfully',
    doneBody: 'You can now sign in with your new password.',
    loginBtn: 'Sign In',
    backLink: '‹ Back to sign-in page',
    errShort: 'Password must be at least 8 characters.',
    errMismatch: 'Password confirmation does not match.',
    errSendPhone: 'Error sending the recovery code.',
    errSendEmail: 'Error sending the recovery code by email.',
    errCode: 'The code entered is incorrect.',
    errSave: 'Error saving the new password.',
  },
  ar: {
    heading: 'استعادة كلمة المرور',
    subtitlePhoneId: 'أدخل رقم جوال حسابك لتصلك رسالة نصية برمز الاستعادة.',
    subtitleEmailId: 'أدخل البريد الإلكتروني الموثّق لحسابك ليصلك رمز الاستعادة عبر البريد.',
    subtitleCode: 'تم إرسال رمز التحقق — أدخله أدناه.',
    subtitlePassword: 'حدّد كلمة مرور جديدة لحسابك.',
    methodPhone: 'الجوال',
    methodEmail: 'البريد الإلكتروني',
    phoneLabel: 'رقم جوال الحساب',
    emailLabel: 'البريد الإلكتروني للحساب',
    sendCode: 'إرسال رمز الاستعادة',
    confirmCode: 'تأكيد الرمز',
    resendQuestion: 'لم يصلك الرمز؟',
    resendNow: 'إعادة الإرسال',
    resendIn: 'إعادة الإرسال',
    newPasswordLabel: 'كلمة المرور الجديدة',
    repeatPasswordLabel: 'تكرار كلمة المرور الجديدة',
    savePassword: 'حفظ كلمة المرور الجديدة',
    doneTitle: 'تم تغيير كلمة المرور بنجاح',
    doneBody: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    loginBtn: 'تسجيل الدخول',
    backLink: '‹ العودة إلى صفحة الدخول',
    errShort: 'يجب أن تتكوّن كلمة المرور من ٨ أحرف على الأقل.',
    errMismatch: 'تكرار كلمة المرور غير مطابق.',
    errSendPhone: 'خطأ في إرسال رمز الاستعادة.',
    errSendEmail: 'خطأ في إرسال رمز الاستعادة عبر البريد الإلكتروني.',
    errCode: 'الرمز المُدخل غير صحيح.',
    errSave: 'خطأ في حفظ كلمة المرور الجديدة.',
  },
};

export default function ForgotPasswordPage() {
  const { requestOtp, verifyOtp, requestPasswordResetEmail, verifyPasswordResetEmail, signOut } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const [method, setMethod] = useState<Method>('phone');
  const [step, setStep] = useState<'id' | 'code' | 'password' | 'done'>('id');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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

  const rawTimer = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const timer = locale === 'fa' ? faDigits(rawTimer) : rawTimer;

  const identifier = method === 'phone' ? phone.trim() : email.trim();

  async function sendCode() {
    setError(null);
    setSubmitting(true);
    try {
      const id =
        method === 'phone' ? await requestOtp!(phone.trim()) : await requestPasswordResetEmail!(email.trim());
      setChallengeId(id);
      setStep('code');
      setLeft(RESEND_SECONDS);
    } catch (err) {
      const fallback = method === 'phone' ? t.errSendPhone : t.errSendEmail;
      setError(err instanceof ApiRequestError ? err.message : fallback);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (method === 'phone') {
        await verifyOtp!(challengeId, code.trim());
      } else {
        await verifyPasswordResetEmail!(challengeId, code.trim());
      }
      setStep('password');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errCode);
    } finally {
      setSubmitting(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pass1.length < 8) {
      setError(t.errShort);
      return;
    }
    if (pass1 !== pass2) {
      setError(t.errMismatch);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiSetPassword(pass1);
      // The customer just proved phone/email ownership, which also logs
      // them in — end that session so they log in fresh with the new
      // password/OTP, matching the design's explicit "ورود به حساب" step.
      await signOut();
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errSave);
    } finally {
      setSubmitting(false);
    }
  }

  const dir = locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';

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

  return (
    <div dir={dir} style={{ fontFamily: "'Vazirmatn Variable', Vazirmatn, sans-serif", minHeight: '100vh', background: '#f6f8fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>✈</div>
          <span style={{ fontWeight: 900, fontSize: 18, color: '#0d2640' }}>blujet</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 20, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: '26px 26px' }}>
          {step !== 'done' && (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0d2640', margin: '0 0 6px', textAlign: 'center' }}>{t.heading}</h1>
              <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 18px', textAlign: 'center', lineHeight: 1.9 }}>
                {step === 'id' && (method === 'phone' ? t.subtitlePhoneId : t.subtitleEmailId)}
                {step === 'code' && t.subtitleCode}
                {step === 'password' && t.subtitlePassword}
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
              <div style={{ display: 'flex', background: '#eef1f5', borderRadius: 11, padding: 3, marginBottom: 2 }}>
                <span data-testid="fp-method-phone" onClick={() => setMethod('phone')} style={seg(method === 'phone')}>
                  {t.methodPhone}
                </span>
                <span data-testid="fp-method-email" onClick={() => setMethod('email')} style={seg(method === 'email')}>
                  {t.methodEmail}
                </span>
              </div>
              {method === 'phone' ? (
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>{t.phoneLabel}</label>
                  <input data-testid="fp-id" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>{t.emailLabel}</label>
                  <input data-testid="fp-email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={inputStyle} />
                </div>
              )}
              <button
                type="submit"
                data-testid="fp-send"
                disabled={!identifier || submitting}
                style={{ border: 'none', borderRadius: 11, background: identifier && !submitting ? '#1668c4' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: identifier && !submitting ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                {t.sendCode}
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
                {t.confirmCode}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: '#8a96a6' }}>{t.resendQuestion}</span>
                {left > 0 ? (
                  <span style={{ color: '#6b7787' }}>{t.resendIn} ({timer})</span>
                ) : (
                  <span onClick={() => void sendCode()} style={{ color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                    {t.resendNow}
                  </span>
                )}
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={(e) => void savePassword(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>{t.newPasswordLabel}</label>
                <input type="password" data-testid="fp-pass1" dir="ltr" value={pass1} onChange={(e) => setPass1(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>{t.repeatPasswordLabel}</label>
                <input type="password" data-testid="fp-pass2" dir="ltr" value={pass2} onChange={(e) => setPass2(e.target.value)} style={inputStyle} />
              </div>
              <button
                type="submit"
                data-testid="fp-save"
                disabled={submitting}
                style={{ border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 0', fontSize: 13.5, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {t.savePassword}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div data-testid="fp-done" style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5ee', color: '#1f8a5b', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2640', marginBottom: 7 }}>{t.doneTitle}</div>
              <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 18px' }}>{t.doneBody}</p>
              <Link to="/signin" style={{ display: 'inline-block', background: '#1668c4', color: '#fff', padding: '11px 30px', borderRadius: 11, fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
                {t.loginBtn}
              </Link>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/signin" style={{ fontSize: 12, color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
            {t.backLink}
          </Link>
        </div>
      </div>
    </div>
  );
}
