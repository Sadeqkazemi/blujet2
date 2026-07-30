import type { ReactNode } from 'react';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const FEATURES: { icon: string; text: Tr }[] = [
  {
    icon: '📊',
    text: {
      fa: 'مشاهده اعتبار، فاکتورها و گردش حساب به‌صورت لحظه‌ای',
      en: 'View your credit, invoices, and account activity in real time',
      ar: 'اطّلع على رصيدك وفواتيرك ونشاط حسابك لحظيًا',
    },
  },
  {
    icon: '🎫',
    text: {
      fa: 'گزارش فروش و بلیط‌های صادرشده',
      en: 'Sales reports and issued tickets',
      ar: 'تقارير المبيعات والتذاكر الصادرة',
    },
  },
  {
    icon: '💬',
    text: {
      fa: 'مکاتبه مستقیم با واحد بازرگانی blujet',
      en: "Direct correspondence with blujet's commercial team",
      ar: 'تواصل مباشر مع فريق blujet التجاري',
    },
  },
];

const STR: Record<StoredLocale, { panelSubtitle: string; heading: string; body: string }> = {
  fa: {
    panelSubtitle: 'پنل آژانس همکار',
    heading: 'ورود آژانس همکار',
    body: 'این درگاه مخصوص آژانس‌های همکار blujet است. با شماره تماس و رمز عبوری که پس از تأیید عضویت برای شما ارسال شده وارد شوید.',
  },
  en: {
    panelSubtitle: 'Partner Agency Panel',
    heading: 'Partner Agency Login',
    body: "This portal is exclusively for blujet's partner agencies. Sign in with the phone number and password sent to you after your membership was approved.",
  },
  ar: {
    panelSubtitle: 'لوحة الوكالة الشريكة',
    heading: 'تسجيل دخول الوكالة الشريكة',
    body: 'هذه البوابة مخصصة لوكالات blujet الشريكة فقط. سجّل الدخول برقم الهاتف وكلمة المرور المُرسلة إليك بعد الموافقة على عضويتك.',
  },
};

/** Distinct light B2B-partner shell for the Agency Portal login — separate
 * from the staff dark shell (StaffLoginLayout) since AGENCY isn't a staff role.
 * No design-mock counterpart exists for this login/signup screen (per the
 * ⚑ product decision in docs/API.md's Agency Portal section — the design
 * never specified a login mechanism), so every string here is hand-translated. */
export function AgencyLoginLayout({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const t = STR[locale];
  const dir = locale === 'en' ? 'ltr' : 'rtl';

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-body p-6 font-sans text-ink">
      <div className="grid w-full max-w-[960px] grid-cols-1 overflow-hidden rounded-[22px] border border-border bg-white shadow-2xl md:grid-cols-[390px_1fr]">
        <div className="relative flex flex-col justify-between overflow-hidden border-e border-border bg-gradient-to-br from-accent to-navy-2 p-8 text-white">
          <div className="pointer-events-none absolute -top-24 -start-16 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-11 flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">✈</div>
              <div>
                <div className="text-xl font-black">blujet</div>
                <div className="text-[11px] text-white/70">{t.panelSubtitle}</div>
              </div>
            </div>
            <h2 className="mb-3.5 text-2xl leading-relaxed font-black">{t.heading}</h2>
            <p className="text-[12.5px] leading-loose text-white/80">{t.body}</p>
          </div>
          <div className="relative mt-10 flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <div key={f.text.fa} className="flex items-center gap-2 text-xs text-white/85">
                <span className="flex h-[27px] w-[27px] flex-none items-center justify-center rounded-lg bg-white/15">
                  {f.icon}
                </span>
                {f.text[locale]}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
