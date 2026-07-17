import { useEffect, useState } from 'react';
import { fetchAccessFlags, setAccessFlag } from '../../api/panels';
import { useAuth } from '../../hooks/useAuth';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { PanelAccessFlag } from '../../types/panels';

const PANEL_LABEL: Record<string, string> = {
  SITE_ADMIN: 'پنل ادمین سایت',
  CEO: 'پنل مدیر عامل',
  BOARD_CHAIR: 'پنل رئیس هیئت مدیره',
  SENIOR_MANAGER: 'پنل مدیر ارشد',
  FINANCE: 'پنل مدیر مالی',
  COMMERCIAL: 'پنل مدیر بازرگانی',
  IT: 'پنل مدیر IT',
};

export default function PanelsAccessPage() {
  const { user } = useAuth();
  // Phase 12: IT's tab is informational only — the backend rejects its PATCH
  // anyway; the UI mirrors that instead of hiding-only.
  const readOnly = user?.role === 'IT_MANAGER';
  const [flags, setFlags] = useState<PanelAccessFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchAccessFlags()
      .then(setFlags)
      .catch(() => setError('خطا در دریافت وضعیت دسترسی پنل‌ها.'));
  }, []);

  async function onToggle(flag: PanelAccessFlag) {
    setSavingKey(flag.panelKey);
    try {
      const updated = await setAccessFlag(flag.panelKey, !flag.enabled);
      setFlags((prev) =>
        prev
          ? prev.map((f) => (f.panelKey === flag.panelKey ? { ...f, ...updated } : f))
          : prev,
      );
    } catch {
      setError('خطا در تغییر دسترسی پنل.');
    } finally {
      setSavingKey(null);
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!flags) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">دسترسی به پنل‌ها</h1>
      <p className="mb-6 text-sm text-muted">
        {readOnly
          ? 'نمای اطلاعاتی وضعیت پنل‌ها — تعیین سطح دسترسی ورود در اختیار مدیر عامل است.'
          : 'فعال/غیرفعال‌کردن پنل نقش‌های دیگر — هر تغییر در دفتر رویدادها ثبت می‌شود و سمت سرور نیز اعمال می‌گردد.'}
      </p>

      <div className="max-w-2xl rounded-xl border border-border bg-white p-5">
        <div className="flex flex-col divide-y divide-border/60">
          {flags.map((f) => (
            <div key={f.panelKey} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <div className="text-sm font-bold text-ink">{PANEL_LABEL[f.panelKey] ?? f.panelKey}</div>
                {f.updatedAt && (
                  <div className="font-num mt-0.5 text-[10px] text-muted">
                    آخرین تغییر: {formatJalaliDateTime(f.updatedAt)}
                  </div>
                )}
              </div>
              <button
                role="switch"
                aria-checked={f.enabled}
                aria-label={PANEL_LABEL[f.panelKey] ?? f.panelKey}
                disabled={readOnly || savingKey === f.panelKey}
                onClick={() => void onToggle(f)}
                className={`relative h-6.5 w-12 flex-none rounded-full transition disabled:opacity-60 ${
                  f.enabled ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${
                    f.enabled ? 'start-0.5' : 'end-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
