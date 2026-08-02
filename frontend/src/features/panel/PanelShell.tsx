import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchNav, fetchPanelSelfStatus } from '../../api/panels';
import { fetchCartable, fetchMyReferrals, fetchReferrals } from '../../api/cartable';
import { fetchRefunds } from '../../api/refunds';
import { fetchStaffReports } from '../../api/reporting';
import { fetchLogsBadgeCount } from '../../api/audit';
import { faDigits } from '../../lib/fa-format';
import type { PanelNavItem } from '../../types/panels';
import PanelNavIcon from './PanelNavIcon';
import { PANEL_PAGE_SUBTITLES, PANEL_PAGE_TITLES, panelInitials } from './panel-nav-icons';
import { resolvePanelNav } from './panel-nav.config';

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

const ROLE_SUB: Record<string, string> = {
  CEO: 'دسترسی کامل مدیریتی',
  BOARD_CHAIR: 'دسترسی کامل',
  SENIOR_MANAGER: 'مدیریت عملیاتی',
  FINANCE_MANAGER: 'واحد مالی',
  COMMERCIAL_MANAGER: 'واحد بازرگانی',
  IT_MANAGER: 'واحد فناوری اطلاعات',
  SITE_ADMIN: 'مدیریت سایت',
  EMPLOYEE: 'کارمند سازمان',
};

type NavBadge = { count: number; className: string };

function activeNavKey(pathname: string): string {
  if (pathname === '/panel' || pathname === '/panel/') return 'dashboard';
  const seg = pathname.replace(/^\/panel\/?/, '').split('/')[0];
  return seg || 'dashboard';
}

/** Shared management-panel shell — matches design-reference-v2 dark panel layout. */
export default function PanelShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiNav, setApiNav] = useState<PanelNavItem[] | null>(null);
  const [panelEnabled, setPanelEnabled] = useState<boolean | null>(null);
  const [badges, setBadges] = useState<Record<string, NavBadge>>({});

  const nav = useMemo(() => resolvePanelNav(apiNav, user?.role), [apiNav, user?.role]);

  const currentKey = activeNavKey(location.pathname);
  const activeNav = nav?.find((item) => item.key === currentKey);
  const pageTitle = PANEL_PAGE_TITLES[currentKey] ?? activeNav?.labelFa ?? 'پنل مدیریت';
  const pageSub = PANEL_PAGE_SUBTITLES[currentKey] ?? '';

  useEffect(() => {
    Promise.all([fetchNav(), fetchPanelSelfStatus()])
      .then(([navItems, status]) => {
        setApiNav(navItems);
        setPanelEnabled(status.enabled);
      })
      .catch(() => {
        setApiNav([]);
        setPanelEnabled(true);
      });
  }, []);

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
              next.cartable = { count: r.totalOpen, className: 'bg-[#f87171] text-white' };
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
              next.refund = { count: r.kpis.payoutQueue, className: 'bg-[#a855f7] text-white' };
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
              next.staff = { count: r.newEmployeeEvents.length, className: 'bg-[#f87171] text-white' };
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
              next.logs = { count: r.count, className: 'bg-[#f87171] text-white' };
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
                next.referrals = { count: r.counts.awaitingMyReport, className: 'bg-[#a855f7] text-white' };
              }
            })
            .catch(() => undefined),
        );
      } else if (user?.role === 'SENIOR_MANAGER') {
        tasks.push(
          fetchReferrals()
            .then((r) => {
              if (r.kpis.awaitingReport > 0) {
                next.referrals = { count: r.kpis.awaitingReport, className: 'bg-[#a855f7] text-white' };
              }
            })
            .catch(() => undefined),
        );
      }
    }

    void Promise.all(tasks).then(() => setBadges(next));
  }, [nav, navKeys, user?.role]);

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';
  const roleSub = user ? (ROLE_SUB[user.role] ?? '') : '';
  const initials = panelInitials(user?.fullName ?? roleLabel);

  if (panelEnabled === false) {
    return (
      <div
        dir="rtl"
        data-testid="panel-blocked"
        className="flex min-h-screen flex-col items-center justify-center bg-[#0f1623] px-6 font-sans text-[#e7ecf3]"
      >
        <div className="max-w-md rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(248,113,113,.16)] text-2xl">
            🔒
          </div>
          <h1 className="mb-2 text-lg font-black text-white">پنل {roleLabel} غیرفعال است</h1>
          <p className="mb-6 text-sm leading-7 text-[#9fb0c7]">
            دسترسی این پنل توسط مدیر ارشد یا مدیر عامل موقتاً مسدود شده است. برای فعال‌سازی مجدد با واحد
            مدیریت تماس بگیرید.
          </p>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-xl bg-[#3b82f6] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
          >
            خروج از حساب
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      data-testid="panel-shell"
      className="grid min-h-screen grid-cols-[248px_1fr] bg-[#0f1623] font-sans text-[#e7ecf3]"
      style={{ ['--panel-accent' as string]: '#3b82f6' }}
    >
      <aside
        data-testid="panel-sidebar"
        className="sticky top-0 flex h-screen flex-col gap-1 border-l border-[#1f2a3d] bg-[#141d2e] px-[11px] py-[15px]"
      >
        <div className="flex items-center gap-2 px-2 pb-3.5 pt-1.5">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#3b82f6] text-white">
            <svg width={21} height={21} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M21 15.5v-1.6l-7.5-4.6V4.2a1.5 1.5 0 0 0-3 0v5.1L3 13.9v1.6l7.5-2.3v4.4l-2 1.4v1.3l3.5-1 3.5 1v-1.3l-2-1.4v-4.4L21 15.5z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[15.5px] font-black text-white">blujet</div>
            <div className="text-[10px] text-[#6b7b94]">پنل مدیریت</div>
          </div>
        </div>

        <div className="px-1.5 pb-2.5">
          <label className="mb-1.5 block pr-0.5 text-[10px] text-[#6b7b94]">نقش این پنل</label>
          <div className="flex items-center gap-1.5 rounded-[10px] border border-[#2a3a55] bg-[#18223a] px-[11px] py-2">
            <span className="h-2 w-2 flex-none rounded-full bg-[#3b82f6]" />
            <span className="text-xs font-extrabold text-[#e7ecf3]">{roleLabel}</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
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
                  `flex items-center gap-2.5 rounded-[11px] px-[11px] py-2.5 text-[12.5px] transition ${
                    isActive
                      ? 'bg-[rgba(59,130,246,.16)] font-extrabold text-[#3b82f6]'
                      : 'font-semibold text-[#9fb0c7] hover:bg-white/5'
                  }`
                }
              >
                <span className="flex h-5 w-5 flex-none items-center justify-center">
                  <PanelNavIcon navKey={item.key} />
                </span>
                <span className="flex-1">{item.labelFa}</span>
                {badge && (
                  <span
                    data-testid={`nav-badge-${item.key}`}
                    className={`flex h-5 min-w-[20px] items-center justify-center rounded-[10px] px-1.5 text-[10px] font-extrabold ${badge.className}`}
                  >
                    {faDigits(badge.count)}
                  </span>
                )}
                {!item.implemented && <span className="text-[10px] text-[#5a6678]">به‌زودی</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#1f2a3d] pt-2">
          <div className="flex items-center gap-2 px-[11px] py-2.5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#9333ea] text-[11.5px] font-extrabold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-snug">
              <div className="truncate text-[11.5px] font-bold text-white">{user?.fullName ?? roleLabel}</div>
              <div className="truncate text-[10px] text-[#6b7b94]">{roleSub}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="w-full px-[11px] py-2 text-left text-xs font-bold text-[#f87171] transition hover:text-[#fca5a5]"
          >
            خروج از حساب
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-[21px] pb-[34px] pt-[18px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 data-testid="panel-page-title" className="m-0 text-[20.5px] font-black text-white">
              {pageTitle}
            </h1>
            {pageSub && (
              <p data-testid="panel-page-sub" className="mt-1 text-[11.5px] text-[#6b7b94]">
                {pageSub}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden h-[42px] w-[230px] items-center gap-1.5 rounded-[10px] border border-[#28344c] bg-[#18223a] px-[11px] text-[11.5px] text-[#6b7b94] md:flex">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              جستجو…
            </div>
            <div className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-[10px] border border-[#28344c] bg-[#18223a] text-[#9fb0c7]">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.5 21a2 2 0 0 1-3 0" />
              </svg>
            </div>
          </div>
        </div>

        <Outlet context={{ nav }} />
      </main>
    </div>
  );
}
