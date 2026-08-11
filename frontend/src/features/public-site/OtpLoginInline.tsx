import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { fetchDevLastOtp } from '../../api/auth';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, isValidIranMobile, normalizeIranMobile } from '../../lib/fa-format';
import { localeDigits } from '../../lib/locale-format';

const SHOW_TEST_OTP =
  import.meta.env.DEV && import.meta.env.VITE_SHOW_TEST_OTP === 'true';

const STR: Record<
  StoredLocale,
  {
    otpTitle: string;
    otpSub: string;
    otpRequest: string;
    otpVerify: string;
    otpPhonePlaceholder: string;
    otpCodePlaceholder: string;
    otpSendError: string;
    otpInvalid: string;
    otpPhoneInvalid: string;
    otpSent: (phone: string) => string;
    otpRequesting: string;
    otpResend: string;
    otpDevHint: (code: string) => string;
  }
> = {
  fa: {
    otpTitle: 'ورود با شماره موبایل',
    otpSub: 'برای ادامه رزرو، شماره موبایل خود را تأیید کنید.',
    otpRequest: 'دریافت کد',
    otpVerify: 'تأیید و ورود',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: 'کد ۶ رقمی',
    otpSendError: 'خطا در ارسال کد.',
    otpInvalid: 'کد نامعتبر است.',
    otpPhoneInvalid: 'شماره موبایل معتبر نیست (مثال: 09121234567).',
    otpSent: (phone) => `کد تأیید به ${faDigits(phone)} ارسال شد.`,
    otpRequesting: 'در حال ارسال…',
    otpResend: 'ارسال مجدد کد',
    otpDevHint: (code) => `کد آزمایشی: ${faDigits(code)}`,
  },
  en: {
    otpTitle: 'Sign in with mobile',
    otpSub: 'Verify your mobile number to continue booking.',
    otpRequest: 'Send code',
    otpVerify: 'Verify & sign in',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: '6-digit code',
    otpSendError: 'Failed to send code.',
    otpInvalid: 'Invalid code.',
    otpPhoneInvalid: 'Enter a valid mobile number (e.g. 09121234567).',
    otpSent: (phone) => `Verification code sent to ${phone}.`,
    otpRequesting: 'Sending…',
    otpResend: 'Resend code',
    otpDevHint: (code) => `Test code: ${code}`,
  },
  ar: {
    otpTitle: 'تسجيل الدخول برقم الجوال',
    otpSub: 'تحقق من رقم جوالك لمتابعة الحجز.',
    otpRequest: 'إرسال الرمز',
    otpVerify: 'تأكيد وتسجيل الدخول',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: 'رمز من ٦ أرقام',
    otpSendError: 'فشل إرسال الرمز.',
    otpInvalid: 'رمز غير صالح.',
    otpPhoneInvalid: 'رقم جوال غير صالح (مثال: 09121234567).',
    otpSent: (phone) => `تم إرسال الرمز إلى ${phone}.`,
    otpRequesting: 'جارٍ الإرسال…',
    otpResend: 'إعادة إرسال الرمز',
    otpDevHint: (code) => `رمز تجريبي: ${code}`,
  },
};

export default function OtpLoginInline({
  onAuthenticated,
  embedded = false,
}: {
  onAuthenticated?: () => void;
  embedded?: boolean;
} = {}) {
  const { requestOtp, verifyOtp } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const normalizedPhone = normalizeIranMobile(phone);
  const phoneReady = isValidIranMobile(normalizedPhone);

  async function sendOtp() {
    setError(null);
    setDevCode(null);
    if (!phoneReady) {
      setError(t.otpPhoneInvalid);
      return;
    }
    if (!requestOtp) {
      setError(t.otpSendError);
      return;
    }
    setBusy(true);
    try {
      const issuedChallengeId = await requestOtp(normalizedPhone);
      setChallengeId(issuedChallengeId);
      setCode('');
      if (SHOW_TEST_OTP) {
        try {
          const { code: devOtp } = await fetchDevLastOtp(normalizedPhone);
          setDevCode(devOtp);
        } catch {
          setDevCode(null);
        }
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpSendError);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!verifyOtp) {
      setError(t.otpInvalid);
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(challengeId!, normalizeIranMobile(code));
      onAuthenticated?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpInvalid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        embedded
          ? 'mx-auto w-full max-w-sm bg-white px-1 pb-1 pt-2'
          : 'mx-auto max-w-sm rounded-2xl border border-[#eef1f5] bg-white p-6 shadow-sm'
      }
    >
      <h2 className="mb-1 text-sm font-extrabold text-[#0d2640]">{t.otpTitle}</h2>
      <p className="mb-4 text-xs text-[#6b7b94]">{t.otpSub}</p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}
      {!challengeId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
          className="flex flex-col gap-3"
        >
          <input
            data-testid="otp-phone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(normalizeIranMobile(e.target.value))}
            placeholder={t.otpPhonePlaceholder}
            className="rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button
            type="submit"
            disabled={busy || !phoneReady}
            className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t.otpRequesting : t.otpRequest}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#059669]" data-testid="otp-sent-notice">
            {t.otpSent(localeDigits(normalizedPhone, locale))}
          </p>
          {devCode && (
            <p
              className="rounded-lg bg-[#eff6ff] p-2.5 text-xs font-semibold text-[#1668c4]"
              data-testid="otp-dev-hint"
            >
              {t.otpDevHint(localeDigits(devCode, locale))}
            </p>
          )}
          <input
            data-testid="otp-code"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(normalizeIranMobile(e.target.value).slice(0, 6))}
            placeholder={t.otpCodePlaceholder}
            className="font-num rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t.otpRequesting : t.otpVerify}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendOtp()}
            className="text-xs font-bold text-[#1668c4] disabled:opacity-60"
          >
            {t.otpResend}
          </button>
        </form>
      )}
    </div>
  );
}
