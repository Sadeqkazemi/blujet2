import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { key: '', label: 'داشبورد' },
  { key: 'credit', label: 'اعتبار و مانده' },
  { key: 'sales', label: 'فروش و گزارش' },
  { key: 'inbox', label: 'کارتابل و پیام‌ها' },
  { key: 'profile', label: 'پروفایل و مدارک' },
];

export default function AgencyPortalShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate('/agency/login', { replace: true });
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-body font-sans text-ink">
      <aside className="flex w-[248px] flex-none flex-col bg-[#141d2e] text-[#e7ecf3]">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-lg text-white">
            ✈
          </div>
          <span className="text-lg font-black tracking-tight">blujet</span>
        </div>

        <div className="mx-4 mt-4 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="text-[11px] text-[#8fa1bb]">آژانس همکار</div>
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={onSignOut}
            className="w-full rounded-lg border border-white/10 py-2 text-xs text-[#9fb0c7] transition hover:bg-white/5"
          >
            خروج از حساب
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
