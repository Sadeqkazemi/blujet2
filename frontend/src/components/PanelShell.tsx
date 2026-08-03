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
import { formatJalaliDate } from '../lib/jalali';
import type { PanelNavItem } from '../types/panels';
import type { LowSalesAlert } from '../types/reporting';
import { isLowSalesRole } from '../types/panel-shell';
import PanelNotificationBell, { type PanelNotificationItem } from './PanelNotificationBell';
import PanelNotifBell from './PanelNotifBell';
import PanelSearchBox from './PanelSearchBox';
import { PANEL_BRAND_PLANE_ICON, panelNavIcon } from './panel-nav-icons';

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

/** Brand subtitle under «blujet» — sampled from each panel's design sidebar. */
const ROLE_BRAND_SUB: Record<string, string> = {
  IT_MANAGER: 'پنل فناوری اطلاعات',
  EMPLOYEE: 'پنل کارمند',
};

type NavBadge = { count: number; className: string };

function lowSalesNotifItems(alerts: LowSalesAlert[]): PanelNotificationItem[] {
  // First alert is shown as the in-page banner; leftovers go to the bell.
  return alerts.slice(1).map((a) => ({
    key: `low-sales-${a.flightNo}-${a.departureAt}`,
    title: 'هشدار فروش ضعیف',
    sublabel: `${a.flightNo} ${a.originCode} ← ${a.destCode} · ${formatJalaliDate(a.departureAt)}`,
    to: '/panel/finance',
    tone: 'warning' as const,
  }));
}

export default function PanelShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [nav, setNav] = useState<PanelNavItem[] | null>(null);
  const [badges, setBadges] = useState<Record<string, NavBadge>>({});
  const [notifications, setNotifications] = useState<PanelNotificationItem[]>([]);
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
    const nextNotifications: PanelNotificationItem[] = [];
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
              for (const t of r.tasks.slice(0, 5)) {
                nextNotifications.push({
                  key: `cartable-${t.id}`,
                  title: t.title,
                  sublabel: t.senderLabelFa ?? t.sender?.fullName ?? undefined,
                  to: '/panel/cartable',
                  tone: 'danger',
                });
              }
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
              nextNotifications.push({
                key: 'refund-queue',
                title: 'استرداد در صف پرداخت',
                sublabel: `${faDigits(r.kpis.payoutQueue)} مورد`,
                to: '/panel/refund',
                tone: 'purple',
              });
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
              nextNotifications.push({
                key: 'staff-events',
                title: 'رویدادهای جدید کارمندان',
                sublabel: `${faDigits(r.newEmployeeEvents.length)} مورد`,
                to: '/panel/staff',
                tone: 'danger',
              });
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
              nextNotifications.push({
                key: 'logs-alerts',
                title: 'رویدادهای امنیتی جدید',
                sublabel: `${faDigits(r.count)} مورد`,
                to: '/panel/logs',
                tone: 'danger',
              });
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
                nextNotifications.push({
                  key: 'referrals-awaiting',
                  title: 'ارجاعات در انتظار گزارش',
                  sublabel: `${faDigits(r.counts.awaitingMyReport)} مورد`,
                  to: '/panel/referrals',
                  tone: 'purple',
                });
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
                nextNotifications.push({
                  key: 'referrals-awaiting',
                  title: 'ارجاعات در انتظار گزارش',
                  sublabel: `${faDigits(r.kpis.awaitingReport)} مورد`,
                  to: '/panel/referrals',
                  tone: 'purple',
                });
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

    void Promise.all(tasks).then(() => {
      setBadges(next);
      setNotifications([...lowSalesNotifItems(lowSalesAlerts), ...nextNotifications]);
    });
  }, [nav, navKeys, user?.role, lowSalesAlerts]);

  async function onSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';
  const brandSub =
    (user?.role ? ROLE_BRAND_SUB[user.role] : undefined) ?? 'پنل مدیریت';

  /** Dark executive chrome: CEO / Board / Senior / Commercial (design v2 shells). */
  const executiveShell =
    user?.role === 'CEO' ||
    user?.role === 'BOARD_CHAIR' ||
    user?.role === 'SENIOR_MANAGER' ||
    user?.role === 'COMMERCIAL_MANAGER';
  /** Finance (and executives) get the avatar footer chrome. */
  const avatarShell = executiveShell || user?.role === 'FINANCE_MANAGER';
  const roleInitial =
    user?.role === 'CEO'
      ? 'مع'
      : user?.role === 'BOARD_CHAIR'
        ? 'ره'
        : user?.role === 'SENIOR_MANAGER'
          ? 'ما'
          : user?.role === 'FINANCE_MANAGER'
            ? 'مم'
            : user?.role === 'COMMERCIAL_MANAGER'
              ? 'مب'
              : roleLabel.slice(0, 1);
  const onDashboard = /^\/panel\/?$/.test(location.pathname);
  const showExecNotifChrome = executiveShell && isLowSalesRole(user?.role) && !onDashboard;
  const notifAlerts = lowSalesAlerts.slice(1);

  return (
    <div dir="rtl" className="flex min-h-screen bg-panel-canvas font-sans text-panel-ink">
      <aside className="sticky top-0 flex h-screen w-[248px] flex-none flex-col gap-1.5 border-l border-panel-border bg-panel-surface px-[11px] py-[15px] text-panel-ink">
        <div className="flex items-center gap-[9px] px-2 pb-3.5 pt-[7px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[#3b82f6] text-white">
            {PANEL_BRAND_PLANE_ICON}
          </div>
          <div className="leading-[1.3]">
            <div className="text-[15.5px] font-black text-white">blujet</div>
            <div className="text-[10px] text-[#6b7b94]">{brandSub}</div>
          </div>
        </div>

        <div className="px-[5px] pb-[11px]">
          <label className="mb-1.5 block pr-[3px] text-[10px] text-[#6b7b94]">نقش این پنل</label>
          <div className="flex items-center gap-[7px] rounded-[10px] border border-[#2a3a55] bg-[#18223a] px-[11px] py-[9px]">
            <span className="h-2 w-2 flex-none rounded-full bg-[#3b82f6]" />
            <span className="text-xs font-extrabold text-panel-ink">{roleLabel}</span>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {nav === null && <div className="px-2 py-3 text-xs text-panel-muted-2">در حال بارگذاری…</div>}
          {nav?.length === 0 && (
            <div className="px-2 py-3 text-xs text-panel-muted-2">تبی برای این نقش تعریف نشده است.</div>
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
                      ? 'bg-[rgba(59,130,246,.16)] font-bold text-white'
                      : 'font-medium text-panel-muted hover:bg-white/5'
                  }`
                }
              >
                <span className="flex h-5 w-5 flex-none items-center justify-center">
                  {panelNavIcon(item.key)}
                </span>
                <span className="flex-1">{item.labelFa}</span>
                {badge && (
                  <span
                    data-testid={`nav-badge-${item.key}`}
                    className={`font-num flex h-5 min-w-5 items-center justify-center rounded-[10px] px-[5px] text-center text-[10px] font-extrabold ${badge.className}`}
                  >
                    {faDigits(badge.count)}
                  </span>
                )}
                {!item.implemented && <span className="text-[10px] text-[#5a6678]">به‌زودی</span>}
              </NavLink>
            );
          })}
        </nav>

        {avatarShell ? (
          <div className="mt-auto border-t border-panel-border p-4">
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
        ) : (
          <div className="mt-auto border-t border-panel-border pt-3">
            <button
              onClick={() => void onSignOut()}
              className="w-full rounded-[11px] border border-panel-border py-2 text-xs text-panel-muted transition hover:bg-white/5"
            >
              خروج از حساب
            </button>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {executiveShell ? (
          showExecNotifChrome ? (
            <div className="flex items-center justify-end gap-2.5 px-[21px] pt-[18px]">
              <div className="flex h-[42px] w-[230px] items-center gap-2 rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 text-[12px] text-[#6b7b94]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <span>جستجو…</span>
              </div>
              <PanelNotifBell alerts={notifAlerts} variant="dark" />
            </div>
          ) : null
        ) : (
          <div className="flex items-center justify-end gap-3 border-b border-panel-border px-8 py-3">
            <PanelNotificationBell items={notifications} />
            <PanelSearchBox nav={nav ?? []} />
          </div>
        )}
        <Outlet context={{ nav, lowSalesAlerts }} />
      </main>
    </div>
  );
}
