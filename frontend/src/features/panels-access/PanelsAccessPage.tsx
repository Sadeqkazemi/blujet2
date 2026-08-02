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

const IT_PANEL_CARDS = [
  {
    title: 'پنل کارمند',
    desc: 'کارتابل، تیکت‌ها و وظایف کارمندان واحدها',
    allowed: true,
    access: ['کارتابل', 'تیکت‌ها', 'وظایف', 'پیام‌ها'],
  },
  {
    title: 'پنل ادمین سایت',
    desc: 'محتوا، بلاگ، تصاویر و تنظیمات سایت',
    allowed: true,
    access: ['داشبورد', 'محتوا و بلاگ', 'تصاویر و رسانه', 'تنظیمات سایت'],
  },
  {
    title: 'پنل باشگاه مشتریان',
    desc: 'امتیازها، سطوح وفاداری و کمپین‌ها',
    allowed: true,
    access: ['امتیازها', 'سطوح وفاداری', 'کمپین‌ها'],
  },
  {
    title: 'پنل مدیر مالی',
    desc: 'تراکنش‌ها، تسویه و گزارش‌های مالی',
    allowed: true,
    access: ['داشبورد', 'گزارش‌های مالی', 'تراکنش‌ها', 'تسویه آژانس', 'استرداد'],
  },
  {
    title: 'پنل مدیر بازرگانی',
    desc: 'آژانس‌ها، نرخ‌گذاری و فروش',
    allowed: true,
    access: ['داشبورد', 'مدیریت آژانس‌ها', 'نرخ‌گذاری', 'چارتر', 'تخفیف‌ها'],
  },
  {
    title: 'پنل مدیر عامل',
    desc: 'خارج از حوزه دسترسی واحد IT',
    allowed: false,
    access: [] as string[],
  },
  {
    title: 'پنل مدیر ارشد',
    desc: 'خارج از حوزه دسترسی واحد IT',
    allowed: false,
    access: [] as string[],
  },
  {
    title: 'پنل رئیس هیئت مدیره',
    desc: 'خارج از حوزه دسترسی واحد IT',
    allowed: false,
    access: [] as string[],
  },
];

function Toggle({
  on,
  onToggle,
  label,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6.5 w-12 flex-none rounded-full transition disabled:opacity-60 ${
        on ? 'bg-accent' : 'bg-panel-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${
          on ? 'start-0.5' : 'end-0.5'
        }`}
      />
    </button>
  );
}

export default function PanelsAccessPage() {
  const { user } = useAuth();
  const readOnly = user?.role === 'IT_MANAGER';
  const [flags, setFlags] = useState<PanelAccessFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (readOnly) return;
    fetchAccessFlags()
      .then(setFlags)
      .catch(() => setError('خطا در دریافت وضعیت دسترسی پنل‌ها.'));
  }, [readOnly]);

  async function onToggle(flag: PanelAccessFlag) {
    setSavingKey(flag.panelKey);
    try {
      const updated = await setAccessFlag(flag.panelKey, !flag.enabled);
      setFlags((prev) =>
        prev ? prev.map((f) => (f.panelKey === flag.panelKey ? { ...f, ...updated } : f)) : prev,
      );
    } catch {
      setError('خطا در تغییر دسترسی پنل.');
    } finally {
      setSavingKey(null);
    }
  }

  if (!readOnly && error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!readOnly && !flags) return <p className="p-8 text-sm text-panel-muted">در حال بارگذاری…</p>;

  if (readOnly) {
    return (
      <div className="p-8">
        <h1 className="mb-1 text-xl font-black text-panel-ink">دسترسی به پنل‌ها</h1>
        <p className="mb-6 text-sm text-panel-muted">
          ورود به پنل‌های عملیاتی تحت مدیریت واحد IT — تعیین سطح دسترسی ورود در اختیار مدیر عامل است.
        </p>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-panel-border bg-panel-surface p-4 text-xs leading-6 text-panel-muted">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent">
            🛡
          </span>
          <p>
            واحد IT برای پشتیبانی فنی می‌تواند وارد پنل‌های عملیاتی و کارمندان شود. تعیین سطح دسترسی
            ورود در اختیار <strong className="text-panel-ink">مدیر عامل</strong> است؛ پنل‌های خارج از حوزهٔ
            واحد IT با قفل مشخص شده‌اند.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IT_PANEL_CARDS.map((p) => (
            <div
              key={p.title}
              className={`flex flex-col rounded-xl border bg-panel-surface p-4 ${
                p.allowed ? 'border-panel-border' : 'border-panel-border opacity-55'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl">{p.allowed ? '🔓' : '🔒'}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    p.allowed ? 'bg-[#10b98124] text-[#059669]' : 'bg-panel-surface-2 text-panel-muted'
                  }`}
                >
                  {p.allowed ? 'مجاز' : 'بدون دسترسی'}
                </span>
              </div>
              <div className="text-sm font-bold text-panel-ink">{p.title}</div>
              <div className="mt-1 text-[11px] leading-5 text-panel-muted">{p.desc}</div>
              {p.access.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.access.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-panel-border bg-panel-surface-2 px-2 py-0.5 text-[9.5px] text-panel-muted"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-auto border-t border-panel-border pt-3 text-[11.5px] font-bold text-accent">
                {p.allowed ? 'ورود به پنل ←' : 'بدون دسترسی'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-panel-ink">دسترسی به پنل‌ها</h1>
      <p className="mb-6 text-sm text-panel-muted">
        فعال/غیرفعال‌کردن پنل نقش‌های دیگر — هر تغییر در دفتر رویدادها ثبت می‌شود.
      </p>

      <div className="max-w-2xl rounded-xl border border-panel-border bg-panel-surface p-5">
        <div className="flex flex-col divide-y divide-panel-border">
          {flags!.map((f) => (
            <div key={f.panelKey} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <div className="text-sm font-bold text-panel-ink">{PANEL_LABEL[f.panelKey] ?? f.panelKey}</div>
                {f.updatedAt && (
                  <div className="font-num mt-0.5 text-[10px] text-panel-muted">
                    آخرین تغییر: {formatJalaliDateTime(f.updatedAt)}
                  </div>
                )}
              </div>
              <Toggle
                on={f.enabled}
                label={PANEL_LABEL[f.panelKey] ?? f.panelKey}
                disabled={savingKey === f.panelKey}
                onToggle={() => void onToggle(f)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
