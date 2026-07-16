import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchNav } from '../api/panels';
import type { PanelNavItem } from '../types/panels';

const ROLE_LABELS: Record<string, string> = {
  CEO: 'مدیر عامل',
  BOARD_CHAIR: 'رئیس هیئت مدیره',
  SENIOR_MANAGER: 'مدیر ارشد',
  FINANCE_MANAGER: 'مدیر مالی',
  COMMERCIAL_MANAGER: 'مدیر بازرگانی',
  IT_MANAGER: 'مدیر فناوری اطلاعات',
  SITE_ADMIN: 'ادمین سایت',
  EMPLOYEE: 'کارمند',
};

export default function PanelShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [nav, setNav] = useState<PanelNavItem[] | null>(null);

  useEffect(() => {
    fetchNav()
      .then(setNav)
      .catch(() => setNav([]));
  }, []);

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

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
          <div className="text-[11px] text-[#8fa1bb]">نقش این پنل</div>
          <div className="text-sm font-bold">{roleLabel}</div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
          {nav === null && <div className="px-2 py-3 text-xs text-[#8fa1bb]">در حال بارگذاری…</div>}
          {nav?.length === 0 && <div className="px-2 py-3 text-xs text-[#8fa1bb]">تبی برای این نقش تعریف نشده است.</div>}
          {nav?.map((item) => (
            <NavLink
              key={item.key}
              to={item.key === 'dashboard' ? '/panel' : `/panel/${item.key}`}
              end={item.key === 'dashboard'}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-accent/20 font-bold text-white' : 'text-[#9fb0c7] hover:bg-white/5'
                }`
              }
            >
              <span>{item.labelFa}</span>
              {!item.implemented && <span className="text-[10px] text-[#5a6678]">به‌زودی</span>}
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
        <Outlet context={{ nav }} />
      </main>
    </div>
  );
}
