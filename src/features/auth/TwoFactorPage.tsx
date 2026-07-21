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
      <div className="mb-1.5 text-[12.5px] font-extrabold text-white">تأیید هویت دومرحله‌ای</div>
      <div className="mb-5 text-[11.5px] text-[#8fa1bb]">کد ۶ رقمی ارسال‌شده را وارد کنید.</div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="code" className="mb-1.5 block text-[11.5px] text-[#9fb0c7]">
            کد تأیید
          </label>
          <input
            id="code"
            inputMode="numeric"
            maxLength={6}
            className="ltr w-full rounded-lg border border-[#263248] bg-[#0b1220] px-3.5 py-2.5 text-center text-lg font-num tracking-[0.4em] text-white outline-none focus:border-accent"
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
          {submitting ? 'در حال بررسی…' : 'تأیید و ورود'}
        </button>
      </form>
    </StaffLoginLayout>
  );
}
