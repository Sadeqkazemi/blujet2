import type { ReactNode } from 'react';
import PublicHeader from '../../components/public/PublicHeader';

const FEATURES = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" />
      </svg>
    ),
    text: 'احراز هویت امن و کنترل دسترسی نقش‌محور',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    text: 'هر نقش فقط به بخش‌های مجاز خود دسترسی دارد',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    text: 'ثبت گزارش خودکار فعالیت‌ها برای مدیران',
  },
];

/** Shared shell for staff login + 2FA + forced password change.
 * Top chrome reuses the homepage `PublicHeader`; body keeps the design's
 * two-column visual/form layout (single column below `lg`). */
export function StaffLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="staff-login-shell"
      dir="rtl"
      className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#eef2f8] font-sans text-[#0f172a]"
    >
      <PublicHeader />

      <div className="grid min-h-[calc(100dvh-70px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        <aside
          data-testid="staff-login-visual"
          className="relative hidden overflow-hidden bg-[#0b1526] lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-11"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(175deg,#123a63 0%,#0d2640 55%,#0b1526 100%)' }}
          />

          <div className="relative text-[10.5px] font-bold tracking-wide text-[#93a5c2]">
            سامانهٔ مدیریت داخلی
          </div>

          <div className="relative max-w-[460px]">
            <h1 className="mb-4 text-[28px] leading-relaxed font-black text-white xl:text-[32px]">
              به سامانهٔ مدیریت داخلی blujet خوش آمدید
            </h1>
            <p className="text-[13px] leading-loose text-[#c3cfe3] xl:text-[13.5px]">
              این درگاه مخصوص مدیران و کارمندان سازمان است — همهٔ فعالیت‌ها، مدیریت پروازها، آژانس‌ها و امور مالی از
              همین‌جا در دسترس شماست.
            </p>
          </div>

          <div className="relative flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-2.5 text-[12.5px] text-[#dde5f2]">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-accent/20 text-[#60a5fa]">
                  {f.icon}
                </span>
                {f.text}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex flex-1 flex-col justify-center bg-white px-5 py-7 sm:px-8 sm:py-9 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-[360px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
