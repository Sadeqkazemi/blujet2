import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { requestAgencySignupOtp, submitAgencyRequest } from '../../api/agencies';
import { AgencyLoginLayout } from './AgencyLoginLayout';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';

// ورود آژانس همکار — no design-mock counterpart exists for this login/
// signup screen at all (per the ⚑ product decision in docs/API.md's
// Agency Portal section: the design never specified a login mechanism for
// AGENCY accounts), so every string below is hand-translated rather than
// pulled from design-reference-v2/پنل آژانس.dc.html's own isEN/isAR
// ternaries (those only cover the post-login dashboard content). A few
// concepts that DO overlap with the customer signup form (license number,
// manager name, terms checkbox) reuse the exact wording already
// established in CustomerLoginPage.tsx's agency-signup tab for consistency.

const STR: Record<StoredLocale, {
  tabLogin: string;
  tabSignup: string;
  phoneLabel: string;
  passwordLabel: string;
  loginRequiredError: string;
  loginFailedFallback: string;
  loginChecking: string;
  loginSubmit: string;
  agencyNameLabel: string;
  agencyNamePlaceholder: string;
  licenseLabel: string;
  managerLabel: string;
  managerPlaceholder: string;
  phoneMobileLabel: string;
  termsCheckbox: string;
  signupIncompleteError: string;
  signupSendCodeFallback: string;
  signupSending: string;
  signupSubmit: string;
  otpLabel: (phone: string) => string;
  otpIncompleteError: string;
  otpSubmitFallback: string;
  otpSubmitting: string;
  otpConfirm: string;
  doneTitle: string;
  agencyNote: string;
}> = {
  fa: {
    tabLogin: 'ورود',
    tabSignup: 'ثبت‌نام',
    phoneLabel: 'شماره تماس آژانس',
    passwordLabel: 'رمز عبور',
    loginRequiredError: 'شماره تماس و رمز عبور را وارد کنید.',
    loginFailedFallback: 'خطا در ورود. دوباره تلاش کنید.',
    loginChecking: 'در حال بررسی…',
    loginSubmit: 'ورود به پنل آژانس',
    agencyNameLabel: 'نام آژانس',
    agencyNamePlaceholder: 'نام شرکت/آژانس',
    licenseLabel: 'شماره مجوز بند ب',
    managerLabel: 'نام مدیر آژانس',
    managerPlaceholder: 'نام مسئول',
    phoneMobileLabel: 'شماره موبایل',
    termsCheckbox: 'قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.',
    signupIncompleteError: 'همهٔ فیلدها را کامل و شرایط را تأیید کنید.',
    signupSendCodeFallback: 'خطا در ارسال کد تأیید.',
    signupSending: 'در حال ارسال…',
    signupSubmit: 'ثبت درخواست و دریافت کد',
    otpLabel: (phone) => `کد تأیید ۶ رقمی (پیامک‌شده به ${phone})`,
    otpIncompleteError: 'کد ۶ رقمی را کامل وارد کنید.',
    otpSubmitFallback: 'خطا در ثبت درخواست.',
    otpSubmitting: 'در حال ثبت…',
    otpConfirm: 'تأیید و ثبت درخواست',
    doneTitle: 'درخواست همکاری شما ثبت شد.',
    agencyNote: 'حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.',
  },
  en: {
    tabLogin: 'Log in',
    tabSignup: 'Sign up',
    phoneLabel: 'Agency Phone Number',
    passwordLabel: 'Password',
    loginRequiredError: 'Enter your phone number and password.',
    loginFailedFallback: 'Login failed. Please try again.',
    loginChecking: 'Checking…',
    loginSubmit: 'Log In to Agency Panel',
    agencyNameLabel: 'Agency Name',
    agencyNamePlaceholder: 'Company/agency name',
    licenseLabel: 'License Number (Category B)',
    managerLabel: 'Agency Manager Name',
    managerPlaceholder: "Manager's name",
    phoneMobileLabel: 'Mobile Number',
    termsCheckbox: "I accept blujet's Terms & Conditions and Privacy Policy.",
    signupIncompleteError: 'Complete all fields and accept the terms.',
    signupSendCodeFallback: 'Error sending the verification code.',
    signupSending: 'Sending…',
    signupSubmit: 'Submit Request & Get Code',
    otpLabel: (phone) => `6-digit verification code (sent by SMS to ${phone})`,
    otpIncompleteError: 'Enter the full 6-digit code.',
    otpSubmitFallback: 'Error submitting the request.',
    otpSubmitting: 'Submitting…',
    otpConfirm: 'Verify & Submit Request',
    doneTitle: 'Your partnership request has been submitted.',
    agencyNote: "Agency accounts are activated after blujet reviews your license and documents, unlocking special B2B rates.",
  },
  ar: {
    tabLogin: 'تسجيل الدخول',
    tabSignup: 'إنشاء حساب',
    phoneLabel: 'رقم هاتف الوكالة',
    passwordLabel: 'كلمة المرور',
    loginRequiredError: 'أدخل رقم الهاتف وكلمة المرور.',
    loginFailedFallback: 'فشل تسجيل الدخول. حاول مرة أخرى.',
    loginChecking: 'جارٍ التحقق…',
    loginSubmit: 'تسجيل الدخول إلى لوحة الوكالة',
    agencyNameLabel: 'اسم الوكالة',
    agencyNamePlaceholder: 'اسم الشركة/الوكالة',
    licenseLabel: 'رقم الترخيص (الفئة ب)',
    managerLabel: 'اسم مدير الوكالة',
    managerPlaceholder: 'اسم المدير',
    phoneMobileLabel: 'رقم الجوال',
    termsCheckbox: 'أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بـ blujet.',
    signupIncompleteError: 'أكمل جميع الحقول ووافق على الشروط.',
    signupSendCodeFallback: 'خطأ في إرسال رمز التحقق.',
    signupSending: 'جارٍ الإرسال…',
    signupSubmit: 'إرسال الطلب والحصول على الرمز',
    otpLabel: (phone) => `رمز التحقق المكوّن من 6 أرقام (أُرسل عبر الرسائل القصيرة إلى ${phone})`,
    otpIncompleteError: 'أدخل الرمز المكوّن من 6 أرقام كاملاً.',
    otpSubmitFallback: 'خطأ في إرسال الطلب.',
    otpSubmitting: 'جارٍ الإرسال…',
    otpConfirm: 'تأكيد وإرسال الطلب',
    doneTitle: 'تم تقديم طلب الشراكة الخاص بك.',
    agencyNote: 'تُفعَّل حسابات الوكالات بعد مراجعة blujet لترخيصك ومستنداتك، لتحصل على أسعار B2B خاصة.',
  },
};

function AgencyLoginForm() {
  const { agencyLogin } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError(t.loginRequiredError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await agencyLogin(phone.trim(), password);
      navigate('/agency', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.loginFailedFallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-[11.5px] text-muted">
          {t.phoneLabel}
        </label>
        <input
          id="phone"
          className="ltr w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder={locale === 'fa' ? '۰۹xxxxxxxxx' : '09xxxxxxxxx'}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[11.5px] text-muted">
          {t.passwordLabel}
        </label>
        <input
          id="password"
          type="password"
          className="ltr w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? t.loginChecking : t.loginSubmit}
      </button>
    </form>
  );
}

function AgencySignupForm() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [applicantName, setApplicantName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formValid =
    applicantName.trim().length >= 2 &&
    managerName.trim().length >= 2 &&
    licenseNo.trim().length >= 2 &&
    /^09\d{9}$/.test(phone.trim()) &&
    accepted;

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    if (!formValid) {
      setError(t.signupIncompleteError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { challengeId: id } = await requestAgencySignupOtp(phone.trim());
      setChallengeId(id);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.signupSendCodeFallback);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitOtp(e: FormEvent) {
    e.preventDefault();
    if (!challengeId || code.trim().length !== 6) {
      setError(t.otpIncompleteError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitAgencyRequest({
        applicantName: applicantName.trim(),
        managerName: managerName.trim(),
        licenseNo: licenseNo.trim(),
        phone: phone.trim(),
        challengeId,
        code: code.trim(),
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpSubmitFallback);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-xl border border-border bg-[#eef4fb] p-5 text-center text-[12.5px] leading-loose text-[#3b556f]">
        {t.doneTitle} {t.agencyNote}
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <form onSubmit={onSubmitOtp} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="signup-code" className="mb-1.5 block text-[11.5px] text-muted">
            {t.otpLabel(phone)}
          </label>
          <input
            id="signup-code"
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            className="font-num h-[46px] w-full rounded-xl border border-border bg-[#f8fafc] px-3.5 text-center text-lg tracking-[0.4em] text-ink outline-none focus:border-accent"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? t.otpSubmitting : t.otpConfirm}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitForm} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="applicantName" className="mb-1.5 block text-[11.5px] text-muted">
            {t.agencyNameLabel}
          </label>
          <input
            id="applicantName"
            className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder={t.agencyNamePlaceholder}
          />
        </div>
        <div>
          <label htmlFor="licenseNo" className="mb-1.5 block text-[11.5px] text-muted">
            {t.licenseLabel}
          </label>
          <input
            id="licenseNo"
            dir="ltr"
            className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            value={licenseNo}
            onChange={(e) => setLicenseNo(e.target.value)}
            placeholder="XXXX-XXXX"
          />
        </div>
      </div>
      <div>
        <label htmlFor="managerName" className="mb-1.5 block text-[11.5px] text-muted">
          {t.managerLabel}
        </label>
        <input
          id="managerName"
          className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          placeholder={t.managerPlaceholder}
        />
      </div>
      <div>
        <label htmlFor="signup-phone" className="mb-1.5 block text-[11.5px] text-muted">
          {t.phoneMobileLabel}
        </label>
        <input
          id="signup-phone"
          dir="ltr"
          className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
        />
      </div>
      <label className="flex items-center gap-2 text-[11.5px] text-[#3b4554]">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        {t.termsCheckbox}
      </label>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !formValid}
        className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? t.signupSending : t.signupSubmit}
      </button>

      <div className="rounded-xl border border-[#dce8f7] bg-[#eef4fb] p-3 text-[11px] leading-loose text-[#3b556f]">
        {t.agencyNote}
      </div>
    </form>
  );
}

export default function AgencyLoginPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  return (
    <AgencyLoginLayout>
      <div className="mb-5 flex gap-5 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`-mb-px border-b-[3px] pb-2.5 text-[13.5px] font-extrabold ${
            tab === 'login' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
        >
          {t.tabLogin}
        </button>
        <button
          type="button"
          onClick={() => setTab('signup')}
          className={`-mb-px border-b-[3px] pb-2.5 text-[13.5px] font-extrabold ${
            tab === 'signup' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
        >
          {t.tabSignup}
        </button>
      </div>

      {tab === 'login' ? <AgencyLoginForm /> : <AgencySignupForm />}
    </AgencyLoginLayout>
  );
}
