import type { ReactNode } from 'react';

const FEATURES = [
  { icon: '🛡️', text: 'احراز هویت امن و کنترل دسترسی نقش‌محور' },
  { icon: '✓', text: 'هر نقش فقط به بخش‌های مجاز خود دسترسی دارد' },
  { icon: '🕒', text: 'ثبت گزارش خودکار فعالیت‌ها برای مدیران' },
];

/** Shared dark two-column shell for the staff login + 2FA steps. */
export function StaffLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1220] p-6 font-sans text-[#e7ecf3]">
      <div className="grid w-full max-w-[960px] grid-cols-1 overflow-hidden rounded-[22px] border border-[#1f2a3d] bg-[#0f1726] shadow-2xl md:grid-cols-[390px_1fr]">
        <div className="relative flex flex-col justify-between overflow-hidden border-e border-[#1c2740] bg-gradient-to-br from-[#101d33] to-[#0b1626] p-8">
          <div className="pointer-events-none absolute -top-24 -start-16 h-72 w-72 rounded-full bg-accent/10" />
          <div className="relative">
            <div className="mb-11 flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-navy-2 text-xl text-white">
                ✈
              </div>
              <div>
                <div className="text-xl font-black text-white">blujet</div>
                <div className="text-[11px] text-[#8fa1bb]">سامانهٔ مدیریت داخلی</div>
              </div>
            </div>
            <h2 className="mb-3.5 text-2xl leading-relaxed font-black text-white">ورود مدیران و کارمندان</h2>
            <p className="text-[12.5px] leading-loose text-[#8fa1bb]">
              این درگاه مخصوص کارکنان سازمان است. با حساب کاربری‌ای که واحد فناوری اطلاعات برای شما ایجاد کرده
              است وارد شوید.
            </p>
          </div>
          <div className="relative mt-10 flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-2 text-xs text-[#aebbd0]">
                <span className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-lg bg-accent/15">
                  {f.icon}
                </span>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
