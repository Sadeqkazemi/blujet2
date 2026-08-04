import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { requestAgencySignupOtp, submitAgencyRequest } from '../../api/agencies';
import {
  requestAgencyPasswordReset,
  setPassword as apiSetPassword,
  verifyAgencyPasswordReset,
} from '../../api/auth';
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
  forgotPassword: string;
  forgotTitle: string;
  forgotSub: string;
  forgotSendCode: string;
  forgotConfirmCode: string;
  forgotNewPassword: string;
  forgotRepeatPassword: string;
  forgotSave: string;
  forgotDone: string;
  forgotBack: string;
  forgotIncompletePhone: string;
  forgotIncompleteOtp: string;
  forgotShortPassword: string;
  forgotMismatch: string;
  forgotSendFallback: string;
  forgotVerifyFallback: string;
  forgotSaveFallback: string;
  staffQuestion: string;
  staffLoginLink: string;
  staffLoginHint: string;
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
    forgotPassword: 'فراموشی رمز عبور؟',
    forgotTitle: 'بازیابی رمز عبور آژانس',
    forgotSub: 'شماره تماس ثبت‌شدهٔ آژانس را وارد کنید تا کد تأیید پیامک شود.',
    forgotSendCode: 'ارسال کد تأیید',
    forgotConfirmCode: 'تأیید کد',
    forgotNewPassword: 'رمز عبور جدید',
    forgotRepeatPassword: 'تکرار رمز عبور',
    forgotSave: 'ذخیره رمز جدید',
    forgotDone: 'رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.',
    forgotBack: 'بازگشت به ورود',
    forgotIncompletePhone: 'شماره موبایل معتبر وارد کنید.',
    forgotIncompleteOtp: 'کد ۶ رقمی را کامل وارد کنید.',
    forgotShortPassword: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
    forgotMismatch: 'تکرار رمز با رمز جدید یکسان نیست.',
    forgotSendFallback: 'خطا در ارسال کد تأیید.',
    forgotVerifyFallback: 'کد وارد شده نادرست است.',
    forgotSaveFallback: 'خطا در ذخیره رمز عبور.',
    staffQuestion: 'کارمند یا مدیر هستید؟',
    staffLoginLink: 'ورود مدیران و کارمندان',
    staffLoginHint:
      'ورود مدیران و کارمندان از صفحهٔ جداگانهٔ سامانه انجام می‌شود — با نام کاربری (مثلاً ceo) وارد شوید.',
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
    forgotPassword: 'Forgot password?',
    forgotTitle: 'Reset Agency Password',
    forgotSub: 'Enter your agency phone number to receive a verification code by SMS.',
    forgotSendCode: 'Send Verification Code',
    forgotConfirmCode: 'Verify Code',
    forgotNewPassword: 'New Password',
    forgotRepeatPassword: 'Confirm Password',
    forgotSave: 'Save New Password',
    forgotDone: 'Password changed successfully. You can now log in.',
    forgotBack: 'Back to login',
    forgotIncompletePhone: 'Enter a valid mobile number.',
    forgotIncompleteOtp: 'Enter the full 6-digit code.',
    forgotShortPassword: 'Password must be at least 8 characters.',
    forgotMismatch: 'Password confirmation does not match.',
    forgotSendFallback: 'Error sending the verification code.',
    forgotVerifyFallback: 'The code entered is incorrect.',
    forgotSaveFallback: 'Error saving the new password.',
    staffQuestion: 'Staff or manager?',
    staffLoginLink: 'Staff & Manager Login',
    staffLoginHint:
      'Managers and staff sign in on a separate page — use your username (e.g. ceo), not your agency phone number.',
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
    forgotPassword: 'نسيت كلمة المرور؟',
    forgotTitle: 'استعادة كلمة مرور الوكالة',
    forgotSub: 'أدخل رقم هاتف الوكالة المسجّل ليصلك رمز التحقق عبر رسالة نصية.',
    forgotSendCode: 'إرسال رمز التحقق',
    forgotConfirmCode: 'تأكيد الرمز',
    forgotNewPassword: 'كلمة مرور جديدة',
    forgotRepeatPassword: 'تأكيد كلمة المرور',
    forgotSave: 'حفظ كلمة المرور الجديدة',
    forgotDone: 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
    forgotBack: 'العودة إلى تسجيل الدخول',
    forgotIncompletePhone: 'أدخل رقم جوال صالحًا.',
    forgotIncompleteOtp: 'أدخل الرمز المكوّن من 6 أرقام كاملاً.',
    forgotShortPassword: 'يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل.',
    forgotMismatch: 'تكرار كلمة المرور غير مطابق.',
    forgotSendFallback: 'خطأ في إرسال رمز التحقق.',
    forgotVerifyFallback: 'الرمز المُدخل غير صحيح.',
    forgotSaveFallback: 'خطأ في حفظ كلمة المرور الجديدة.',
    staffQuestion: 'هل أنت موظف أو مدير؟',
    staffLoginLink: 'تسجيل دخول الموظفين والمديرين',
    staffLoginHint:
      'يسجّل المديرون والموظفون الدخول من صفحة منفصلة — استخدم اسم المستخدم (مثل ceo) وليس رقم هاتف الوكالة.',
  },
};

function AgencyLoginForm() {
  const { agencyLogin, signOut } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError(t.loginRequiredError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await agencyLogin(phone.trim(), password);
      navigate(loggedIn.mustChangePassword ? '/required-password-change' : '/agency', { replace: true });
    } catch (err) {
      const looksLikeUsername = /[a-zA-Z]/.test(phone.trim()) && !/^(\+98|0)?9\d{9}$/.test(phone.trim());
      if (looksLikeUsername) {
        setError(t.staffLoginHint);
      } else {
        setError(err instanceof ApiRequestError ? err.message : t.loginFailedFallback);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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

        <button
          type="button"
          data-testid="agency-forgot-link"
          onClick={() => setForgotOpen(true)}
          className="self-start text-[11.5px] font-bold text-accent"
        >
          {t.forgotPassword}
        </button>

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

      {forgotOpen && (
        <AgencyForgotPasswordModal
          t={t}
          locale={locale}
          onClose={() => setForgotOpen(false)}
          onSignedOut={() => void signOut()}
        />
      )}
    </>
  );
}

function AgencyForgotPasswordModal({
  t,
  locale,
  onClose,
  onSignedOut,
}: {
  t: (typeof STR)['fa'];
  locale: StoredLocale;
  onClose: () => void;
  onSignedOut: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<'phone' | 'otp' | 'password' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError(t.forgotIncompletePhone);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { challengeId: id } = await requestAgencyPasswordReset(phone.trim());
      setChallengeId(id);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.forgotSendFallback);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError(t.forgotIncompleteOtp);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await verifyAgencyPasswordReset(challengeId, code.trim());
      setStep('password');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.forgotVerifyFallback);
    } finally {
      setSubmitting(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (pass1.length < 8) {
      setError(t.forgotShortPassword);
      return;
    }
    if (pass1 !== pass2) {
      setError(t.forgotMismatch);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiSetPassword(pass1);
      await onSignedOut();
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.forgotSaveFallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="agency-forgot-modal"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d2640]/55 p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-sm font-black text-ink">{t.forgotTitle}</h2>
        {step !== 'done' && (
          <p className="mb-4 text-[11.5px] leading-6 text-muted">{t.forgotSub}</p>
        )}

        {step === 'phone' && (
          <form onSubmit={(e) => void sendCode(e)} className="flex flex-col gap-3">
            <input
              data-testid="agency-forgot-phone"
              dir="ltr"
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={locale === 'fa' ? '۰۹xxxxxxxxx' : '09xxxxxxxxx'}
            />
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
            <button type="submit" disabled={submitting} className="rounded-lg bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {t.forgotSendCode}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={(e) => void verifyCode(e)} className="flex flex-col gap-3">
            <label className="text-[11.5px] text-muted">{t.otpLabel(phone)}</label>
            <input
              data-testid="agency-forgot-code"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              className="font-num text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
            <button type="submit" disabled={submitting} className="rounded-lg bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {t.forgotConfirmCode}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={(e) => void savePassword(e)} className="flex flex-col gap-3">
            <input
              data-testid="agency-forgot-pass1"
              type="password"
              dir="ltr"
              placeholder={t.forgotNewPassword}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
            />
            <input
              data-testid="agency-forgot-pass2"
              type="password"
              dir="ltr"
              placeholder={t.forgotRepeatPassword}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
            />
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
            <button type="submit" disabled={submitting} className="rounded-lg bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {t.forgotSave}
            </button>
          </form>
        )}

        {step === 'done' && (
          <p data-testid="agency-forgot-done" className="text-[12.5px] leading-loose text-muted">
            {t.forgotDone}
          </p>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full text-xs font-bold text-muted">
          {t.forgotBack}
        </button>
      </div>
    </div>
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

      <p className="mt-6 border-t border-border pt-4 text-center text-[11px] text-muted">
        {t.staffQuestion}{' '}
        <a href="/login" className="font-bold text-accent no-underline">
          {t.staffLoginLink}
        </a>
      </p>
    </AgencyLoginLayout>
  );
}
