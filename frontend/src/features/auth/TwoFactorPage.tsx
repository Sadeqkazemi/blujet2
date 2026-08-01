import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchDevLastStaffCode } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { StaffLoginLayout } from './StaffLoginLayout';

const STORAGE_KEY = 'blujet_staff_2fa';

interface LocationState {
  challengeId?: string;
  username?: string;
}

function readStored2fa(): LocationState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocationState;
  } catch {
    return null;
  }
}

export default function TwoFactorPage() {
  const { confirmTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = (location.state as LocationState | null) ?? {};
  const storedState = useMemo(readStored2fa, []);

  const challengeId = routerState.challengeId ?? storedState?.challengeId;
  const username = routerState.username ?? storedState?.username;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [devCodeError, setDevCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId) navigate('/login', { replace: true });
  }, [challengeId, navigate]);

  // Persist across refresh — React Router state is lost on reload.
  useEffect(() => {
    if (routerState.challengeId && routerState.username) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ challengeId: routerState.challengeId, username: routerState.username }),
      );
    }
  }, [routerState.challengeId, routerState.username]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    fetchDevLastStaffCode(username)
      .then(({ code: devCode }) => {
        if (cancelled) return;
        setCode(devCode);
        setDevCodeHint(devCode);
        setDevCodeError(null);
      })
      .catch(() => {
        if (!cancelled) setDevCodeHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!challengeId) {
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
      const loggedIn = await confirmTwoFactor(challengeId, code.trim());
      sessionStorage.removeItem(STORAGE_KEY);
      navigate(loggedIn.mustChangePassword ? '/required-password-change' : '/panel', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در تأیید کد.');
    } finally {
      setSubmitting(false);
    }
  }

  async function reloadDevCode() {
    if (!username) return;
    setDevCodeError(null);
    try {
      const { code: devCode } = await fetchDevLastStaffCode(username);
      setCode(devCode);
      setDevCodeHint(devCode);
    } catch {
      setDevCodeError('کد تأیید یافت نشد. به صفحه ورود برگردید و دوباره تلاش کنید.');
    }
  }

  return (
    <StaffLoginLayout>
      <div className="mb-4 flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-gradient-to-br from-accent/10 to-accent/20 text-accent">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <div className="mb-1.5 text-[19px] font-black text-[#0f172a]">تأیید هویت دومرحله‌ای</div>
      <div className="mb-5 text-[11.5px] leading-[1.9] text-[#64748b]">
        {devCodeHint
          ? 'کد تأیید به‌صورت خودکار پر شده است. در production کد به موبایل ثبت‌شده ارسال می‌شود.'
          : 'کد ۶ رقمی ارسال‌شده به موبایل ثبت‌شده را وارد کنید.'}
      </div>

      {username && (
        <div
          data-testid="staff-2fa-dev-hint"
          className="mb-4 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-[11px] leading-[1.9] text-[#1e40af]"
        >
          {devCodeHint ? (
            <p>
              کد تأیید:{' '}
              <span dir="ltr" className="font-mono font-bold tracking-widest">
                {devCodeHint}
              </span>
            </p>
          ) : devCodeError ? (
            <p role="status">{devCodeError}</p>
          ) : (
            <p>در حال دریافت کد تأیید از سرور…</p>
          )}
          <button
            type="button"
            onClick={() => void reloadDevCode()}
            className="mt-1 text-[11px] font-bold text-accent"
          >
            دریافت مجدد کد
          </button>
        </div>
      )}

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

      <Link
        to="/login"
        className="mt-5 block text-center text-[11.5px] font-semibold text-[#64748b] hover:text-accent"
      >
        ‹ بازگشت به ورود
      </Link>
    </StaffLoginLayout>
  );
}
