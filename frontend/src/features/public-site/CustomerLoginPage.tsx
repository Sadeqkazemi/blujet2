import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthVisualPanel from '../../components/auth/AuthVisualPanel';
import { OtpCells, OTP_LEN, isOtpComplete } from '../../components/auth/OtpCells';
import { AUTH_FOCUS_CSS, AUTH_INPUT, AUTH_LABEL, authBtn, segStyle } from '../../components/auth/auth-styles';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, latinDigits } from '../../lib/fa-format';

// ورود و ثبتنام — rebuilt to match design-reference/ورود و ثبتنام.dc.html:
// ورود/ثبت‌نام tabs, کاربر/آژانس segment, OTP with resend countdown.
// Customer OTP uses the existing auth hooks (verification find-or-creates
// the account, so the signup tab's OTP is the same flow); agency signup is
// a mock submit per the "no backend work" scope.
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

const STR: Record<
  StoredLocale,
  {
    acctUser: string;
    acctAgency: string;
    tabLogin: string;
    tabSignup: string;
    forgotPassword: string;
    googleLabel: string;
    orLabel: string;
    orPhoneLabel: string;
    mobileLabel: string;
    passwordLabel: string;
    emailLabel: string;
    fullNameLabel: string;
    namePlaceholder: string;
    agNameLabel: string;
    agNamePlaceholder: string;
    agLicLabel: string;
    agManagerLabel: string;
    agManagerPlaceholder: string;
    termsLinkLabel: string;
    termsSuffix: string;
    sendLabelLogin: string;
    sendLabelSignup: string;
    sendLabelAgencySignup: string;
    emailSubmitLogin: string;
    emailSubmitSignup: string;
    emailSubmitAgency: string;
    otpSentPrefix: string;
    editPhoneLabel: string;
    resendLabel: string;
    confirmLogin: string;
    confirmSignup: string;
    agencyNote: string;
    agencySignupDoneTitle: string;
    agencySubmitBtn: string;
    secureNote: string;
    visualTitle: string;
    visualSub: string;
    googleSoon: string;
    emailLoginUnavailable: string;
    errSendCode: string;
    errInvalidCode: string;
    errAgencyLoginFailed: string;
    errNameRequired: string;
    errTermsRequired: string;
    sendingLabel: string;
    devOtpHint: string;
    phoneHintExample: string;
    phoneHintOk: string;
    phoneHintBad: string;
    emailHintOk: string;
    emailHintBad: string;
    passwordHintEmpty: string;
    passwordHintOk: string;
    passwordHintBad: string;
    titleLoginUser: string;
    titleLoginAgency: string;
    titleSignupUser: string;
    titleSignupAgency: string;
    titleOtp: string;
    subtitleLoginUser: string;
    subtitleLoginAgency: string;
    subtitleSignupUser: string;
    subtitleSignupAgency: string;
    subtitleOtp: string;
    subtitleLoginUserEn: string;
    subtitleSignupUserEn: string;
    subtitleSignupAgencyEn: string;
  }
> = {
  fa: {
    acctUser: 'کاربر عادی',
    acctAgency: 'آژانس همکار',
    tabLogin: 'ورود',
    tabSignup: 'ثبت‌نام',
    forgotPassword: 'فراموشی رمز',
    googleLabel: 'ادامه با گوگل',
    orLabel: 'یا',
    orPhoneLabel: 'یا با شماره موبایل',
    mobileLabel: 'شماره موبایل',
    passwordLabel: 'رمز عبور',
    emailLabel: 'ایمیل',
    fullNameLabel: 'نام و نام خانوادگی',
    namePlaceholder: 'مثال: نگار رضایی',
    agNameLabel: 'نام آژانس',
    agNamePlaceholder: 'نام شرکت/آژانس',
    agLicLabel: 'شماره مجوز بند ب',
    agManagerLabel: 'نام مدیر آژانس',
    agManagerPlaceholder: 'نام مسئول',
    termsLinkLabel: 'قوانین و مقررات',
    termsSuffix: 'و حریم خصوصی blujet را می‌پذیرم.',
    sendLabelLogin: 'ارسال کد ورود',
    sendLabelSignup: 'دریافت کد فعال‌سازی',
    sendLabelAgencySignup: 'ثبت درخواست و دریافت کد',
    emailSubmitLogin: 'ورود',
    emailSubmitSignup: 'ساخت حساب',
    emailSubmitAgency: 'ثبت درخواست',
    otpSentPrefix: 'کد ۶ رقمی پیامک‌شده به',
    editPhoneLabel: '✎ ویرایش شماره',
    resendLabel: 'ارسال مجدد کد',
    confirmLogin: 'تأیید و ورود',
    confirmSignup: 'تأیید و ساخت حساب',
    agencyNote:
      'حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.',
    agencySignupDoneTitle: 'درخواست همکاری ثبت شد',
    agencySubmitBtn: 'ثبت درخواست همکاری',
    secureNote: 'ورود امن با کد یک‌بارمصرف — بدون نیاز به رمز عبور',
    visualTitle: 'سفرت را هوشمندانه\nآغاز کن',
    visualSub:
      'با حساب blujet سریع‌تر بلیط بخر، امتیاز جمع کن و از کش‌بک و خدمات باشگاه مشتریان بهره‌مند شو.',
    googleSoon: 'ورود با گوگل به‌زودی فعال می‌شود.',
    emailLoginUnavailable: 'ورود با ایمیل در حال حاضر پشتیبانی نمی‌شود؛ از بخش شماره موبایل استفاده کنید.',
    errSendCode: 'خطا در ارسال کد.',
    errInvalidCode: 'کد نامعتبر است.',
    errAgencyLoginFailed: 'ورود آژانس ناموفق بود.',
    errNameRequired: 'نام و نام خانوادگی را کامل وارد کن.',
    errTermsRequired: 'برای ادامه باید قوانین و مقررات را بپذیری.',
    sendingLabel: 'در حال ارسال…',
    devOtpHint: 'کد تست (محیط توسعه): ',
    phoneHintExample: 'مثال: ۰۹۱۲۳۴۵۶۷۸۹',
    phoneHintOk: '✓ شماره معتبر است',
    phoneHintBad: 'شماره باید با ۰۹ شروع شود و ۱۱ رقم باشد',
    emailHintOk: '✓ معتبر است',
    emailHintBad: 'ایمیل معتبر نیست',
    passwordHintEmpty: 'حداقل ۶ کاراکتر',
    passwordHintOk: '✓ معتبر است',
    passwordHintBad: 'حداقل ۶ کاراکتر لازم است',
    titleLoginUser: 'ورود به حساب',
    titleLoginAgency: 'ورود به حساب',
    titleSignupUser: 'ساخت حساب کاربری',
    titleSignupAgency: 'ثبت‌نام آژانس همکار',
    titleOtp: 'کد تأیید را وارد کن',
    subtitleLoginUser: 'شماره موبایلت را وارد کن؛ کد ورود برایت پیامک می‌شود.',
    subtitleLoginAgency: 'با شماره موبایل ثبت‌شده‌ی آژانس وارد پنل B2B شوید.',
    subtitleSignupUser: 'اطلاعاتت را وارد کن و با کد پیامکی حسابت را فعال کن.',
    subtitleSignupAgency: 'اطلاعات آژانس را وارد کنید تا درخواست همکاری ثبت شود.',
    subtitleOtp: 'کد ۶ رقمی به موبایلت پیامک شد؛ با وارد کردن آن هویتت تأیید می‌شود.',
    subtitleLoginUserEn: '',
    subtitleSignupUserEn: '',
    subtitleSignupAgencyEn: '',
  },
  en: {
    acctUser: 'Personal',
    acctAgency: 'Partner Agency',
    tabLogin: 'Log in',
    tabSignup: 'Sign up',
    forgotPassword: 'Forgot password?',
    googleLabel: 'Continue with Google',
    orLabel: 'OR',
    orPhoneLabel: 'OR USE PHONE NUMBER',
    mobileLabel: 'Mobile number',
    passwordLabel: 'Password',
    emailLabel: 'Email address',
    fullNameLabel: 'Full name',
    namePlaceholder: 'e.g. Sara Ahmadi',
    agNameLabel: 'Agency name',
    agNamePlaceholder: 'Company / agency name',
    agLicLabel: 'License number',
    agManagerLabel: 'Agency manager',
    agManagerPlaceholder: "Manager's name",
    termsLinkLabel: 'Terms & Conditions',
    termsSuffix: ' and Privacy Policy of blujet.',
    sendLabelLogin: 'Send login code',
    sendLabelSignup: 'Get activation code',
    sendLabelAgencySignup: 'Submit request & get code',
    emailSubmitLogin: 'Log in',
    emailSubmitSignup: 'Create account',
    emailSubmitAgency: 'Submit request',
    otpSentPrefix: '6-digit code sent to',
    editPhoneLabel: '✎ Edit number',
    resendLabel: 'Resend code',
    confirmLogin: 'Confirm & log in',
    confirmSignup: 'Confirm & create account',
    agencyNote:
      'Agency accounts are activated after blujet reviews your license and documents, unlocking special B2B rates.',
    agencySignupDoneTitle: 'Partnership request submitted',
    agencySubmitBtn: 'Submit partnership request',
    secureNote: 'Secure sign-in with email, phone, or Google',
    visualTitle: 'Start your journey smarter',
    visualSub:
      'With a blujet account, book faster, earn points, and enjoy cashback and loyalty club perks.',
    googleSoon: 'Google sign-in is coming soon.',
    emailLoginUnavailable: 'Email login is not available yet; please use your phone number below.',
    errSendCode: 'Error sending the code.',
    errInvalidCode: 'Invalid code.',
    errAgencyLoginFailed: 'Agency login failed.',
    errNameRequired: 'Please enter your full name.',
    errTermsRequired: 'You must accept the Terms & Conditions.',
    sendingLabel: 'Sending…',
    devOtpHint: 'Dev test code: ',
    phoneHintExample: 'e.g. 09123456789',
    phoneHintOk: '✓ Looks good',
    phoneHintBad: 'Number must start with 09 and be 11 digits',
    emailHintOk: '✓ Looks good',
    emailHintBad: 'Enter a valid email address',
    passwordHintEmpty: 'At least 6 characters',
    passwordHintOk: '✓ Looks good',
    passwordHintBad: 'At least 6 characters required',
    titleLoginUser: 'Log in to your account',
    titleLoginAgency: 'Log in to your account',
    titleSignupUser: 'Create your account',
    titleSignupAgency: 'Partner agency sign-up',
    titleOtp: 'Enter the verification code',
    subtitleLoginUser: '',
    subtitleLoginAgency: 'Sign in with your partner agency account to access the B2B panel.',
    subtitleSignupUser: '',
    subtitleSignupAgency: 'Enter your agency details to request a B2B partnership.',
    subtitleOtp: 'A 6-digit code was sent to your phone. Enter it to verify your identity.',
    subtitleLoginUserEn:
      'Use your email and password, continue with Google, or log in with your phone number.',
    subtitleSignupUserEn: 'Sign up with email, Google, or your phone number to start booking.',
    subtitleSignupAgencyEn: 'Enter your agency details to request a B2B partnership.',
  },
  ar: {
    acctUser: 'شخصي',
    acctAgency: 'وكالة شريكة',
    tabLogin: 'تسجيل الدخول',
    tabSignup: 'إنشاء حساب',
    forgotPassword: 'نسيت كلمة المرور؟',
    googleLabel: 'المتابعة عبر Google',
    orLabel: 'أو',
    orPhoneLabel: 'أو برقم الجوال',
    mobileLabel: 'رقم الجوال',
    passwordLabel: 'كلمة المرور',
    emailLabel: 'البريد الإلكتروني',
    fullNameLabel: 'الاسم الكامل',
    namePlaceholder: 'مثلاً: سارة أحمدي',
    agNameLabel: 'اسم الوكالة',
    agNamePlaceholder: 'اسم الشركة / الوكالة',
    agLicLabel: 'رقم الترخيص',
    agManagerLabel: 'مدير الوكالة',
    agManagerPlaceholder: 'اسم المدير',
    termsLinkLabel: 'الشروط والأحكام',
    termsSuffix: ' وسياسة الخصوصية الخاصة بـ blujet.',
    sendLabelLogin: 'إرسال رمز الدخول',
    sendLabelSignup: 'استلام رمز التفعيل',
    sendLabelAgencySignup: 'تقديم الطلب واستلام الرمز',
    emailSubmitLogin: 'تسجيل الدخول',
    emailSubmitSignup: 'إنشاء حساب',
    emailSubmitAgency: 'إرسال الطلب',
    otpSentPrefix: 'تم إرسال رمز مكوّن من 6 أرقام إلى',
    editPhoneLabel: '✎ تعديل الرقم',
    resendLabel: 'إعادة إرسال الرمز',
    confirmLogin: 'تأكيد وتسجيل الدخول',
    confirmSignup: 'تأكيد وإنشاء الحساب',
    agencyNote:
      'تُفعَّل حسابات الوكالات بعد مراجعة blujet لترخيصك ومستنداتك، لتحصل على أسعار B2B خاصة.',
    agencySignupDoneTitle: 'تم تقديم طلب الشراكة',
    agencySubmitBtn: 'تقديم طلب الشراكة',
    secureNote: 'تسجيل دخول آمن برمز لمرة واحدة — دون الحاجة لكلمة مرور',
    visualTitle: 'ابدأ رحلتك بذكاء',
    visualSub:
      'مع حساب blujet، احجز أسرع، اجمع نقاطًا، واستمتع بالاسترداد النقدي ومزايا نادي العملاء.',
    googleSoon: 'تسجيل الدخول عبر Google قريبًا.',
    emailLoginUnavailable: 'تسجيل الدخول بالبريد غير متاح حاليًا؛ استخدم رقم الجوال أدناه.',
    errSendCode: 'خطأ في إرسال الرمز.',
    errInvalidCode: 'رمز غير صالح.',
    errAgencyLoginFailed: 'فشل تسجيل دخول الوكالة.',
    errNameRequired: 'أدخل اسمك الكامل.',
    errTermsRequired: 'يجب الموافقة على الشروط والأحكام للمتابعة.',
    sendingLabel: 'جارٍ الإرسال…',
    devOtpHint: 'رمز الاختبار (بيئة التطوير): ',
    phoneHintExample: 'مثال: 09123456789',
    phoneHintOk: '✓ الرقم صحيح',
    phoneHintBad: 'يجب أن يبدأ الرقم بـ 09 ويتكون من 11 رقمًا',
    emailHintOk: '✓ يبدو جيدًا',
    emailHintBad: 'أدخل بريدًا إلكترونيًا صالحًا',
    passwordHintEmpty: '6 أحرف على الأقل',
    passwordHintOk: '✓ يبدو جيدًا',
    passwordHintBad: '6 أحرف على الأقل مطلوبة',
    titleLoginUser: 'تسجيل الدخول إلى حسابك',
    titleLoginAgency: 'تسجيل الدخول إلى حسابك',
    titleSignupUser: 'إنشاء حسابك',
    titleSignupAgency: 'تسجيل وكالة شريكة',
    titleOtp: 'أدخل رمز التحقق',
    subtitleLoginUser: 'أدخل رقم هاتفك؛ سيُرسل إليك رمز الدخول.',
    subtitleLoginAgency: 'سجّل الدخول إلى لوحة B2B برقم هاتف الوكالة المسجّل.',
    subtitleSignupUser: 'أدخل بياناتك وفعّل حسابك برمز عبر الرسائل النصية.',
    subtitleSignupAgency: 'أدخل بيانات الوكالة لتقديم طلب الشراكة.',
    subtitleOtp: 'تم إرسال رمز مكوّن من 6 أرقام إلى هاتفك؛ أدخله لتأكيد هويتك.',
    subtitleLoginUserEn: '',
    subtitleSignupUserEn: '',
    subtitleSignupAgencyEn: '',
  },
};

function OrDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#b7c0cd', fontSize: 11, fontWeight: 700 }}>
      <div style={{ flex: 1, height: 1, background: '#eef1f5' }} />
      {label}
      <div style={{ flex: 1, height: 1, background: '#eef1f5' }} />
    </div>
  );
}

export default function CustomerLoginPage() {
  const { status, user, requestOtp, verifyOtp, devMockOtpLogin, agencyLogin } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const isMobile = useIsMobile();
  const isEN = locale === 'en';
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [acct, setAcct] = useState<'user' | 'agency'>('user');
  const [phase, setPhase] = useState<'id' | 'otp'>('id');

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agName, setAgName] = useState('');
  const [agLic, setAgLic] = useState('');
  const [terms, setTerms] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpSendMocked, setOtpSendMocked] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LEN).fill(''));
  const [agencyPass, setAgencyPass] = useState('');
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
  const isOtp = phase === 'otp';
  const codeOk = isOtpComplete(otpDigits);

  const passwordOk = password.length >= 6;
  const phoneInfoOk = isLogin
    ? phoneOk(phone)
    : phoneOk(phone) && fullName.trim().length >= (isEN ? 2 : 3) && terms && (!isAgency || (agName.trim() && agLic.trim()));

  function resetFlow() {
    setPhase('id');
    setChallengeId(null);
    setOtpSendMocked(false);
    setOtpDigits(Array(OTP_LEN).fill(''));
    setError(null);
  }

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    resetFlow();
    setAgencySubmitted(false);
  }

  function switchAcct(next: 'user' | 'agency') {
    setAcct(next);
    resetFlow();
    setAgencySubmitted(false);
  }

  const title = isOtp
    ? t.titleOtp
    : isLogin
      ? isAgency
        ? t.titleLoginAgency
        : t.titleLoginUser
      : isAgency
        ? t.titleSignupAgency
        : t.titleSignupUser;

  const subtitle = isOtp
    ? t.subtitleOtp
    : isLogin
      ? isAgency
        ? t.subtitleLoginAgency
        : isEN && !isAgency
          ? t.subtitleLoginUserEn
          : t.subtitleLoginUser
      : isAgency
        ? isEN
          ? t.subtitleSignupAgencyEn
          : t.subtitleSignupAgency
        : isEN
          ? t.subtitleSignupUserEn
          : t.subtitleSignupUser;

  const displayPhone = locale === 'fa' ? faDigits(phone) : phone;
  const phoneHint =
    phone === '' ? t.phoneHintExample : phoneOk(phone) ? t.phoneHintOk : t.phoneHintBad;
  const phoneHintColor = phone === '' ? '#9aa7b8' : phoneOk(phone) ? '#1f8a5b' : '#d64545';
  const emailHint = email === '' ? '' : emailOk(email) ? t.emailHintOk : t.emailHintBad;
  const emailHintColor = email === '' ? '#9aa7b8' : emailOk(email) ? '#1f8a5b' : '#d64545';
  const passwordHint =
    password === '' ? t.passwordHintEmpty : passwordOk ? t.passwordHintOk : t.passwordHintBad;
  const passwordHintColor = password === '' ? '#9aa7b8' : passwordOk ? '#1f8a5b' : '#d64545';

  function validatePhoneStep(): boolean {
    if (!phoneOk(phone)) {
      setError(t.phoneHintBad);
      return false;
    }
    if (!isLogin) {
      if (fullName.trim().length < (isEN ? 2 : 3)) {
        setError(t.errNameRequired);
        return false;
      }
      if (!terms) {
        setError(t.errTermsRequired);
        return false;
      }
    }
    return true;
  }

  async function sendOtp() {
    if (busy) return;
    if (!validatePhoneStep()) return;
    setError(null);
    setBusy(true);
    try {
      if (isDevOtpMockSend()) {
        setOtpSendMocked(true);
        setChallengeId(null);
        setPhase('otp');
        setOtpDigits(Array(OTP_LEN).fill(''));
        timer.start();
        return;
      }
      setOtpSendMocked(false);
      const id = await requestOtp!(phone.trim());
      setChallengeId(id);
      setPhase('otp');
      setOtpDigits(Array(OTP_LEN).fill(''));
      timer.start();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errSendCode);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtpFlow(submittedCode?: string) {
    const otpCode = (submittedCode ?? otpDigits.join('')).trim();
    if (otpCode.length !== OTP_LEN || busy) return;

    setError(null);
    setBusy(true);
    try {
      if (otpSendMocked && isDevOtpMockSend()) {
        if (otpCode !== DEV_OTP_CODE) {
          setError(t.errInvalidCode);
          return;
        }
        try {
          let cid = challengeId;
          if (!cid) {
            cid = await requestOtp!(phone.trim());
            setChallengeId(cid);
            setOtpSendMocked(false);
          }
          await verifyOtp!(cid, otpCode);
        } catch (err) {
          if (canDevOtpFallback(err)) {
            await devMockOtpLogin!(phone.trim(), isLogin ? undefined : fullName);
            setOtpSendMocked(false);
          } else {
            throw err;
          }
        }
        return;
      }

      let cid = challengeId;
      if (!cid) {
        cid = await requestOtp!(phone.trim());
        setChallengeId(cid);
      }
      await verifyOtp!(cid, otpCode);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errInvalidCode);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e?: React.FormEvent) {
    e?.preventDefault();
    await verifyOtpFlow();
  }

  async function onAgencyLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await agencyLogin!(phone.trim(), agencyPass);
      navigate('/agency', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.errAgencyLoginFailed);
    } finally {
      setBusy(false);
    }
  }

  function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(t.emailLoginUnavailable);
  }

  const sendLabel = isLogin
    ? t.sendLabelLogin
    : isAgency
      ? t.sendLabelAgencySignup
      : t.sendLabelSignup;

  const emailSubmitLabel = isLogin
    ? t.emailSubmitLogin
    : isAgency
      ? t.emailSubmitAgency
      : t.emailSubmitSignup;

  const nameLabel = isAgency ? t.agManagerLabel : t.fullNameLabel;
  const namePlaceholder = isAgency ? t.agManagerPlaceholder : t.namePlaceholder;

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
              ))}
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px' }}>{title}</h1>
            <p style={{ fontSize: 12.5, color: '#7d8ba0', margin: '0 0 22px', lineHeight: 2 }}>{subtitle}</p>

            {error && (
              <p style={{ marginBottom: 14, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>
                {error}
              </p>
            )}

            {/* Agency login — phone + password */}
            {isAgency && isLogin && !isOtp && (
              <form onSubmit={(e) => void onAgencyLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div>
                  <div style={AUTH_LABEL}>{t.mobileLabel}</div>
                  <div style={{ position: 'relative' }}>
                    <input
                      data-testid="agency-phone"
                      className="auth-input"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(normalizePhone(e.target.value))}
                      onInput={(e) => setPhone(normalizePhone(e.currentTarget.value))}
                      placeholder="0912 345 6789"
                      maxLength={11}
                      autoComplete="tel"
                      style={{ ...AUTH_INPUT, paddingLeft: 52, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}
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
                  <div style={{ fontSize: 11, color: phoneHintColor, marginTop: 7, fontWeight: 600 }}>{phoneHint}</div>
                </div>
                <div>
                  <div style={AUTH_LABEL}>{t.passwordLabel}</div>
                  <input
                    type="password"
                    data-testid="agency-pass"
                    className="auth-input"
                    dir="ltr"
                    value={agencyPass}
                    onChange={(e) => setAgencyPass(e.target.value)}
                    placeholder="••••••••"
                    style={AUTH_INPUT}
                  />
                </div>
                <button
                  type="submit"
                  data-testid="agency-login-btn"
                  disabled={busy || !phoneOk(phone) || !agencyPass}
                  style={authBtn(!busy && phoneOk(phone) && !!agencyPass)}
                >
                  {t.emailSubmitLogin}
                </button>
              </form>
            )}

            {/* Agency signup mock */}
            {isAgency && !isLogin && (
              agencySubmitted ? (
                <div
                  data-testid="agency-signup-done"
                  style={{
                    background: '#eef4fb',
                    border: '1px solid #dce8f7',
                    borderRadius: 12,
                    padding: '20px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 22, color: '#1f8a5b', marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>{t.agencySignupDoneTitle}</div>
                  <div style={{ fontSize: 11.5, color: '#3b556f', lineHeight: 1.9 }}>{t.agencyNote}</div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAgencySubmitted(true);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={AUTH_LABEL}>{t.agNameLabel}</div>
                      <input
                        data-testid="agency-name"
                        className="auth-input"
                        value={agName}
                        onChange={(e) => setAgName(e.target.value)}
                        placeholder={t.agNamePlaceholder}
                        style={{ ...AUTH_INPUT, height: 52, fontSize: 13.5, fontWeight: 400 }}
                      />
                    </div>
                    <div>
                      <div style={AUTH_LABEL}>{t.agLicLabel}</div>
                      <input
                        data-testid="agency-license"
                        className="auth-input"
                        dir="ltr"
                        value={agLic}
                        onChange={(e) => setAgLic(e.target.value)}
                        placeholder="XXXX-XXXX"
                        style={{ ...AUTH_INPUT, height: 52, fontSize: 13.5, fontWeight: 400 }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={AUTH_LABEL}>{nameLabel}</div>
                    <input
                      placeholder={namePlaceholder}
                      style={{ ...AUTH_INPUT, height: 52, fontSize: 13.5, fontWeight: 400 }}
                    />
                  </div>
                  <div>
                    <div style={AUTH_LABEL}>{t.mobileLabel}</div>
                    <div style={{ position: 'relative' }}>
                      <input
                        dir="ltr"
                        placeholder="0912 345 6789"
                        style={{ ...AUTH_INPUT, height: 54, paddingLeft: 52, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}
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
                  <button
                    type="submit"
                    data-testid="agency-signup-btn"
                    disabled={!agName.trim() || !agLic.trim()}
                    style={authBtn(!!agName.trim() && !!agLic.trim())}
                  >
                    {t.agencySubmitBtn}
                  </button>
                  <div
                    style={{
                      background: '#eef4fb',
                      border: '1px solid #dce8f7',
                      borderRadius: 12,
                      padding: 11,
                      fontSize: 11.5,
                      color: '#3b556f',
                      lineHeight: 1.9,
                    }}
                  >
                    {t.agencyNote}
                  </div>
                </form>
              )
            )}

            {/* User flows */}
            {!isAgency && !isOtp && (
              <>
                {isEN && (
                  <form onSubmit={onEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 15 }}>
                    <button
                      type="button"
                      data-testid="signin-google"
                      onClick={() => setError(t.googleSoon)}
                      style={{
                        height: 52,
                        borderRadius: 13,
                        border: '1.5px solid #dfe6ef',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#16202e',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path
                          fill="#FFC107"
                          d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 8-11.3 8-6.9 0-12.5-5.6-12.5-12.6S17.1 10.4 24 10.4c3.2 0 6.1 1.2 8.3 3.2l5.1-5.1C34.1 5.6 29.3 3.6 24 3.6 12.9 3.6 4 12.5 4 23.6S12.9 43.6 24 43.6c11 0 20-8.9 20-20 0-1.2-.1-2.4-.4-3.1z"
                        />
                        <path
                          fill="#FF3D00"
                          d="M6.3 14.6l6.6 4.8C14.7 15.1 19 12.4 24 12.4c3.2 0 6.1 1.2 8.3 3.2l5.1-5.1C34.1 6.9 29.3 4.4 24 4.4c-7.7 0-14.4 4.4-17.7 10.2z"
                        />
                        <path
                          fill="#4CAF50"
                          d="M24 43.6c5.2 0 9.9-1.8 13.6-4.9l-6.3-5.2C29.3 35.6 26.8 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.5 39.1 16.2 43.6 24 43.6z"
                        />
                        <path
                          fill="#1976D2"
                          d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.3 5.2C41 34.6 44 29.5 44 23.6c0-1.2-.1-2.4-.4-3.1z"
                        />
                      </svg>
                      {t.googleLabel}
                    </button>
                    <OrDivider label={t.orLabel} />
                    {!isLogin && (
                      <div>
                        <div style={AUTH_LABEL}>{nameLabel}</div>
                        <input
                          data-testid="signup-name"
                          className="auth-input"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={namePlaceholder}
                          style={{ ...AUTH_INPUT, height: 52, fontSize: 13.5, fontWeight: 400 }}
                        />
                      </div>
                    )}
                    <div>
                      <div style={AUTH_LABEL}>{t.emailLabel}</div>
                      <input
                        data-testid="signin-email"
                        className="auth-input"
                        dir="ltr"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        style={AUTH_INPUT}
                      />
                      {emailHint && (
                        <div style={{ fontSize: 11, color: emailHintColor, marginTop: 7, fontWeight: 600 }}>{emailHint}</div>
                      )}
                    </div>
                    <div>
                      <div style={AUTH_LABEL}>{t.passwordLabel}</div>
                      <input
                        type="password"
                        data-testid="signin-email-password"
                        className="auth-input"
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={AUTH_INPUT}
                      />
                      <div style={{ fontSize: 11, color: passwordHintColor, marginTop: 7, fontWeight: 600 }}>{passwordHint}</div>
                    </div>
                    {!isLogin && (
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#3b4554', cursor: 'pointer' }}
                      >
                        <input type="checkbox" data-testid="signup-terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                        <span>
                          <Link to="/terms" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                            {t.termsLinkLabel}
                          </Link>
                          {t.termsSuffix}
                        </span>
                      </label>
                    )}
                    <button type="submit" data-testid="signin-email-submit" style={authBtn(emailOk(email) && passwordOk)}>
                      {emailSubmitLabel}
                    </button>
                  </form>
                )}

                {isEN && <OrDivider label={t.orPhoneLabel} />}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendOtp();
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
                >
                  {!isEN && !isLogin && (
                    <div>
                      <div style={AUTH_LABEL}>{nameLabel}</div>
                      <input
                        data-testid="signup-name"
                        className="auth-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={namePlaceholder}
                        style={{ ...AUTH_INPUT, height: 52, fontSize: 13.5, fontWeight: 400 }}
                      />
                    </div>
                  )}
                  <div>
                    <div style={AUTH_LABEL}>{t.mobileLabel}</div>
                    <div style={{ position: 'relative' }}>
                      <input
                        data-testid="signin-phone"
                        className="auth-input"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(normalizePhone(e.target.value))}
                        onInput={(e) => setPhone(normalizePhone(e.currentTarget.value))}
                        placeholder="0912 345 6789"
                        maxLength={11}
                        autoComplete="tel"
                        style={{ ...AUTH_INPUT, paddingLeft: 52, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}
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
                    <div style={{ fontSize: 11, color: phoneHintColor, marginTop: 7, fontWeight: 600 }}>{phoneHint}</div>
                  </div>
                  {!isEN && !isLogin && (
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#3b4554', cursor: 'pointer' }}
                    >
                      <input type="checkbox" data-testid="signup-terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                      <span>
                        <Link to="/terms" style={{ color: '#1668c4', fontWeight: 700, textDecoration: 'none' }}>
                          {t.termsLinkLabel}
                        </Link>
                        {t.termsSuffix}
                      </span>
                    </label>
                  )}
                  <button
                    type="button"
                    data-testid="signin-request"
                    onClick={() => void sendOtp()}
                    aria-disabled={busy || !phoneInfoOk}
                    style={authBtn(phoneInfoOk && !busy)}
                  >
                    {busy ? t.sendingLabel : sendLabel}
                  </button>
                </form>
              </>
            )}

            {!isAgency && isOtp && (
              <form onSubmit={(e) => void onVerify(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ ...AUTH_LABEL, marginBottom: 10 }}>
                    {t.otpSentPrefix}{' '}
                    <span dir="ltr" style={{ color: '#1668c4' }}>
                      {displayPhone}
                    </span>
                  </div>
                  <OtpCells
                    key={challengeId ?? (otpSendMocked ? 'mock-otp' : 'otp')}
                    digits={otpDigits}
                    onChange={setOtpDigits}
                    onComplete={(completedCode) => void verifyOtpFlow(completedCode)}
                    testIdPrefix="signin-code-cell"
                    autoFocus
                  />
                  {isDevOtpMockSend() && (
                    <div
                      data-testid="signin-dev-otp-hint"
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1668c4',
                        background: '#eef4fb',
                        border: '1px solid #dce8f7',
                        borderRadius: 10,
                        padding: '8px 10px',
                      }}
                    >
                      {t.devOtpHint}
                      {locale === 'fa' ? faDigits(DEV_OTP_CODE) : DEV_OTP_CODE}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span
                    data-testid="signin-edit-phone"
                    onClick={resetFlow}
                    style={{ color: '#8a96a6', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {t.editPhoneLabel}
                  </span>
                  {timer.left > 0 ? (
                    <span data-testid="signin-resend-timer" style={{ color: '#1668c4', fontWeight: 800 }}>
                      {t.resendLabel} ({fmtTimer(timer.left, locale)})
                    </span>
                  ) : (
                    <span
                      data-testid="signin-resend"
                      onClick={() => void sendOtp()}
                      style={{ color: '#1668c4', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {t.resendLabel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="signin-verify"
                  onClick={() => void verifyOtpFlow()}
                  aria-disabled={busy || !codeOk}
                  style={authBtn(codeOk && !busy)}
                >
                  {isLogin ? t.confirmLogin : t.confirmSignup}
                </button>
              </form>
            )}

            <div
              data-testid="signin-secure-note"
              style={{
                marginTop: 'auto',
                paddingTop: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11,
                color: '#9aa7b8',
                fontWeight: 600,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b' }} />
              {t.secureNote}
            </div>
          </div>

          {!isMobile && <AuthVisualPanel title={t.visualTitle} subtitle={t.visualSub} testId="signin-visual-panel" />}
        </div>
      </div>
    </PublicPageShell>
  );
}
