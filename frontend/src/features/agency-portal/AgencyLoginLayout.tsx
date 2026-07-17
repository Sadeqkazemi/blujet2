import type { ReactNode } from 'react';

const FEATURES = [
  { icon: '📊', text: 'مشاهده اعتبار، فاکتورها و گردش حساب به‌صورت لحظه‌ای' },
  { icon: '🎫', text: 'گزارش فروش و بلیط‌های صادرشده' },
  { icon: '💬', text: 'مکاتبه مستقیم با واحد بازرگانی blujet' },
];

/** Distinct light B2B-partner shell for the Agency Portal login — separate
 * from the staff dark shell (StaffLoginLayout) since AGENCY isn't a staff role. */
export function AgencyLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-body p-6 font-sans text-ink">
      <div className="grid w-full max-w-[960px] grid-cols-1 overflow-hidden rounded-[22px] border border-border bg-white shadow-2xl md:grid-cols-[390px_1fr]">
        <div className="relative flex flex-col justify-between overflow-hidden border-e border-border bg-gradient-to-br from-accent to-navy-2 p-8 text-white">
          <div className="pointer-events-none absolute -top-24 -start-16 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-11 flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">✈</div>
              <div>
                <div className="text-xl font-black">blujet</div>
                <div className="text-[11px] text-white/70">پنل آژانس همکار</div>
              </div>
            </div>
            <h2 className="mb-3.5 text-2xl leading-relaxed font-black">ورود آژانس همکار</h2>
            <p className="text-[12.5px] leading-loose text-white/80">
              این درگاه مخصوص آژانس‌های همکار blujet است. با شماره تماس و رمز عبوری که پس از تأیید عضویت برای
              شما ارسال شده وارد شوید.
            </p>
          </div>
          <div className="relative mt-10 flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-2 text-xs text-white/85">
                <span className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-lg bg-white/15">
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
