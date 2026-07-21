import type { ReactNode } from 'react';

const FEATURES = [
  { icon: '🛡️', text: 'احراز هویت امن و کنترل دسترسی نقش‌محور' },
  { icon: '✓', text: 'هر نقش فقط به بخش‌های مجاز خود دسترسی دارد' },
  { icon: '🕒', text: 'ثبت گزارش خودکار فعالیت‌ها برای مدیران' },
];

/** Shared light two-column shell for the staff login + 2FA steps — matches
 * the refreshed design-reference/ورود مدیران و کارمندان.dc.html (light
 * theme, visual panel on the aside, white form panel). The design's photo
 * background is a solid brand gradient here instead of a hotlinked
 * external image (no external asset dependency at runtime), and the
 * accent stays #1668c4 per CLAUDE.md's locked palette rather than the
 * design file's local blue variant. */
export function StaffLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#eef2f8] font-sans text-[#0f172a] md:grid-cols-[1fr_460px]">
      <div className="relative hidden overflow-hidden bg-[#0b1526] md:flex md:flex-col md:justify-between md:p-11">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(175deg,#123a63 0%,#0d2640 55%,#0b1526 100%)' }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-gradient-to-br from-accent to-navy-2 text-[19px] text-white shadow-lg">
            ✈
          </div>
          <div>
            <div className="text-[19px] leading-none font-black text-white">blujet</div>
            <div className="mt-0.5 text-[10.5px] text-[#93a5c2]">سامانهٔ مدیریت داخلی</div>
          </div>
        </div>

        <div className="relative max-w-[460px]">
          <h1 className="mb-4 text-[32px] leading-relaxed font-black text-white">
            به سامانهٔ مدیریت داخلی blujet خوش آمدید
          </h1>
          <p className="text-[13.5px] leading-loose text-[#c3cfe3]">
            این درگاه مخصوص مدیران و کارمندان سازمان است — همهٔ فعالیت‌ها، مدیریت پروازها، آژانس‌ها و امور مالی از
            همین‌جا در دسترس شماست.
          </p>
        </div>

        <div className="relative flex flex-col gap-3">
          {FEATURES.map((f) => (
            <div key={f.text} className="flex items-center gap-2.5 text-[12.5px] text-[#dde5f2]">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-accent/20">
                {f.icon}
              </span>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center bg-white p-9">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}
