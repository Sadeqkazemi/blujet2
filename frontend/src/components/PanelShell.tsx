import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchNav } from '../api/panels';
import { fetchCartable, fetchMyReferrals, fetchReferrals } from '../api/cartable';
import { fetchRefunds } from '../api/refunds';
import { fetchLowSalesAlerts, fetchStaffReports } from '../api/reporting';
import { fetchLogsBadgeCount } from '../api/audit';
import { fetchCeoPricing } from '../api/pricing';
import { faDigits } from '../lib/fa-format';
import type { PanelNavItem } from '../types/panels';
import type { LowSalesAlert } from '../types/reporting';
import { isLowSalesRole } from '../types/panel-shell';
import PanelNotifBell from './PanelNotifBell';

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

type NavBadge = { count: number; className: string };

export default function PanelShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [nav, setNav] = useState<PanelNavItem[] | null>(null);
  const [badges, setBadges] = useState<Record<string, NavBadge>>({});
  const [lowSalesAlerts, setLowSalesAlerts] = useState<LowSalesAlert[]>([]);

  useEffect(() => {
    fetchNav()
      .then(setNav)
      .catch(() => setNav([]));
  }, []);

  useEffect(() => {
    if (!isLowSalesRole(user?.role)) {
      setLowSalesAlerts([]);
      return;
    }
    fetchLowSalesAlerts()
      .then(setLowSalesAlerts)
      .catch(() => setLowSalesAlerts([]));
  }, [user?.role]);

  const navKeys = useMemo(() => new Set(nav?.map((item) => item.key) ?? []), [nav]);

  useEffect(() => {
    if (!nav || nav.length === 0) return;

    const next: Record<string, NavBadge> = {};
    const tasks: Promise<void>[] = [];

    if (navKeys.has('cartable')) {
      tasks.push(
        fetchCartable()
          .then((r) => {
            if (r.totalOpen > 0) {
              next.cartable = {
                count: r.totalOpen,
                className: 'bg-danger text-white',
              };
            }
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('refund') && user?.role === 'FINANCE_MANAGER') {
      tasks.push(
        fetchRefunds()
          .then((r) => {
            if (r.kpis.payoutQueue > 0) {
              next.refund = {
                count: r.kpis.payoutQueue,
                className: 'bg-[#a855f7] text-white',
              };
            }
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('staff')) {
      tasks.push(
        fetchStaffReports()
          .then((r) => {
            if (r.newEmployeeEvents.length > 0) {
              next.staff = {
                count: r.newEmployeeEvents.length,
                className: 'bg-danger text-white',
              };
            }
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('logs') && user?.role === 'IT_MANAGER') {
      tasks.push(
        fetchLogsBadgeCount()
          .then((r) => {
            if (r.count > 0) {
              next.logs = { count: r.count, className: 'bg-danger text-white' };
            }
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('referrals')) {
      if (user?.role === 'EMPLOYEE') {
        tasks.push(
          fetchMyReferrals()
            .then((r) => {
              if (r.counts.awaitingMyReport > 0) {
                next.referrals = {
                  count: r.counts.awaitingMyReport,
                  className: 'bg-[#a855f7] text-white',
                };
              }
            })
            .catch(() => undefined),
        );
      } else if (user?.role === 'SENIOR_MANAGER') {
        tasks.push(
          fetchReferrals()
            .then((r) => {
              if (r.kpis.awaitingReport > 0) {
                next.referrals = {
                  count: r.kpis.awaitingReport,
                  className: 'bg-[#a855f7] text-white',
                };
              }
            })
            .catch(() => undefined),
        );
      }
    }

    if (navKeys.has('pricing') && user?.role === 'CEO') {
      tasks.push(
        fetchCeoPricing()
          .then((r) => {
            if (r.pending.length > 0) {
              next.pricing = {
                count: r.pending.length,
                className: 'bg-[#a78bfa] text-white',
              };
            }
          })
          .catch(() => undefined),
      );
    }

    void Promise.all(tasks).then(() => setBadges(next));
  }, [nav, navKeys, user?.role]);

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';
  // Executive panels in design-reference-v2 are full dark shells (sidebar + main).
  const darkShell =
    user?.role === 'CEO' ||
    user?.role === 'BOARD_CHAIR' ||
    user?.role === 'SENIOR_MANAGER';
  const roleInitial =
    user?.role === 'CEO'
      ? 'مع'
      : user?.role === 'BOARD_CHAIR'
        ? 'ره'
        : user?.role === 'SENIOR_MANAGER'
          ? 'ما'
          : roleLabel.slice(0, 1);

  const onDashboard = /^\/panel\/?$/.test(location.pathname);
  const showNotifChrome = isLowSalesRole(user?.role) && !onDashboard;
  const notifAlerts = lowSalesAlerts.slice(1);
  const chromeVariant = darkShell ? 'dark' : 'light';

  return (
    <div
      dir="rtl"
      className={`flex min-h-screen font-sans ${darkShell ? 'bg-[#0f1623] text-[#e7ecf3]' : 'bg-body text-ink'}`}
    >
      <aside className="flex w-[248px] flex-none flex-col border-l border-[#1f2a3d] bg-[#141d2e] text-[#e7ecf3]">
        <div className="flex items-center gap-2.5 border-b border-[#1f2a3d] px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3b82f6] text-lg text-white">
            ✈
          </div>
          <span className="text-lg font-black tracking-tight">blujet</span>
        </div>

        <div className="mx-4 mt-4 rounded-[11px] border border-[#28344c] bg-[#18223a] px-3 py-2.5">
          <div className="text-[11px] text-[#6b7b94]">نقش این پنل</div>
          <div className="text-sm font-bold text-white">{roleLabel}</div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
          {nav === null && <div className="px-2 py-3 text-xs text-[#6b7b94]">در حال بارگذاری…</div>}
          {nav?.length === 0 && (
            <div className="px-2 py-3 text-xs text-[#6b7b94]">تبی برای این نقش تعریف نشده است.</div>
          )}
          {nav?.map((item) => {
            const badge = badges[item.key];
            return (
              <NavLink
                key={item.key}
                to={item.key === 'dashboard' ? '/panel' : `/panel/${item.key}`}
                end={item.key === 'dashboard'}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-[11px] px-3 py-2.5 text-[12.5px] transition ${
                    isActive
                      ? 'bg-[rgba(59,130,246,.16)] font-bold text-white'
                      : 'font-medium text-[#9fb0c7] hover:bg-white/5'
                  }`
                }
              >
                <span className="flex-1">{item.labelFa}</span>
                {badge && (
                  <span
                    data-testid={`nav-badge-${item.key}`}
                    className={`font-num ms-2 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold ${badge.className}`}
                  >
                    {faDigits(badge.count)}
                  </span>
                )}
                {!item.implemented && <span className="text-[10px] text-[#5a6678]">به‌زودی</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-[#1f2a3d] p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#9333ea] text-[11px] font-extrabold text-white">
              {roleInitial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-white">{roleLabel}</div>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="text-[10.5px] text-[#9fb0c7] transition hover:text-white"
              >
                خروج از حساب
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {showNotifChrome && (
          <div
            className={`flex items-center justify-end gap-2.5 px-[21px] pt-[18px] ${
              darkShell ? '' : 'px-8 pt-6'
            }`}
          >
            <div
              className={
                darkShell
                  ? 'flex h-[42px] w-[230px] items-center gap-2 rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 text-[12px] text-[#6b7b94]'
                  : 'flex h-[42px] w-[230px] items-center gap-2 rounded-[10px] border border-border bg-white px-3 text-[12px] text-muted'
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <span>جستجو…</span>
            </div>
            <PanelNotifBell alerts={notifAlerts} variant={chromeVariant} />
          </div>
        )}
        <Outlet context={{ nav, lowSalesAlerts }} />
      </main>
    </div>
  );
}
