import { useEffect, useState, type ReactNode } from 'react';
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

type ItPanelCard = {
  title: string;
  desc: string;
  allowed: boolean;
  access: string[];
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
};

const IT_PANEL_CARDS: ItPanelCard[] = [
  {
    title: 'پنل کارمند',
    desc: 'کارتابل، تیکت‌ها و وظایف کارمندان واحدها',
    allowed: true,
    access: ['کارتابل', 'تیکت‌ها', 'وظایف', 'پیام‌ها'],
    iconBg: 'rgba(96,165,250,.16)',
    iconColor: '#60a5fa',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
      </svg>
    ),
  },
  {
    title: 'پنل ادمین سایت',
    desc: 'محتوا، بلاگ، تصاویر و تنظیمات سایت',
    allowed: true,
    access: ['داشبورد', 'محتوا و بلاگ', 'تصاویر و رسانه', 'تنظیمات سایت'],
    iconBg: 'rgba(59,130,246,.16)',
    iconColor: '#3b82f6',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    title: 'پنل باشگاه مشتریان',
    desc: 'امتیازها، سطوح وفاداری و کمپین‌ها',
    allowed: true,
    access: ['امتیازها', 'سطوح وفاداری', 'کمپین‌ها'],
    iconBg: 'rgba(251,191,36,.16)',
    iconColor: '#fbbf24',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4l2.3 4.7 5.2.8-3.7 3.7.9 5.1-4.7-2.5-4.7 2.5.9-5.1L4.5 9.5l5.2-.8z" />
      </svg>
    ),
  },
  {
    title: 'پنل مدیر مالی',
    desc: 'تراکنش‌ها، تسویه و گزارش‌های مالی',
    allowed: true,
    access: ['داشبورد', 'گزارش‌های مالی', 'تراکنش‌ها', 'تسویه آژانس', 'استرداد'],
    iconBg: 'rgba(16,185,129,.16)',
    iconColor: '#34d399',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l3.5-3.5 3 3L20 7" />
      </svg>
    ),
  },
  {
    title: 'پنل مدیر بازرگانی',
    desc: 'آژانس‌ها، نرخ‌گذاری و فروش',
    allowed: true,
    access: ['داشبورد', 'مدیریت آژانس‌ها', 'نرخ‌گذاری', 'چارتر', 'تخفیف‌ها'],
    iconBg: 'rgba(147,51,234,.16)',
    iconColor: '#a855f7',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
        <path d="M19 21V10a1 1 0 0 0-1-1h-3" />
      </svg>
    ),
  },
  {
    title: 'پنل مدیر عامل',
    desc: 'خارج از حوزه دسترسی واحد IT',
    allowed: false,
    access: [],
    iconBg: '#18223a',
    iconColor: '#6b7b94',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M6 21V8l6-4 6 4v13" />
        <path d="M10 21v-6h4v6" />
      </svg>
    ),
  },
  {
    title: 'پنل مدیر ارشد',
    desc: 'خارج از حوزه دسترسی واحد IT',
    allowed: false,
    access: [],
    iconBg: '#18223a',
    iconColor: '#6b7b94',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
      </svg>
    ),
  },
  {
    title: 'پنل رئیس هیئت مدیره',
    desc: 'خارج از حوزه دسترسی واحد IT',
    allowed: false,
    access: [],
    iconBg: '#18223a',
    iconColor: '#6b7b94',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
];

function CheckBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function LockBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7b94" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

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
      className={`relative h-[25px] w-11 flex-none rounded-full transition disabled:opacity-60 ${
        on ? 'bg-[#3b82f6]' : 'bg-[#28344c]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[19px] w-[19px] rounded-full bg-white shadow transition-all ${
          on ? 'start-[3px]' : 'end-[3px]'
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

  if (!readOnly && error) {
    return <p className="p-8 text-sm text-[#f87171]">{error}</p>;
  }
  if (!readOnly && !flags) {
    return <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;
  }

  if (readOnly) {
    return (
      <div className="p-8">
        <h1 className="mb-1 text-[20.5px] font-black text-white">دسترسی به پنل‌ها</h1>
        <p className="mb-6 text-[12.5px] text-[#6b7b94]">
          ورود به پنل‌های عملیاتی تحت مدیریت واحد IT — تعیین سطح دسترسی ورود در اختیار مدیر عامل است.
        </p>

        <div className="mb-4 flex items-start gap-2.5 rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] px-[15px] py-3 text-[11.5px] leading-[1.7] text-[#cdd6e3]">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[rgba(59,130,246,.16)] text-[#60a5fa]">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <p>
            واحد IT برای پشتیبانی فنی می‌تواند وارد پنل‌های عملیاتی و کارمندان شود. تعیین سطح دسترسی
            ورود در اختیار <strong className="text-white">مدیر عامل</strong> است؛ پنل‌های خارج از حوزهٔ
            واحد IT با قفل مشخص شده‌اند.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {IT_PANEL_CARDS.map((p) => (
            <div
              key={p.title}
              className={`flex flex-col rounded-[14px] border bg-[#141d2e] p-[15px] ${
                p.allowed ? 'border-[#1f2a3d]' : 'border-[#241f2b] opacity-55'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: p.iconBg, color: p.iconColor }}
                >
                  {p.icon}
                </span>
                {p.allowed ? <CheckBadge /> : <LockBadge />}
              </div>
              <div className="text-[13.5px] font-extrabold text-white">{p.title}</div>
              <div className="mt-1 text-[11px] leading-[1.6] text-[#6b7b94]">{p.desc}</div>
              {p.access.length > 0 && (
                <div className="mt-[11px] flex flex-wrap gap-[5px]">
                  {p.access.map((a) => (
                    <span
                      key={a}
                      className="rounded-xl border border-[#1f2a3d] bg-[#0f1623] px-2 py-[3px] text-[9.5px] text-[#9fb0c7]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`mt-auto border-t border-[#1f2a3d] pt-[11px] text-[11.5px] font-bold ${
                  p.allowed ? 'text-[#3b82f6]' : 'text-[#6b7b94]'
                }`}
              >
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
      <h1 className="mb-1 text-[20.5px] font-black text-white">دسترسی به پنل‌ها</h1>
      <p className="mb-6 text-[12.5px] text-[#6b7b94]">
        فعال/غیرفعال‌کردن پنل نقش‌های دیگر — هر تغییر در دفتر رویدادها ثبت می‌شود.
      </p>

      <div className="max-w-2xl rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-5">
        <div className="flex flex-col divide-y divide-[#1f2a3d]">
          {flags!.map((f) => (
            <div key={f.panelKey} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <div className="text-sm font-bold text-[#e7ecf3]">
                  {PANEL_LABEL[f.panelKey] ?? f.panelKey}
                </div>
                {f.updatedAt && (
                  <div className="font-num mt-0.5 text-[10px] text-[#6b7b94]">
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
