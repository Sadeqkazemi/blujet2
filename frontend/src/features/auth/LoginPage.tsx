import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { StaffLoginLayout } from './StaffLoginLayout';

export default function LoginPage() {
  const { requestLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const challengeId = await requestLogin(username.trim(), password);
      navigate('/two-factor', { state: { challengeId } });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ورود. دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StaffLoginLayout>
      <div className="mb-1.5 text-[12.5px] font-extrabold text-white">ورود به سامانه</div>
      <div className="mb-5 text-[11.5px] text-[#8fa1bb]">
        با نام کاربری و رمز عبوری که واحد فناوری اطلاعات برای شما ایجاد کرده است وارد شوید.
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="username" className="mb-1.5 block text-[11.5px] text-[#9fb0c7]">
            نام کاربری
          </label>
          <input
            id="username"
            className="ltr w-full rounded-lg border border-[#263248] bg-[#0b1220] px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-[11.5px] text-[#9fb0c7]">
            رمز عبور
          </label>
          <input
            id="password"
            type="password"
            className="ltr w-full rounded-lg border border-[#263248] bg-[#0b1220] px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
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
          {submitting ? 'در حال بررسی…' : 'ورود به پنل من'}
        </button>

        <p className="text-center text-[11.5px] text-[#8fa1bb]">
          حساب کاربری ندارید؟ ایجاد حساب کارکنان تنها از طریق{' '}
          <span className="font-bold text-[#93c5fd]">واحد فناوری اطلاعات (مدیر IT)</span> انجام می‌شود.
        </p>
      </form>
    </StaffLoginLayout>
  );
}
