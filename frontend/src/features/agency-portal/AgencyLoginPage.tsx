import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import { AgencyLoginLayout } from './AgencyLoginLayout';

export default function AgencyLoginPage() {
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
    <AgencyLoginLayout>
      <div className="mb-1.5 text-[12.5px] font-extrabold text-ink">ورود به پنل آژانس</div>
      <div className="mb-5 text-[11.5px] text-muted">
        با شماره تماس آژانس و رمز عبور خود وارد شوید.
      </div>

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

        <p className="text-center text-[11.5px] text-muted">
          هنوز آژانس همکار نشده‌اید؟ درخواست عضویت از طریق واحد{' '}
          <span className="font-bold text-accent">بازرگانی blujet</span> بررسی می‌شود.
        </p>
      </form>
    </AgencyLoginLayout>
  );
}
