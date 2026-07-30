import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

// Nav labels reuse the design bundle's own isEN "navMeta" wording
// (پنل آژانس.dc.html) where the concept lines up 1:1; AR has no design
// counterpart there either, so it's hand-translated to the same bar.
const NAV_ITEMS: { key: string; label: Tr }[] = [
  { key: '', label: { fa: 'داشبورد', en: 'Dashboard', ar: 'لوحة التحكم' } },
  { key: 'seats', label: { fa: 'صندلی‌های تخصیص‌یافته', en: 'Allocated Seats', ar: 'المقاعد المخصصة' } },
  { key: 'credit', label: { fa: 'اعتبار و مانده', en: 'Credit & Balance', ar: 'الرصيد والائتمان' } },
  { key: 'sales', label: { fa: 'فروش و گزارش', en: 'Sales & Reports', ar: 'المبيعات والتقارير' } },
  { key: 'webservice', label: { fa: 'وب‌سرویس (API)', en: 'Web Service (API)', ar: 'خدمة الويب (API)' } },
  { key: 'inbox', label: { fa: 'کارتابل و پیام‌ها', en: 'Inbox & Messages', ar: 'الوارد والرسائل' } },
  { key: 'profile', label: { fa: 'پروفایل و مدارک', en: 'Profile & Documents', ar: 'الملف الشخصي والمستندات' } },
];

const STR: Record<StoredLocale, { partnerAgency: string; signOut: string }> = {
  fa: { partnerAgency: 'آژانس همکار', signOut: 'خروج از حساب' },
  en: { partnerAgency: 'Partner Agency', signOut: 'Log Out' },
  ar: { partnerAgency: 'وكالة شريكة', signOut: 'تسجيل الخروج' },
};

export default function AgencyPortalShell() {
  const { user, signOut } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const dir = locale === 'en' ? 'ltr' : 'rtl';
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate('/agency/login', { replace: true });
  }

  return (
    <div dir={dir} className="flex min-h-screen bg-body font-sans text-ink">
      <aside className="flex w-[248px] flex-none flex-col bg-[#141d2e] text-[#e7ecf3]">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-lg text-white">
            ✈
          </div>
          <span className="text-lg font-black tracking-tight">blujet</span>
        </div>

        <div className="mx-4 mt-4 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="text-[11px] text-[#8fa1bb]">{t.partnerAgency}</div>
          <div className="text-sm font-bold">{user?.fullName}</div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.key === '' ? '/agency' : `/agency/${item.key}`}
              end={item.key === ''}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-accent/20 font-bold text-white' : 'text-[#9fb0c7] hover:bg-white/5'
                }`
              }
            >
              <span>{item.label[locale]}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={onSignOut}
            className="w-full rounded-lg border border-white/10 py-2 text-xs text-[#9fb0c7] transition hover:bg-white/5"
          >
            {t.signOut}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
