import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchNav } from '../api/panels';
import { fetchCartable, fetchMyReferrals, fetchReferrals } from '../api/cartable';
import { fetchRefunds } from '../api/refunds';
import { fetchLowSalesAlerts, fetchStaffReports } from '../api/reporting';
import { fetchLogsBadgeCount } from '../api/audit';
import { faDigits } from '../lib/fa-format';
import { formatJalaliDate } from '../lib/jalali';
import type { PanelNavItem } from '../types/panels';
import type { LowSalesAlert } from '../types/reporting';
import { isLowSalesRole } from '../types/panel-shell';
import PanelNotificationBell, { type PanelNotificationItem } from './PanelNotificationBell';
import PanelSearchBox from './PanelSearchBox';

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
  /** Design v2 finance shell: avatar footer + brand subtitle. */
  const isFinanceShell = user?.role === 'FINANCE_MANAGER';

  return (
    <div dir="rtl" className="flex min-h-screen bg-panel-canvas font-sans text-panel-ink">
      <aside className="flex w-[248px] flex-none flex-col bg-panel-surface text-panel-ink">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-lg text-white">
            ✈
          </div>
          <div className="leading-[1.3]">
            <div className="text-lg font-black tracking-tight text-white">blujet</div>
            {isFinanceShell && <div className="text-[10px] text-[#6b7b94]">پنل مدیریت</div>}
          </div>
        </div>

        <div className="mx-4 mt-4 rounded-lg border border-[#2a3a55] bg-[#18223a] px-3 py-2.5">
          <div className="text-[10px] text-[#6b7b94]">نقش این پنل</div>
          <div className="mt-0.5 flex items-center gap-2 text-sm font-bold">
            {isFinanceShell && <span className="h-2 w-2 flex-none rounded-full bg-[#3b82f6]" />}
            {roleLabel}
          </div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
          {nav === null && <div className="px-2 py-3 text-xs text-[#8fa1bb]">در حال بارگذاری…</div>}
          {nav?.length === 0 && (
            <div className="px-2 py-3 text-xs text-[#8fa1bb]">تبی برای این نقش تعریف نشده است.</div>
          )}
          {nav?.map((item) => {
            const badge = badges[item.key];
            return (
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

        {isFinanceShell ? (
          <div className="mt-auto border-t border-white/10 p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#9333ea] text-[11px] font-extrabold text-white">
                مم
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
          <div className="border-t border-white/10 p-4">
            <button
              onClick={() => void onSignOut()}
              className="w-full rounded-lg border border-white/10 py-2 text-xs text-[#9fb0c7] transition hover:bg-white/5"
            >
              خروج از حساب
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-end gap-3 border-b border-white/10 px-8 py-3">
          <PanelNotificationBell items={notifications} />
          <PanelSearchBox nav={nav ?? []} />
        </div>
        <Outlet context={{ nav, lowSalesAlerts }} />
      </main>
    </div>
  );
}
