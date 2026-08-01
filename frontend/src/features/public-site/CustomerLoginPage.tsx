import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { ApiRequestError } from '../../api/envelope';
import { requestAgencySignupOtp, submitAgencyRequest } from '../../api/agencies';
import { faDigits } from '../../lib/fa-format';

// ورود و ثبتنام — rebuilt to match design-reference/ورود و ثبتنام.dc.html:
// ورود/ثبت‌نام tabs, کاربر/آژانس segment, OTP with resend countdown.
// Customer OTP uses the existing auth hooks (verification find-or-creates
// the account, so the signup tab's OTP is the same flow); agency signup
// submits a real Phase 16 AgencyMembershipRequest (phone-OTP-verified)
// that lands in the staff review queue (پنل ادمین ← آژانس‌ها ← درخواست‌ها).
//
// The design's own login page has a materially different field layout
// (email+password-first with Google sign-in, 5-digit OTP) from this real
// app's phone+OTP-first flow (6-digit OTP, no Google sign-in — out of
// scope), so most EN/AR strings below were hand-translated to match THIS
// app's actual fields; a handful of concepts that do line up 1:1 (tab
// labels, terms/agency note, resend label) were pulled directly from the
// design bundle's own isEN/isAR ternaries.

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

function fmtTimer(s: number, locale: StoredLocale) {
  const raw = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return locale === 'fa' ? faDigits(raw) : raw;
}

const STR: Record<StoredLocale, {
  tabLogin: string;
  tabSignup: string;
  acctUser: string;
  acctAgency: string;
  subtitleLoginUser: string;
  subtitleLoginAgency: string;
  subtitleSignupUser: string;
  subtitleSignupAgency: string;
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
  agencyIdLabel: string;
  agencyIdPlaceholder: string;
  agencyLoginBtn: string;
  agencySignupDoneTitle: string;
  agencyNote: string;
  agencyNameLabel: string;
  agencyNamePlaceholder: string;
  agencyLicenseLabel: string;
  agencyManagerLabel: string;
  agencyManagerPlaceholder: string;
  agencyPhoneLabel: string;
  agencySubmitBtn: string;
  staffQuestion: string;
  staffLoginLink: string;
  errSendCode: string;
  errInvalidCode: string;
  errLoginFailed: string;
  errAgencyLoginFailed: string;
}> = {
  fa: {
    tabLogin: 'ورود',
    tabSignup: 'ثبت‌نام',
    acctUser: 'کاربر',
    acctAgency: 'آژانس',
    subtitleLoginUser: 'برای ادامه، وارد حساب کاربری خود شوید.',
    subtitleLoginAgency: 'با حساب آژانس همکار خود وارد پنل B2B شوید.',
    subtitleSignupUser: 'حساب کاربری جدید بسازید و سفرتان را آغاز کنید.',
    subtitleSignupAgency: 'آژانس خود را ثبت کنید و به نرخ‌های ویژه همکاران دسترسی پیدا کنید.',
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
    agencyIdLabel: 'نام کاربری / کد آژانس',
    agencyIdPlaceholder: 'کد آژانس همکار',
    agencyLoginBtn: 'ورود به پنل آژانس',
    agencySignupDoneTitle: 'درخواست همکاری ثبت شد',
    agencyNote: 'حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.',
    agencyNameLabel: 'نام شرکت/آژانس',
    agencyNamePlaceholder: 'نام آژانس',
    agencyLicenseLabel: 'شماره مجوز بند ب',
    agencyManagerLabel: 'نام مدیر آژانس',
    agencyManagerPlaceholder: 'نام مسئول',
    agencyPhoneLabel: 'شماره موبایل',
    agencySubmitBtn: 'ثبت درخواست همکاری',
    staffQuestion: 'کارمند یا مدیر هستید؟',
    staffLoginLink: 'ورود مدیران و کارمندان',
    errSendCode: 'خطا در ارسال کد.',
    errInvalidCode: 'کد نامعتبر است.',
    errLoginFailed: 'ورود ناموفق بود.',
    errAgencyLoginFailed: 'ورود آژانس ناموفق بود.',
  },
  en: {
    tabLogin: 'Log in',
    tabSignup: 'Sign up',
    acctUser: 'User',
    acctAgency: 'Agency',
    subtitleLoginUser: 'Sign in to your account to continue.',
    subtitleLoginAgency: 'Sign in with your partner agency account to access the B2B panel.',
    subtitleSignupUser: 'Create a new account and start your journey.',
    subtitleSignupAgency: 'Register your agency and get access to special partner rates.',
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
    agencyIdLabel: 'Username / Agency Code',
    agencyIdPlaceholder: 'Partner agency code',
    agencyLoginBtn: 'Log in to Agency Panel',
    agencySignupDoneTitle: 'Partnership request submitted',
    agencyNote: "Agency accounts are activated after blujet reviews your license and documents, unlocking special B2B rates.",
    agencyNameLabel: 'Company / Agency Name',
    agencyNamePlaceholder: 'Agency name',
    agencyLicenseLabel: 'License Number (Category B)',
    agencyManagerLabel: 'Agency Manager Name',
    agencyManagerPlaceholder: "Manager's name",
    agencyPhoneLabel: 'Mobile Number',
    agencySubmitBtn: 'Submit Partnership Request',
    staffQuestion: 'Are you a staff member or manager?',
    staffLoginLink: 'Staff & Manager Login',
    errSendCode: 'Error sending the code.',
    errInvalidCode: 'Invalid code.',
    errLoginFailed: 'Login failed.',
    errAgencyLoginFailed: 'Agency login failed.',
  },
  ar: {
    tabLogin: 'تسجيل الدخول',
    tabSignup: 'إنشاء حساب',
    acctUser: 'مستخدم',
    acctAgency: 'وكالة',
    subtitleLoginUser: 'سجّل الدخول إلى حسابك للمتابعة.',
    subtitleLoginAgency: 'سجّل الدخول بحساب وكالتك الشريكة للوصول إلى لوحة B2B.',
    subtitleSignupUser: 'أنشئ حسابًا جديدًا وابدأ رحلتك.',
    subtitleSignupAgency: 'سجّل وكالتك واحصل على وصول إلى أسعار الشركاء الخاصة.',
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
    agencyIdLabel: 'اسم المستخدم / رمز الوكالة',
    agencyIdPlaceholder: 'رمز الوكالة الشريكة',
    agencyLoginBtn: 'تسجيل الدخول إلى لوحة الوكالة',
    agencySignupDoneTitle: 'تم تقديم طلب الشراكة',
    agencyNote: 'تُفعَّل حسابات الوكالات بعد مراجعة blujet لترخيصك ومستنداتك، لتحصل على أسعار B2B خاصة.',
    agencyNameLabel: 'اسم الشركة / الوكالة',
    agencyNamePlaceholder: 'اسم الوكالة',
    agencyLicenseLabel: 'رقم الترخيص (الفئة ب)',
    agencyManagerLabel: 'اسم مدير الوكالة',
    agencyManagerPlaceholder: 'اسم المدير',
    agencyPhoneLabel: 'رقم الجوال',
    agencySubmitBtn: 'تقديم طلب الشراكة',
    staffQuestion: 'هل أنت موظف أو مدير؟',
    staffLoginLink: 'تسجيل دخول الموظفين والمديرين',
    errSendCode: 'خطأ في إرسال الرمز.',
    errInvalidCode: 'رمز غير صالح.',
    errLoginFailed: 'فشل تسجيل الدخول.',
    errAgencyLoginFailed: 'فشل تسجيل دخول الوكالة.',
  },
};

export default function CustomerLoginPage() {
  const { status, user, requestOtp, verifyOtp, passwordLogin, agencyLogin } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [acct, setAcct] = useState<'user' | 'agency'>('user');
  const [useOtp, setUseOtp] = useState(true);

  // user OTP flow (shared by login and signup tabs)
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [userPassword, setUserPassword] = useState('');
  // agency
  const [agencyId, setAgencyId] = useState('');
  const [agencyPass, setAgencyPass] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [agencyManager, setAgencyManager] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [agencyChallengeId, setAgencyChallengeId] = useState<string | null>(null);
  const [agencyCode, setAgencyCode] = useState('');
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

  async function onAgencyLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await agencyLogin!(agencyId.trim(), agencyPass);
      navigate('/agency', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errAgencyLoginFailed);
    } finally {
      setBusy(false);
    }
  }

  async function onAgencyRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { challengeId: id } = await requestAgencySignupOtp(agencyPhone.trim());
      setAgencyChallengeId(id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errSendCode);
    } finally {
      setBusy(false);
    }
  }

  async function onAgencySignupConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!agencyChallengeId) return;
    setError(null);
    setBusy(true);
    try {
      await submitAgencyRequest({
        applicantName: agencyName.trim(),
        managerName: agencyManager.trim(),
        licenseNo: licenseNo.trim(),
        phone: agencyPhone.trim(),
        challengeId: agencyChallengeId,
        code: agencyCode.trim(),
      });
      setAgencySubmitted(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errInvalidCode);
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
    setUseOtp(true);
    setUserPassword('');
  }

  const subtitle = isLogin
    ? isAgency
      ? t.subtitleLoginAgency
      : t.subtitleLoginUser
    : isAgency
      ? t.subtitleSignupAgency
      : t.subtitleSignupUser;

  return (
    <PublicPageShell>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '44px 22px 72px' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 20, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: '24px 26px' }}>
          {/* mode tabs */}
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
              {t.acctUser}
            </span>
            <span data-testid="signin-acct-agency" onClick={() => { setAcct('agency'); resetFlow(); }} style={seg(isAgency)}>
              {t.acctAgency}
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#6b7585', margin: '0 0 16px', lineHeight: 1.9 }}>{subtitle}</p>
          {error && <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>}

          {/* ---- USER LOGIN with password (alternative to OTP) ---- */}
          {!isAgency && isLogin && !useOtp && (
            <form onSubmit={(e) => void onPasswordLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.mobileLabel}</label>
                <input data-testid="signin-pw-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t.passwordLabel}</label>
                <input type="password" data-testid="signin-pw-password" dir="ltr" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} style={inputStyle} />
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

          {/* ---- USER LOGIN / SIGNUP (same OTP flow; signup adds profile fields) ---- */}
          {!isAgency && (useOtp || !isLogin) && !challengeId && (
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
                    <input data-testid="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.namePlaceholder} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.emailOptionalLabel}</label>
                    <input data-testid="signup-email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={inputStyle} />
                  </div>
                </>
              )}
              <div>
                <label style={labelStyle}>{t.mobileLabel}</label>
                <input data-testid="signin-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
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
                  <p style={{ fontSize: 11, color: '#8a96a6', margin: 0, lineHeight: 1.8, textAlign: 'center' }}>
                    {t.loginConsentNote}
                  </p>
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

          {!isAgency && challengeId && (
            <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.otpLabel}</label>
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

          {/* ---- AGENCY LOGIN ---- */}
          {isAgency && isLogin && (
            <form onSubmit={onAgencyLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.agencyIdLabel}</label>
                <input data-testid="agency-id" dir="ltr" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} placeholder={t.agencyIdPlaceholder} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t.passwordLabel}</label>
                <input type="password" data-testid="agency-pass" dir="ltr" value={agencyPass} onChange={(e) => setAgencyPass(e.target.value)} style={inputStyle} />
              </div>
              <button type="submit" data-testid="agency-login-btn" disabled={busy || !agencyId.trim() || !agencyPass} style={primaryBtn(!busy && !!agencyId.trim() && !!agencyPass)}>
                {t.agencyLoginBtn}
              </button>
            </form>
          )}

          {/* ---- AGENCY SIGNUP (real Phase 16 membership request) ---- */}
          {isAgency && !isLogin && (
            agencySubmitted ? (
              <div data-testid="agency-signup-done" style={{ background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, color: '#1f8a5b', marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>{t.agencySignupDoneTitle}</div>
                <div style={{ fontSize: 11.5, color: '#5a6678', lineHeight: 1.9 }}>
                  {t.agencyNote}
                </div>
              </div>
            ) : agencyChallengeId ? (
              <form onSubmit={onAgencySignupConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t.otpLabel}</label>
                  <input
                    data-testid="agency-otp-code"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={agencyCode}
                    onChange={(e) => setAgencyCode(e.target.value)}
                    placeholder="——————"
                    style={{ ...inputStyle, textAlign: 'center', letterSpacing: 6, fontWeight: 800 }}
                  />
                </div>
                <button
                  type="submit"
                  data-testid="agency-signup-confirm"
                  disabled={busy || agencyCode.trim().length !== 6}
                  style={primaryBtn(!busy && agencyCode.trim().length === 6)}
                >
                  {t.agencySubmitBtn}
                </button>
                <span
                  onClick={() => {
                    setAgencyChallengeId(null);
                    setAgencyCode('');
                    setError(null);
                  }}
                  style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                >
                  {t.editNumber}
                </span>
              </form>
            ) : (
              <form onSubmit={onAgencyRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t.agencyNameLabel}</label>
                  <input data-testid="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder={t.agencyNamePlaceholder} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t.agencyLicenseLabel}</label>
                  <input data-testid="agency-license" dir="ltr" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="XXXX-XXXX" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t.agencyManagerLabel}</label>
                  <input data-testid="agency-manager" value={agencyManager} onChange={(e) => setAgencyManager(e.target.value)} placeholder={t.agencyManagerPlaceholder} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t.agencyPhoneLabel}</label>
                  <input data-testid="agency-phone" dir="ltr" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} placeholder="09xxxxxxxxx" style={inputStyle} />
                </div>
                <button
                  type="submit"
                  data-testid="agency-signup-btn"
                  disabled={
                    busy ||
                    !agencyName.trim() ||
                    !licenseNo.trim() ||
                    !agencyManager.trim() ||
                    !/^09\d{9}$/.test(agencyPhone.trim())
                  }
                  style={primaryBtn(
                    !busy &&
                      !!agencyName.trim() &&
                      !!licenseNo.trim() &&
                      !!agencyManager.trim() &&
                      /^09\d{9}$/.test(agencyPhone.trim()),
                  )}
                >
                  {t.agencySubmitBtn}
                </button>
                <p style={{ fontSize: 10.5, color: '#8a96a6', margin: 0, lineHeight: 1.9 }}>
                  {t.agencyNote}
                </p>
              </form>
            )
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#6b7585' }}>
          {t.staffQuestion}{' '}
          <a href="/login" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
            {t.staffLoginLink}
          </a>
        </div>
      </div>
    </PublicPageShell>
  );
}
