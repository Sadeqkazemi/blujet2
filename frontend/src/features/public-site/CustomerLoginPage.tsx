import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, latinDigits } from '../../lib/fa-format';

// ورود و ثبت‌نام مشتریان — customer-only surface.
// Agency login/signup lives at /agency/login; staff at /login.
// OTP uses existing auth hooks (verification find-or-creates the account).

const RESEND_SECONDS = 120;

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 13px',
  border: '1.5px solid #e3e9f1',
  borderRadius: 11,
  fontFamily: 'inherit',
  fontSize: 13.5,
  color: '#16202e',
  background: '#fff',
  outline: 'none',
};

function sanitizeMobileInput(raw: string) {
  return latinDigits(raw).replace(/[^\d]/g, '').slice(0, 11);
}

function sanitizeOtpInput(raw: string) {
  return latinDigits(raw).replace(/\D/g, '').slice(0, 6);
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: '#5a6678',
  marginBottom: 6,
};

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

function fmtTimer(s: number, locale: StoredLocale) {
  const raw = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return locale === 'fa' ? faDigits(raw) : raw;
}

const STR: Record<
  StoredLocale,
  {
    tabLogin: string;
    tabSignup: string;
    subtitleLogin: string;
    subtitleSignup: string;
    mobileLabel: string;
    passwordLabel: string;
    loginSubmit: string;
    useOtpLink: string;
    forgotPassword: string;
    fullNameLabel: string;
    namePlaceholder: string;
    emailOptionalLabel: string;
    termsCheckbox: string;
    getCode: string;
    loginConsentNote: string;
    usePasswordLink: string;
    otpLabel: string;
    confirmLogin: string;
    confirmSignup: string;
    resendIn: string;
    resend: string;
    editNumber: string;
    agencyQuestion: string;
    agencyLoginLink: string;
    staffQuestion: string;
    staffLoginLink: string;
    errSendCode: string;
    errInvalidCode: string;
    errLoginFailed: string;
  }
> = {
  fa: {
    tabLogin: 'ورود',
    tabSignup: 'ثبت‌نام',
    subtitleLogin: 'برای ادامه، وارد حساب کاربری خود شوید.',
    subtitleSignup: 'حساب کاربری جدید بسازید و سفرتان را آغاز کنید.',
    mobileLabel: 'شماره موبایل',
    passwordLabel: 'رمز عبور',
    loginSubmit: 'ورود',
    useOtpLink: 'ورود با کد پیامکی',
    forgotPassword: 'فراموشی رمز عبور؟',
    fullNameLabel: 'نام و نام خانوادگی',
    namePlaceholder: 'مثال: نگار رضایی',
    emailOptionalLabel: 'ایمیل (اختیاری)',
    termsCheckbox: 'قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.',
    getCode: 'دریافت کد',
    loginConsentNote: 'با ورود، قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.',
    usePasswordLink: 'ورود با رمز عبور',
    otpLabel: 'کد تأیید (OTP)',
    confirmLogin: 'تأیید و ورود',
    confirmSignup: 'ایجاد حساب کاربری',
    resendIn: 'ارسال مجدد کد',
    resend: 'ارسال مجدد کد',
    editNumber: 'ورود با شماره دیگری؟ ویرایش',
    agencyQuestion: 'آژانس همکار هستید؟',
    agencyLoginLink: 'ورود و ثبت‌نام آژانس',
    staffQuestion: 'کارمند یا مدیر هستید؟',
    staffLoginLink: 'ورود مدیران و کارمندان',
    errSendCode: 'خطا در ارسال کد.',
    errInvalidCode: 'کد نامعتبر است.',
    errLoginFailed: 'ورود ناموفق بود.',
  },
  en: {
    tabLogin: 'Log in',
    tabSignup: 'Sign up',
    subtitleLogin: 'Sign in to your account to continue.',
    subtitleSignup: 'Create a new account and start your journey.',
    mobileLabel: 'Mobile Number',
    passwordLabel: 'Password',
    loginSubmit: 'Log in',
    useOtpLink: 'Sign in with SMS code',
    forgotPassword: 'Forgot password?',
    fullNameLabel: 'Full Name',
    namePlaceholder: 'e.g. Negar Rezaei',
    emailOptionalLabel: 'Email (optional)',
    termsCheckbox: "I accept blujet's Terms & Conditions and Privacy Policy.",
    getCode: 'Get Code',
    loginConsentNote: "By signing in, I accept blujet's Terms & Conditions and Privacy Policy.",
    usePasswordLink: 'Sign in with password',
    otpLabel: 'Verification Code (OTP)',
    confirmLogin: 'Confirm & Log In',
    confirmSignup: 'Confirm & Create Account',
    resendIn: 'Resend code',
    resend: 'Resend code',
    editNumber: 'Use a different number? Edit',
    agencyQuestion: 'Partner agency?',
    agencyLoginLink: 'Agency login & signup',
    staffQuestion: 'Are you a staff member or manager?',
    staffLoginLink: 'Staff & Manager Login',
    errSendCode: 'Error sending the code.',
    errInvalidCode: 'Invalid code.',
    errLoginFailed: 'Login failed.',
  },
  ar: {
    tabLogin: 'تسجيل الدخول',
    tabSignup: 'إنشاء حساب',
    subtitleLogin: 'سجّل الدخول إلى حسابك للمتابعة.',
    subtitleSignup: 'أنشئ حسابًا جديدًا وابدأ رحلتك.',
    mobileLabel: 'رقم الجوال',
    passwordLabel: 'كلمة المرور',
    loginSubmit: 'تسجيل الدخول',
    useOtpLink: 'تسجيل الدخول برمز الرسائل',
    forgotPassword: 'نسيت كلمة المرور؟',
    fullNameLabel: 'الاسم الكامل',
    namePlaceholder: 'مثلاً: نيغار رضائي',
    emailOptionalLabel: 'البريد الإلكتروني (اختياري)',
    termsCheckbox: 'أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بـ blujet.',
    getCode: 'الحصول على الرمز',
    loginConsentNote: 'بتسجيل الدخول، أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بـ blujet.',
    usePasswordLink: 'تسجيل الدخول بكلمة المرور',
    otpLabel: 'رمز التحقق (OTP)',
    confirmLogin: 'تأكيد وتسجيل الدخول',
    confirmSignup: 'تأكيد وإنشاء الحساب',
    resendIn: 'إعادة إرسال الرمز',
    resend: 'إعادة إرسال الرمز',
    editNumber: 'الدخول برقم آخر؟ تعديل',
    agencyQuestion: 'وكالة شريكة؟',
    agencyLoginLink: 'تسجيل دخول وتسجيل الوكالة',
    staffQuestion: 'هل أنت موظف أو مدير؟',
    staffLoginLink: 'تسجيل دخول الموظفين والمديرين',
    errSendCode: 'خطأ في إرسال الرمز.',
    errInvalidCode: 'رمز غير صالح.',
    errLoginFailed: 'فشل تسجيل الدخول.',
  },
};

export default function CustomerLoginPage() {
  const { status, user, requestOtp, verifyOtp, passwordLogin } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [useOtp, setUseOtp] = useState(true);

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [userPassword, setUserPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useCountdown();

  const destination = location.state?.from ?? '/';
  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'USER') navigate(destination, { replace: true });
  }, [status, user, navigate, destination]);

  const isLogin = mode === 'login';

  async function sendOtp() {
    setError(null);
    setBusy(true);
    try {
      const id = await requestOtp!(phone.trim());
      setChallengeId(id);
      timer.start();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errSendCode);
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
      setError(err instanceof ApiRequestError ? err.message : t.errInvalidCode);
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await passwordLogin!(phone.trim(), userPassword);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errLoginFailed);
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    setChallengeId(null);
    setCode('');
    setError(null);
    setUseOtp(true);
    setUserPassword('');
  }

  return (
    <PublicPageShell>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '44px 22px 72px' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #eef1f5',
            borderRadius: 20,
            boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)',
            padding: '24px 26px',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1.5px solid #eef1f5', marginBottom: 16 }}>
            {(
              [
                ['login', t.tabLogin],
                ['signup', t.tabSignup],
              ] as const
            ).map(([m, lbl]) => (
              <span
                key={m}
                data-testid={`signin-tab-${m}`}
                onClick={() => {
                  setMode(m);
                  resetFlow();
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

          <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 16px', lineHeight: 1.9 }}>
            {isLogin ? t.subtitleLogin : t.subtitleSignup}
          </p>
          {error && (
            <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>
              {error}
            </p>
          )}

          {isLogin && !useOtp && (
            <form onSubmit={(e) => void onPasswordLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.mobileLabel}</label>
                <input
                  data-testid="signin-pw-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(sanitizeMobileInput(e.target.value))}
                  placeholder="09xxxxxxxxx"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.passwordLabel}</label>
                <input
                  type="password"
                  data-testid="signin-pw-password"
                  dir="ltr"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                data-testid="signin-pw-submit"
                disabled={busy || !phone.trim() || !userPassword}
                style={primaryBtn(!busy && !!phone.trim() && !!userPassword)}
              >
                {t.loginSubmit}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span data-testid="signin-use-otp" onClick={() => setUseOtp(true)} style={{ color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                  {t.useOtpLink}
                </span>
                <Link to="/forgot-password" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                  {t.forgotPassword}
                </Link>
              </div>
            </form>
          )}

          {(useOtp || !isLogin) && !challengeId && (
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
                    <label style={labelStyle}>{t.fullNameLabel}</label>
                    <input
                      data-testid="signup-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.emailOptionalLabel}</label>
                    <input
                      data-testid="signup-email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
              <div>
                <label style={labelStyle}>{t.mobileLabel}</label>
                <input
                  data-testid="signin-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(sanitizeMobileInput(e.target.value))}
                  placeholder="09xxxxxxxxx"
                  style={inputStyle}
                />
              </div>
              {!isLogin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#5a6678', cursor: 'pointer' }}>
                  <input type="checkbox" data-testid="signup-terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>{t.termsCheckbox}</span>
                </label>
              )}
              <button
                type="submit"
                data-testid="signin-request"
                disabled={busy || !phone.trim() || (!isLogin && (!fullName.trim() || !terms))}
                style={primaryBtn(!busy && !!phone.trim() && (isLogin || (!!fullName.trim() && terms)))}
              >
                {t.getCode}
              </button>
              {isLogin && (
                <>
                  <p style={{ fontSize: 11, color: '#8a96a6', margin: 0, lineHeight: 1.8, textAlign: 'center' }}>{t.loginConsentNote}</p>
                  <span
                    data-testid="signin-use-password"
                    onClick={() => setUseOtp(false)}
                    style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                  >
                    {t.usePasswordLink}
                  </span>
                </>
              )}
            </form>
          )}

          {challengeId && (
            <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.otpLabel}</label>
                <input
                  data-testid="signin-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(sanitizeOtpInput(e.target.value))}
                  placeholder="- - - - - -"
                  maxLength={6}
                  style={{ ...inputStyle, fontSize: 15, letterSpacing: 4, textAlign: 'center' }}
                />
              </div>
              {import.meta.env.DEV && (
                <p data-testid="signin-dev-otp-hint" style={{ margin: 0, fontSize: 11, color: '#6b7585', textAlign: 'center' }}>
                  {locale === 'en' ? 'Dev OTP code: 123456' : 'کد توسعه (OTP): ۱۲۳۴۵۶'}
                </p>
              )}
              <button type="submit" data-testid="signin-verify" disabled={busy || !code.trim()} style={primaryBtn(!busy && !!code.trim())}>
                {isLogin ? t.confirmLogin : t.confirmSignup}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {timer.left > 0 ? (
                  <span data-testid="signin-resend-timer" style={{ fontSize: 11.5, color: '#6b7787' }}>
                    {t.resendIn} ({fmtTimer(timer.left, locale)})
                  </span>
                ) : (
                  <span data-testid="signin-resend" onClick={() => void sendOtp()} style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                    {t.resend}
                  </span>
                )}
                <span onClick={resetFlow} style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer' }}>
                  {t.editNumber}
                </span>
              </div>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#6b7585', lineHeight: 2 }}>
          <div>
            {t.agencyQuestion}{' '}
            <Link to="/agency/login" data-testid="signin-agency-link" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
              {t.agencyLoginLink}
            </Link>
          </div>
          <div>
            {t.staffQuestion}{' '}
            <Link to="/login" data-testid="signin-staff-link" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
              {t.staffLoginLink}
            </Link>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
