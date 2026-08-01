import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CustomerLoginCardHeader } from '../../components/public/customer-login/CustomerLoginVisualPanel';
import CustomerLoginVisualPanel from '../../components/public/customer-login/CustomerLoginVisualPanel';
import {
  loginFieldStyle,
  loginLabelStyle,
  loginPrimaryBtn,
  loginSeg,
} from '../../components/public/customer-login/customer-login-styles';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { ApiRequestError } from '../../api/envelope';
import { requestAgencySignupOtp, submitAgencyRequest } from '../../api/agencies';
import { faDigits } from '../../lib/fa-format';

const RESEND_SECONDS = 120;

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
    acctUser: string;
    acctAgency: string;
    titleLoginUser: string;
    titleSignupUser: string;
    titleOtp: string;
    titleLoginAgency: string;
    titleSignupAgency: string;
    subtitleLoginUser: string;
    subtitleLoginAgency: string;
    subtitleSignupUser: string;
    subtitleSignupAgency: string;
    subtitleOtp: string;
    mobileLabel: string;
    passwordLabel: string;
    loginSubmit: string;
    useOtpLink: string;
    forgotPassword: string;
    fullNameLabel: string;
    namePlaceholder: string;
    emailOptionalLabel: string;
    termsCheckbox: string;
    termsLink: string;
    termsSuffix: string;
    getCode: string;
    loginConsentNote: string;
    usePasswordLink: string;
    otpSentPrefix: string;
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
    secureNote: string;
    visualTitle: string;
    visualSub: string;
    errSendCode: string;
    errInvalidCode: string;
    errLoginFailed: string;
    errAgencyLoginFailed: string;
  }
> = {
  fa: {
    tabLogin: 'ورود',
    tabSignup: 'ثبت‌نام',
    acctUser: 'کاربر عادی',
    acctAgency: 'آژانس همکار',
    titleLoginUser: 'ورود به حساب',
    titleSignupUser: 'ساخت حساب کاربری',
    titleOtp: 'کد تأیید را وارد کن',
    titleLoginAgency: 'ورود آژانس همکار',
    titleSignupAgency: 'ثبت‌نام آژانس همکار',
    subtitleLoginUser: 'شماره موبایلت را وارد کن؛ کد ورود برایت پیامک می‌شود.',
    subtitleLoginAgency: 'با حساب آژانس همکار خود وارد پنل B2B شوید.',
    subtitleSignupUser: 'اطلاعاتت را وارد کن و با کد پیامکی حسابت را فعال کن.',
    subtitleSignupAgency: 'اطلاعات آژانس را وارد کنید تا درخواست همکاری ثبت شود.',
    subtitleOtp: 'کد ۶ رقمی به موبایلت پیامک شد؛ با وارد کردن آن هویتت تأیید می‌شود.',
    mobileLabel: 'شماره موبایل',
    passwordLabel: 'رمز عبور',
    loginSubmit: 'ورود',
    useOtpLink: 'ورود با کد پیامکی',
    forgotPassword: 'فراموشی رمز',
    fullNameLabel: 'نام و نام خانوادگی',
    namePlaceholder: 'مثال: نگار رضایی',
    emailOptionalLabel: 'ایمیل (اختیاری)',
    termsCheckbox: '',
    termsLink: 'قوانین و مقررات',
    termsSuffix: 'و حریم خصوصی blujet را می‌پذیرم.',
    getCode: 'ارسال کد ورود',
    loginConsentNote: 'با ورود، قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.',
    usePasswordLink: 'ورود با رمز عبور',
    otpSentPrefix: 'کد پیامک‌شده به',
    confirmLogin: 'تأیید و ورود',
    confirmSignup: 'ایجاد حساب کاربری',
    resendIn: 'ارسال مجدد کد',
    resend: 'ارسال مجدد کد',
    editNumber: '✎ ویرایش شماره',
    agencyIdLabel: 'نام کاربری / کد آژانس',
    agencyIdPlaceholder: 'کد آژانس همکار',
    agencyLoginBtn: 'ورود به پنل آژانس',
    agencySignupDoneTitle: 'درخواست همکاری ثبت شد',
    agencyNote:
      'حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.',
    agencyNameLabel: 'نام شرکت/آژانس',
    agencyNamePlaceholder: 'نام آژانس',
    agencyLicenseLabel: 'شماره مجوز بند ب',
    agencyManagerLabel: 'نام مدیر آژانس',
    agencyManagerPlaceholder: 'نام مسئول',
    agencyPhoneLabel: 'شماره موبایل',
    agencySubmitBtn: 'ثبت درخواست همکاری',
    staffQuestion: 'کارمند یا مدیر هستید؟',
    staffLoginLink: 'ورود مدیران و کارمندان',
    secureNote: 'اتصال امن — اطلاعات شما محافظت می‌شود',
    visualTitle: 'سفر بعدی‌ات از همین‌جا شروع می‌شود',
    visualSub: 'با blujet سریع‌تر رزرو کن، امتیاز بگیر و سفرهایت را یک‌جا مدیریت کن.',
    errSendCode: 'خطا در ارسال کد.',
    errInvalidCode: 'کد نامعتبر است.',
    errLoginFailed: 'ورود ناموفق بود.',
    errAgencyLoginFailed: 'ورود آژانس ناموفق بود.',
  },
  en: {
    tabLogin: 'Log in',
    tabSignup: 'Sign up',
    acctUser: 'Personal',
    acctAgency: 'Partner Agency',
    titleLoginUser: 'Log in to your account',
    titleSignupUser: 'Create your account',
    titleOtp: 'Enter verification code',
    titleLoginAgency: 'Partner agency login',
    titleSignupAgency: 'Partner agency sign-up',
    subtitleLoginUser: 'Enter your mobile number; we will text you a login code.',
    subtitleLoginAgency: 'Sign in with your partner agency account to access the B2B panel.',
    subtitleSignupUser: 'Enter your details and activate your account with an SMS code.',
    subtitleSignupAgency: 'Enter your agency details to request a B2B partnership.',
    subtitleOtp: 'A 6-digit code was sent to your phone; enter it to verify your identity.',
    mobileLabel: 'Mobile number',
    passwordLabel: 'Password',
    loginSubmit: 'Log in',
    useOtpLink: 'Sign in with SMS code',
    forgotPassword: 'Forgot password?',
    fullNameLabel: 'Full name',
    namePlaceholder: 'e.g. Negar Rezaei',
    emailOptionalLabel: 'Email (optional)',
    termsCheckbox: '',
    termsLink: 'Terms & Conditions',
    termsSuffix: ' and Privacy Policy of blujet.',
    getCode: 'Send login code',
    loginConsentNote: "By signing in, I accept blujet's Terms & Conditions and Privacy Policy.",
    usePasswordLink: 'Sign in with password',
    otpSentPrefix: 'Code sent to',
    confirmLogin: 'Confirm & Log In',
    confirmSignup: 'Confirm & Create Account',
    resendIn: 'Resend code',
    resend: 'Resend code',
    editNumber: '✎ Edit number',
    agencyIdLabel: 'Username / Agency Code',
    agencyIdPlaceholder: 'Partner agency code',
    agencyLoginBtn: 'Log in to Agency Panel',
    agencySignupDoneTitle: 'Partnership request submitted',
    agencyNote:
      'Agency accounts are activated after blujet reviews your license and documents, unlocking special B2B rates.',
    agencyNameLabel: 'Company / Agency Name',
    agencyNamePlaceholder: 'Agency name',
    agencyLicenseLabel: 'License Number (Category B)',
    agencyManagerLabel: 'Agency Manager Name',
    agencyManagerPlaceholder: "Manager's name",
    agencyPhoneLabel: 'Mobile Number',
    agencySubmitBtn: 'Submit Partnership Request',
    staffQuestion: 'Are you a staff member or manager?',
    staffLoginLink: 'Staff & Manager Login',
    secureNote: 'Secure connection — your data is protected',
    visualTitle: 'Your next journey starts here',
    visualSub: 'Book faster with blujet, earn points, and manage all your trips in one place.',
    errSendCode: 'Error sending the code.',
    errInvalidCode: 'Invalid code.',
    errLoginFailed: 'Login failed.',
    errAgencyLoginFailed: 'Agency login failed.',
  },
  ar: {
    tabLogin: 'تسجيل الدخول',
    tabSignup: 'إنشاء حساب',
    acctUser: 'شخصي',
    acctAgency: 'وكالة شريكة',
    titleLoginUser: 'تسجيل الدخول إلى حسابك',
    titleSignupUser: 'إنشاء حسابك',
    titleOtp: 'أدخل رمز التحقق',
    titleLoginAgency: 'تسجيل دخول الوكالة الشريكة',
    titleSignupAgency: 'تسجيل وكالة شريكة',
    subtitleLoginUser: 'أدخل رقم هاتفك؛ سيُرسل إليك رمز الدخول.',
    subtitleLoginAgency: 'سجّل الدخول بحساب وكالتك الشريكة للوصول إلى لوحة B2B.',
    subtitleSignupUser: 'أدخل بياناتك وفعّل حسابك برمز عبر الرسائل النصية.',
    subtitleSignupAgency: 'أدخل بيانات الوكالة لتقديم طلب الشراكة.',
    subtitleOtp: 'تم إرسال رمز مكوّن من ٦ أرقام إلى هاتفك؛ أدخله لتأكيد هويتك.',
    mobileLabel: 'رقم الجوال',
    passwordLabel: 'كلمة المرور',
    loginSubmit: 'تسجيل الدخول',
    useOtpLink: 'تسجيل الدخول برمز الرسائل',
    forgotPassword: 'نسيت كلمة المرور؟',
    fullNameLabel: 'الاسم الكامل',
    namePlaceholder: 'مثلاً: نيغار رضائي',
    emailOptionalLabel: 'البريد الإلكتروني (اختياري)',
    termsCheckbox: '',
    termsLink: 'الشروط والأحكام',
    termsSuffix: ' وسياسة الخصوصية لـ blujet.',
    getCode: 'إرسال رمز الدخول',
    loginConsentNote: 'بتسجيل الدخول، أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بـ blujet.',
    usePasswordLink: 'تسجيل الدخول بكلمة المرور',
    otpSentPrefix: 'تم إرسال الرمز إلى',
    confirmLogin: 'تأكيد وتسجيل الدخول',
    confirmSignup: 'تأكيد وإنشاء الحساب',
    resendIn: 'إعادة إرسال الرمز',
    resend: 'إعادة إرسال الرمز',
    editNumber: '✎ تعديل الرقم',
    agencyIdLabel: 'اسم المستخدم / رمز الوكالة',
    agencyIdPlaceholder: 'رمز الوكالة الشريكة',
    agencyLoginBtn: 'تسجيل الدخول إلى لوحة الوكالة',
    agencySignupDoneTitle: 'تم تقديم طلب الشراكة',
    agencyNote:
      'تُفعَّل حسابات الوكالات بعد مراجعة blujet لترخيصك ومستنداتك، لتحصل على أسعار B2B خاصة.',
    agencyNameLabel: 'اسم الشركة / الوكالة',
    agencyNamePlaceholder: 'اسم الوكالة',
    agencyLicenseLabel: 'رقم الترخيص (الفئة ب)',
    agencyManagerLabel: 'اسم مدير الوكالة',
    agencyManagerPlaceholder: 'اسم المدير',
    agencyPhoneLabel: 'رقم الجوال',
    agencySubmitBtn: 'تقديم طلب الشراكة',
    staffQuestion: 'هل أنت موظف أو مدير؟',
    staffLoginLink: 'تسجيل دخول الموظفين والمديرين',
    secureNote: 'اتصال آمن — بياناتك محمية',
    visualTitle: 'رحلتك القادمة تبدأ من هنا',
    visualSub: 'احجز أسرع مع blujet، اكسب نقاطًا، وأدر جميع رحلاتك في مكان واحد.',
    errSendCode: 'خطأ في إرسال الرمز.',
    errInvalidCode: 'رمز غير صالح.',
    errLoginFailed: 'فشل تسجيل الدخول.',
    errAgencyLoginFailed: 'فشل تسجيل دخول الوكالة.',
  },
};

function PhoneField({
  label,
  value,
  onChange,
  testId,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div style={loginLabelStyle}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type="tel"
          data-testid={testId}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '0912 345 6789'}
          style={{ ...loginFieldStyle, paddingInlineStart: 52, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}
        />
        <span
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: '#9aa7b8',
            fontWeight: 700,
          }}
        >
          +98
        </span>
      </div>
    </div>
  );
}

export default function CustomerLoginPage() {
  const { status, user, requestOtp, verifyOtp, passwordLogin, agencyLogin } = useAuth();
  const { locale, setLocale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [acct, setAcct] = useState<'user' | 'agency'>('user');
  const [useOtp, setUseOtp] = useState(true);

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [userPassword, setUserPassword] = useState('');
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
  const inOtpPhase = !isAgency && challengeId !== null;

  const langLabel = locale === 'en' ? 'EN' : locale === 'ar' ? 'AR' : 'FA';

  const pageTitle = useMemo(() => {
    if (inOtpPhase) return t.titleOtp;
    if (isLogin) return isAgency ? t.titleLoginAgency : t.titleLoginUser;
    return isAgency ? t.titleSignupAgency : t.titleSignupUser;
  }, [inOtpPhase, isLogin, isAgency, t]);

  const pageSubtitle = useMemo(() => {
    if (inOtpPhase) return t.subtitleOtp;
    if (isLogin) return isAgency ? t.subtitleLoginAgency : t.subtitleLoginUser;
    return isAgency ? t.subtitleSignupAgency : t.subtitleSignupUser;
  }, [inOtpPhase, isLogin, isAgency, t]);

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

  function resetFlow() {
    setChallengeId(null);
    setCode('');
    setError(null);
    setUseOtp(true);
    setUserPassword('');
  }

  const cardCols = isMobile ? '1fr' : '1fr 1fr';

  return (
    <div
      dir={locale === 'en' ? 'ltr' : 'rtl'}
      style={{
        fontFamily: locale === 'en' ? 'Inter, sans-serif' : 'inherit',
        color: '#16202e',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 26,
        background: '#ffffff',
      }}
    >
      <div
        data-testid="customer-login-card"
        style={{
          width: 980,
          maxWidth: '100%',
          background: '#fff',
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: '0 50px 110px -38px rgba(13,38,102,.4)',
          border: '1px solid #e4edf8',
          display: 'grid',
          gridTemplateColumns: cardCols,
        }}
      >
        <div
          style={{
            padding: isMobile ? '24px 20px' : '34px 38px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CustomerLoginCardHeader
            locale={locale}
            showForgot={isLogin && !isAgency && !useOtp}
            forgotLabel={t.forgotPassword}
            langLabel={langLabel}
            isMobile={isMobile}
            onToggleLang={() => setLocale(locale === 'fa' ? 'en' : locale === 'en' ? 'ar' : 'fa')}
          />

          <div style={{ display: 'flex', background: '#f1f5fa', borderRadius: 13, padding: 4, marginBottom: 22 }}>
            <button type="button" data-testid="signin-acct-user" onClick={() => { setAcct('user'); resetFlow(); }} style={loginSeg(!isAgency)}>
              {t.acctUser}
            </button>
            <button type="button" data-testid="signin-acct-agency" onClick={() => { setAcct('agency'); resetFlow(); }} style={loginSeg(isAgency)}>
              {t.acctAgency}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 21, borderBottom: '1.5px solid #eef1f5', marginBottom: 24 }}>
            {(
              [
                ['login', t.tabLogin],
                ['signup', t.tabSignup],
              ] as const
            ).map(([m, lbl]) => (
              <button
                key={m}
                type="button"
                data-testid={`signin-tab-${m}`}
                onClick={() => {
                  setMode(m);
                  resetFlow();
                  setAgencySubmitted(false);
                }}
                style={{
                  paddingBottom: 11,
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: mode === m ? '#1668c4' : '#9aa4b2',
                  borderBottom: mode === m ? '3px solid #1668c4' : '3px solid transparent',
                  marginBottom: -1.5,
                  cursor: 'pointer',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  fontFamily: 'inherit',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px' }}>{pageTitle}</h1>
          <p style={{ fontSize: 12.5, color: '#7d8ba0', margin: '0 0 22px', lineHeight: 2 }}>{pageSubtitle}</p>

          {error && (
            <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>
              {error}
            </p>
          )}

          {!isAgency && isLogin && !useOtp && (
            <form onSubmit={(e) => void onPasswordLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <PhoneField label={t.mobileLabel} value={phone} onChange={setPhone} testId="signin-pw-phone" />
              <div>
                <div style={loginLabelStyle}>{t.passwordLabel}</div>
                <input
                  type="password"
                  data-testid="signin-pw-password"
                  dir="ltr"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  style={loginFieldStyle}
                />
              </div>
              <button
                type="submit"
                data-testid="signin-pw-submit"
                disabled={busy || !phone.trim() || !userPassword}
                style={loginPrimaryBtn(!busy && !!phone.trim() && !!userPassword)}
              >
                {t.loginSubmit}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <button type="button" data-testid="signin-use-otp" onClick={() => setUseOtp(true)} style={{ color: '#1668c4', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                  {t.useOtpLink}
                </button>
              </div>
            </form>
          )}

          {!isAgency && (useOtp || !isLogin) && !challengeId && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendOtp();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
            >
              {!isLogin && (
                <>
                  <div>
                    <div style={loginLabelStyle}>{t.fullNameLabel}</div>
                    <input data-testid="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.namePlaceholder} style={loginFieldStyle} />
                  </div>
                  <div>
                    <div style={loginLabelStyle}>{t.emailOptionalLabel}</div>
                    <input data-testid="signup-email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={loginFieldStyle} />
                  </div>
                </>
              )}
              <PhoneField label={t.mobileLabel} value={phone} onChange={setPhone} testId="signin-phone" />
              {!isLogin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#3b4554', cursor: 'pointer' }}>
                  <input type="checkbox" data-testid="signup-terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    <Link to="/travel-info" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                      {t.termsLink}
                    </Link>{' '}
                    {t.termsSuffix}
                  </span>
                </label>
              )}
              <button
                type="submit"
                data-testid="signin-request"
                disabled={busy || !phone.trim() || (!isLogin && (!fullName.trim() || !terms))}
                style={loginPrimaryBtn(!busy && !!phone.trim() && (isLogin || (!!fullName.trim() && terms)))}
              >
                {t.getCode}
              </button>
              {isLogin && (
                <>
                  <p style={{ fontSize: 11, color: '#8a96a6', margin: 0, lineHeight: 1.8, textAlign: 'center' }}>{t.loginConsentNote}</p>
                  <button
                    type="button"
                    data-testid="signin-use-password"
                    onClick={() => setUseOtp(false)}
                    style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'center' }}
                  >
                    {t.usePasswordLink}
                  </button>
                </>
              )}
            </form>
          )}

          {!isAgency && challengeId && (
            <form onSubmit={onVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={loginLabelStyle}>
                  {t.otpSentPrefix}{' '}
                  <span dir="ltr" style={{ color: '#1668c4' }}>
                    {locale === 'fa' ? faDigits(phone) : phone}
                  </span>
                </div>
                <input
                  data-testid="signin-code"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="- - - - - -"
                  style={{
                    ...loginFieldStyle,
                    height: 60,
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: 8,
                    textAlign: 'center',
                  }}
                />
              </div>
              <button type="submit" data-testid="signin-verify" disabled={busy || !code.trim()} style={loginPrimaryBtn(!busy && !!code.trim())}>
                {isLogin ? t.confirmLogin : t.confirmSignup}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <button type="button" onClick={resetFlow} style={{ color: '#8a96a6', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                  {t.editNumber}
                </button>
                {timer.left > 0 ? (
                  <span data-testid="signin-resend-timer" style={{ color: '#1668c4', fontWeight: 800 }}>
                    {t.resendIn} ({fmtTimer(timer.left, locale)})
                  </span>
                ) : (
                  <button type="button" data-testid="signin-resend" onClick={() => void sendOtp()} style={{ color: '#1668c4', fontWeight: 800, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                    {t.resend}
                  </button>
                )}
              </div>
            </form>
          )}

          {isAgency && isLogin && (
            <form onSubmit={onAgencyLogin} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div>
                <div style={loginLabelStyle}>{t.agencyIdLabel}</div>
                <input data-testid="agency-id" dir="ltr" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} placeholder={t.agencyIdPlaceholder} style={loginFieldStyle} />
              </div>
              <div>
                <div style={loginLabelStyle}>{t.passwordLabel}</div>
                <input type="password" data-testid="agency-pass" dir="ltr" value={agencyPass} onChange={(e) => setAgencyPass(e.target.value)} style={loginFieldStyle} />
              </div>
              <button type="submit" data-testid="agency-login-btn" disabled={busy || !agencyId.trim() || !agencyPass} style={loginPrimaryBtn(!busy && !!agencyId.trim() && !!agencyPass)}>
                {t.agencyLoginBtn}
              </button>
            </form>
          )}

          {isAgency && !isLogin && (
            agencySubmitted ? (
              <div data-testid="agency-signup-done" style={{ background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, color: '#1f8a5b', marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>{t.agencySignupDoneTitle}</div>
                <div style={{ fontSize: 11.5, color: '#5a6678', lineHeight: 1.9 }}>{t.agencyNote}</div>
              </div>
            ) : agencyChallengeId ? (
              <form onSubmit={onAgencySignupConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div>
                  <div style={loginLabelStyle}>{t.otpSentPrefix}</div>
                  <input
                    data-testid="agency-otp-code"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={agencyCode}
                    onChange={(e) => setAgencyCode(e.target.value)}
                    placeholder="——————"
                    style={{ ...loginFieldStyle, textAlign: 'center', letterSpacing: 6, fontWeight: 800, height: 60, fontSize: 22 }}
                  />
                </div>
                <button type="submit" data-testid="agency-signup-confirm" disabled={busy || agencyCode.trim().length !== 6} style={loginPrimaryBtn(!busy && agencyCode.trim().length === 6)}>
                  {t.agencySubmitBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgencyChallengeId(null);
                    setAgencyCode('');
                    setError(null);
                  }}
                  style={{ fontSize: 11.5, color: '#1668c4', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'center' }}
                >
                  {t.editNumber}
                </button>
              </form>
            ) : (
              <form onSubmit={onAgencyRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={loginLabelStyle}>{t.agencyNameLabel}</div>
                    <input data-testid="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder={t.agencyNamePlaceholder} style={loginFieldStyle} />
                  </div>
                  <div>
                    <div style={loginLabelStyle}>{t.agencyLicenseLabel}</div>
                    <input data-testid="agency-license" dir="ltr" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="XXXX-XXXX" style={loginFieldStyle} />
                  </div>
                </div>
                <div>
                  <div style={loginLabelStyle}>{t.agencyManagerLabel}</div>
                  <input data-testid="agency-manager" value={agencyManager} onChange={(e) => setAgencyManager(e.target.value)} placeholder={t.agencyManagerPlaceholder} style={loginFieldStyle} />
                </div>
                <PhoneField label={t.agencyPhoneLabel} value={agencyPhone} onChange={setAgencyPhone} testId="agency-phone" />
                <button
                  type="submit"
                  data-testid="agency-signup-btn"
                  disabled={busy || !agencyName.trim() || !licenseNo.trim() || !agencyManager.trim() || !/^09\d{9}$/.test(agencyPhone.trim())}
                  style={loginPrimaryBtn(!busy && !!agencyName.trim() && !!licenseNo.trim() && !!agencyManager.trim() && /^09\d{9}$/.test(agencyPhone.trim()))}
                >
                  {t.agencySubmitBtn}
                </button>
                <div style={{ marginTop: 4, background: '#eef4fb', border: '1px solid #dce8f7', borderRadius: 12, padding: 11, fontSize: 11.5, color: '#3b556f', lineHeight: 1.9 }}>
                  {t.agencyNote}
                </div>
              </form>
            )
          )}

          <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#9aa7b8', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b' }} />
            {t.secureNote}
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#6b7585' }}>
            {t.staffQuestion}{' '}
            <Link to="/login" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
              {t.staffLoginLink}
            </Link>
          </div>
        </div>

        {!isMobile && <CustomerLoginVisualPanel locale={locale} title={t.visualTitle} subtitle={t.visualSub} />}
      </div>
    </div>
  );
}
