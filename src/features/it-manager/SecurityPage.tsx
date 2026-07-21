import { useCallback, useEffect, useState } from 'react';
import { fetchActiveSessions, fetchSecurityPolicy, logoutAllSessions, updateSecurityPolicy } from '../../api/it-manager';
import { faDigits } from '../../lib/fa-format';
import type { ActiveSession, SecurityPolicy } from '../../types/it-manager';

const TOGGLES: { key: keyof SecurityPolicy; title: string; desc: string }[] = [
  { key: 'requireUppercase', title: 'الزام حرف بزرگ', desc: 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد' },
  { key: 'requireNumber', title: 'الزام عدد', desc: 'رمز عبور باید حداقل یک رقم داشته باشد' },
  { key: 'requireSymbol', title: 'الزام نماد', desc: 'رمز عبور باید حداقل یک نماد ویژه داشته باشد' },
  { key: 'blockReuse', title: 'ممانعت از تکرار رمز قبلی', desc: 'رمز جدید نباید با رمزهای پیشین یکسان باشد' },
  { key: 'staffTwoFactorMandatory', title: 'احراز هویت دومرحله‌ای', desc: 'اجباری برای همه حساب‌های مدیریتی' },
];

export default function SecurityPage() {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fetchSecurityPolicy(), fetchActiveSessions()]);
      setPolicy(p);
      setSessions(s);
    } catch {
      setError('خطا در دریافت اطلاعات امنیتی.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggle(key: keyof SecurityPolicy) {
    if (!policy) return;
    try {
      const updated = await updateSecurityPolicy({ [key]: !policy[key] });
      setPolicy(updated);
    } catch {
      setError('خطا در ذخیره تغییرات.');
    }
  }

  async function onLogoutAll() {
    try {
      const { revokedCount } = await logoutAllSessions();
      setNotice(`${faDigits(revokedCount)} نشست خاتمه یافت ✓`);
      setConfirmLogoutAll(false);
      await load();
    } catch {
      setError('خطا در خروج از نشست‌ها.');
    }
  }

  if (!policy) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">رمزها و امنیت</h1>
      <p className="mb-6 text-sm text-muted">سیاست‌های رمز عبور و کنترل دسترسی</p>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-ink">سیاست رمز عبور</h2>
          <p className="mb-4 text-[11px] text-muted">قوانین اعمال‌شده روی رمز همه حساب‌های سامانه</p>
          <div className="flex flex-col">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                <div className="flex-1">
                  <div className="text-xs font-bold text-ink">{t.title}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted">{t.desc}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={Boolean(policy[t.key])}
                  aria-label={t.title}
                  onClick={() => void onToggle(t.key)}
                  className={`relative h-6 w-11 rounded-full transition ${policy[t.key] ? 'bg-accent' : 'bg-border'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      policy[t.key] ? 'right-0.5' : 'right-[22px]'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">پارامترهای رمز</h2>
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-2">حداقل طول رمز</span>
                <span className="font-num font-bold text-ink">{faDigits(policy.minLength)} کاراکتر</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">انقضای رمز</span>
                <span className="font-num font-bold text-ink">هر {faDigits(policy.expiryDays)} روز</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">تلاش ناموفق مجاز</span>
                <span className="font-num font-bold text-ink">{faDigits(policy.maxAttempts)} بار</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">نشست‌های فعال</h2>
              <button onClick={() => setConfirmLogoutAll(true)} className="text-[11px] font-bold text-danger">
                خروج همه
              </button>
            </div>
            <p className="mb-3 text-[11px] text-muted">{faDigits(sessions.length)} کاربر هم‌اکنون وارد سامانه هستند</p>
            <ul className="flex flex-col gap-2">
              {sessions.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[11px]">
                  <span className="flex-1 font-bold text-text-2">
                    {s.who} <span className="font-normal text-muted">· {s.role}</span>
                  </span>
                  <span className="font-num ltr text-muted">{s.ip ?? '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {confirmLogoutAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14]/60 p-4"
          role="presentation"
          onClick={() => setConfirmLogoutAll(false)}
        >
          <div
            role="dialog"
            aria-label="خروج اجباری همه نشست‌ها"
            className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-black text-ink">خروج اجباری همه نشست‌ها</h3>
            <p className="mb-4 text-xs text-muted">
              همه کاربران سامانه از نشست فعلی خارج می‌شوند. این عملیات بلافاصله اعمال می‌شود.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmLogoutAll(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
                انصراف
              </button>
              <button
                onClick={() => void onLogoutAll()}
                className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
              >
                خروج همه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
