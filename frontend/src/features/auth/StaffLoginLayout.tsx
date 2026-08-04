import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      data-testid={compact ? 'staff-login-mobile-logo' : 'staff-login-home-logo'}
      className="relative flex items-center gap-2.5 no-underline transition hover:opacity-90"
      aria-label="بازگشت به صفحه اصلی blujet"
    >
      <div
        className={`flex flex-none items-center justify-center rounded-xl bg-gradient-to-br from-accent to-navy-2 text-white shadow-lg ${
          compact ? 'h-10 w-10 text-base' : 'h-[42px] w-[42px] text-[19px]'
        }`}
      >
        ✈
      </div>
      <div>
        <div className={`leading-none font-black text-white ${compact ? 'text-[17px]' : 'text-[19px]'}`}>blujet</div>
        <div className={`mt-0.5 text-[#93a5c2] ${compact ? 'text-[10px]' : 'text-[10.5px]'}`}>سامانهٔ مدیریت داخلی</div>
      </div>
    </Link>
  );
}

/** Shared light two-column shell for the staff login + 2FA steps — matches
 * design-reference/ورود مدیران و کارمندان.dc.html (light theme, visual
 * panel on the aside, white form panel). Responsive: compact brand header on
 * small screens; full visual column from `lg` up. */
export function StaffLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="staff-login-shell"
      className="grid min-h-screen min-h-[100dvh] grid-cols-1 overflow-x-hidden bg-[#eef2f8] font-sans text-[#0f172a] lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]"
    >
      <aside
        data-testid="staff-login-visual"
        className="relative hidden overflow-hidden bg-[#0b1526] lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-11"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(175deg,#123a63 0%,#0d2640 55%,#0b1526 100%)' }}
        />
        <BrandMark />

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

      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-white">
        <div
          data-testid="staff-login-mobile-brand"
          className="border-b border-[#e8eef6] bg-gradient-to-l from-[#123a63] to-[#0b1526] px-5 py-4 sm:px-7 lg:hidden"
        >
          <BrandMark compact />
        </div>

        <div className="flex flex-1 flex-col justify-center px-5 py-7 sm:px-8 sm:py-9 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-[360px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
