import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { StaffLoginLayout } from './StaffLoginLayout';

const FORGOT_TOAST =
  'برای بازیابی رمز عبور، با واحد فناوری اطلاعات (مدیر IT) تماس بگیرید';

export default function LoginPage() {
  const { requestLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await requestLogin(username.trim(), password);
      if (result.loginMode === 'TEMPORARY_PASSWORD_ONLY') {
        navigate('/panel', { replace: true });
      } else {
        navigate('/two-factor', { state: { challengeId: result.challengeId } });
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ورود. دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
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
      <div className="mb-1.5 text-[19px] font-black text-[#0f172a]">ورود به سامانه</div>
      <div className="mb-5 text-[11.5px] leading-[1.9] text-[#64748b]">
        با نام کاربری و رمز عبوری که واحد فناوری اطلاعات برای شما ایجاد کرده است وارد شوید.
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <div>
          <label htmlFor="username" className="mb-1.5 block text-[11px] font-bold text-[#334155]">
            نام کاربری
          </label>
          <div className="relative">
            <input
              id="username"
              dir="ltr"
              className="font-num h-[46px] w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3.5 pe-10 text-right font-mono text-[13px] text-[#0f172a] outline-none focus:border-accent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold text-[#334155]">
            رمز عبور
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              className="h-[46px] w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3.5 ps-14 pe-10 text-right text-[13px] text-[#0f172a] outline-none focus:border-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2">
              <rect x="4.5" y="10" width="15" height="9" rx="2" />
              <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" />
            </svg>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute start-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[11px] font-bold text-accent"
            >
              {showPassword ? 'پنهان' : 'نمایش'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[11.5px] whitespace-nowrap text-[#334155]">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            مرا به خاطر بسپار
          </label>
          <button
            type="button"
            data-testid="staff-forgot-password"
            onClick={() => setToast(FORGOT_TOAST)}
            className="cursor-pointer text-[11.5px] font-semibold whitespace-nowrap text-accent"
          >
            فراموشی رمز عبور؟
          </button>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-600">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-navy-2 text-[13.5px] font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? 'در حال بررسی…' : 'ورود به سامانه'}
          {!submitting && (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          )}
        </button>

        <p className="mt-1 border-t border-[#eef1f6] pt-4 text-[10.5px] leading-[1.9] text-[#94a3b8]">
          حساب کاربری ندارید؟ ایجاد حساب کارکنان تنها از طریق{' '}
          <span className="font-bold text-accent">واحد فناوری اطلاعات (مدیر IT)</span> انجام می‌شود.
        </p>
      </form>

      <div className="mt-5 border-t border-[#eef1f6] pt-4 text-center text-[11.5px] leading-7 text-[#64748b]">
        <div>
          مسافر هستید؟{' '}
          <Link to="/signin" data-testid="staff-passenger-link" className="font-bold text-accent no-underline">
            ورود و ثبت‌نام مشتریان
          </Link>
        </div>
        <div>
          آژانس همکار هستید؟{' '}
          <Link to="/agency/login" data-testid="staff-agency-link" className="font-bold text-accent no-underline">
            ورود و ثبت‌نام آژانس
          </Link>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          data-testid="staff-forgot-toast"
          className="fixed bottom-6 left-1/2 z-[9000] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-[#1e293b] bg-[#0f172a] px-4 py-3 text-[12.5px] font-bold text-[#f1f5f9] shadow-xl"
        >
          <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#34d39933] text-[12px] text-[#34d399]">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </StaffLoginLayout>
  );
}
