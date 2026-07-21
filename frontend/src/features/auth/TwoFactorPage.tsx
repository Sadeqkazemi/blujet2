import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { StaffLoginLayout } from './StaffLoginLayout';

interface LocationState {
  challengeId?: string;
}

export default function TwoFactorPage() {
  const { confirmTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const challengeId = (location.state as LocationState | null)?.challengeId;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!challengeId) {
    navigate('/login', { replace: true });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('کد ۶ رقمی را کامل وارد کنید.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await confirmTwoFactor(challengeId!, code.trim());
      navigate('/panel', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در تأیید کد.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StaffLoginLayout>
      <div className="mb-1.5 text-[19px] font-black text-[#0f172a]">تأیید هویت دومرحله‌ای</div>
      <div className="mb-5 text-[11.5px] leading-[1.9] text-[#64748b]">کد ۶ رقمی ارسال‌شده را وارد کنید.</div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="code" className="mb-1.5 block text-[11px] font-bold text-[#334155]">
            کد تأیید
          </label>
          <input
            id="code"
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            className="font-num h-[46px] w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3.5 text-center text-lg tracking-[0.4em] text-[#0f172a] outline-none focus:border-accent"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-navy-2 text-[13.5px] font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? 'در حال بررسی…' : 'تأیید و ورود'}
        </button>
      </form>
    </StaffLoginLayout>
  );
}
