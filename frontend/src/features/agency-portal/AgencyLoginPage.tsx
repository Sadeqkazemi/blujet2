import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { requestAgencySignupOtp, submitAgencyRequest } from '../../api/agencies';
import { AgencyLoginLayout } from './AgencyLoginLayout';

function AgencyLoginForm() {
  const { agencyLogin } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError('شماره تماس و رمز عبور را وارد کنید.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await agencyLogin(phone.trim(), password);
      navigate('/agency', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ورود. دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-[11.5px] text-muted">
          شماره تماس آژانس
        </label>
        <input
          id="phone"
          className="ltr w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="۰۹xxxxxxxxx"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[11.5px] text-muted">
          رمز عبور
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
        {submitting ? 'در حال بررسی…' : 'ورود به پنل آژانس'}
      </button>
    </form>
  );
}

function AgencySignupForm() {
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
      setError('همهٔ فیلدها را کامل و شرایط را تأیید کنید.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { challengeId: id } = await requestAgencySignupOtp(phone.trim());
      setChallengeId(id);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ارسال کد تأیید.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitOtp(e: FormEvent) {
    e.preventDefault();
    if (!challengeId || code.trim().length !== 6) {
      setError('کد ۶ رقمی را کامل وارد کنید.');
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
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ثبت درخواست.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-xl border border-border bg-[#eef4fb] p-5 text-center text-[12.5px] leading-loose text-[#3b556f]">
        درخواست همکاری شما ثبت شد. حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال
        می‌شود و به پنل B2B با نرخ‌های ویژه دسترسی خواهید داشت.
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <form onSubmit={onSubmitOtp} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="signup-code" className="mb-1.5 block text-[11.5px] text-muted">
            کد تأیید ۶ رقمی (پیامک‌شده به {phone})
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
          {submitting ? 'در حال ثبت…' : 'تأیید و ثبت درخواست'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitForm} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="applicantName" className="mb-1.5 block text-[11.5px] text-muted">
            نام آژانس
          </label>
          <input
            id="applicantName"
            className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder="نام شرکت/آژانس"
          />
        </div>
        <div>
          <label htmlFor="licenseNo" className="mb-1.5 block text-[11.5px] text-muted">
            شماره مجوز بند ب
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
          نام مدیر آژانس
        </label>
        <input
          id="managerName"
          className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          placeholder="نام مسئول"
        />
      </div>
      <div>
        <label htmlFor="signup-phone" className="mb-1.5 block text-[11.5px] text-muted">
          شماره موبایل
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
        قوانین و مقررات و حریم خصوصی blujet را می‌پذیرم.
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
        {submitting ? 'در حال ارسال…' : 'ثبت درخواست و دریافت کد'}
      </button>

      <div className="rounded-xl border border-[#dce8f7] bg-[#eef4fb] p-3 text-[11px] leading-loose text-[#3b556f]">
        حساب آژانس پس از تأیید مدارک و مجوز فعالیت توسط کارشناسان blujet فعال می‌شود و به پنل B2B با
        نرخ‌های ویژه دسترسی خواهید داشت.
      </div>
    </form>
  );
}

export default function AgencyLoginPage() {
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
          ورود
        </button>
        <button
          type="button"
          onClick={() => setTab('signup')}
          className={`-mb-px border-b-[3px] pb-2.5 text-[13.5px] font-extrabold ${
            tab === 'signup' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
        >
          ثبت‌نام
        </button>
      </div>

      {tab === 'login' ? <AgencyLoginForm /> : <AgencySignupForm />}
    </AgencyLoginLayout>
  );
}
