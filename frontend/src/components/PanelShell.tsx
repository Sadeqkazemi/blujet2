import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { fetchNav } from '../api/panels';
import { fetchCartable, fetchMyReferrals, fetchReferrals } from '../api/cartable';
import { fetchRefunds } from '../api/refunds';
import { fetchStaffReports } from '../api/reporting';
import { fetchLogsBadgeCount } from '../api/audit';
import { faDigits } from '../lib/fa-format';
import { STAFF_PANEL } from '../lib/staff-panel-theme';
import { staffNavIcon } from './staff-panel-nav-icons';
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

type NavBadge = { count: number; bg: string };

function navPath(key: string) {
  return key === 'dashboard' ? '/panel' : `/panel/${key}`;
}

function NavItem({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: PanelNavItem;
  active: boolean;
  badge?: NavBadge;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={navPath(item.key)}
      end={item.key === 'dashboard'}
      onClick={onNavigate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 11px',
        borderRadius: 11,
        fontSize: 12.5,
        fontWeight: active ? 800 : 600,
        color: active ? '#fff' : STAFF_PANEL.navMuted,
        background: active ? STAFF_PANEL.accentSoft : 'transparent',
        textDecoration: 'none',
      }}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        {staffNavIcon(item.key)}
      </span>
      <span style={{ flex: 1 }}>{item.labelFa}</span>
      {badge && (
        <span
          data-testid={`nav-badge-${item.key}`}
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#fff',
            background: badge.bg,
            minWidth: 20,
            height: 20,
            padding: '0 5px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          {faDigits(badge.count)}
        </span>
      )}
      {!item.implemented && (
        <span style={{ fontSize: 10, color: '#5a6678', flex: 'none' }}>به‌زودی</span>
      )}
    </NavLink>
  );
}

export default function PanelShell() {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [nav, setNav] = useState<PanelNavItem[] | null>(null);
  const [badges, setBadges] = useState<Record<string, NavBadge>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchNav()
      .then(setNav)
      .catch(() => setNav([]));
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navKeys = useMemo(() => new Set(nav?.map((item) => item.key) ?? []), [nav]);

  useEffect(() => {
    if (!nav || nav.length === 0) return;

    const next: Record<string, NavBadge> = {};
    const tasks: Promise<void>[] = [];

    if (navKeys.has('cartable')) {
      tasks.push(
        fetchCartable()
          .then((r) => {
            if (r.totalOpen > 0) next.cartable = { count: r.totalOpen, bg: STAFF_PANEL.danger };
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('refund') && user?.role === 'FINANCE_MANAGER') {
      tasks.push(
        fetchRefunds()
          .then((r) => {
            if (r.kpis.payoutQueue > 0) next.refund = { count: r.kpis.payoutQueue, bg: STAFF_PANEL.purple };
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('staff')) {
      tasks.push(
        fetchStaffReports()
          .then((r) => {
            if (r.newEmployeeEvents.length > 0) {
              next.staff = { count: r.newEmployeeEvents.length, bg: STAFF_PANEL.danger };
            }
          })
          .catch(() => undefined),
      );
    }

    if (navKeys.has('logs') && user?.role === 'IT_MANAGER') {
      tasks.push(
        fetchLogsBadgeCount()
          .then((r) => {
            if (r.count > 0) next.logs = { count: r.count, bg: STAFF_PANEL.danger };
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
                next.referrals = { count: r.counts.awaitingMyReport, bg: STAFF_PANEL.purple };
              }
            })
            .catch(() => undefined),
        );
      } else if (user?.role === 'SENIOR_MANAGER') {
        tasks.push(
          fetchReferrals()
            .then((r) => {
              if (r.kpis.awaitingReport > 0) {
                next.referrals = { count: r.kpis.awaitingReport, bg: STAFF_PANEL.purple };
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

  function isActive(key: string) {
    const path = navPath(key);
    return key === 'dashboard'
      ? location.pathname === '/panel' || location.pathname === '/panel/'
      : location.pathname.startsWith(path);
  }

  const sidebarContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px 14px' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: STAFF_PANEL.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flex: 'none',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 15.5v-1.6l-7.5-4.6V4.2a1.5 1.5 0 0 0-3 0v5.1L3 13.9v1.6l7.5-2.3v4.4l-2 1.4v1.3l3.5-1 3.5 1v-1.3l-2-1.4v-4.4L21 15.5z" />
          </svg>
        </div>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontWeight: 900, fontSize: 15.5, color: '#fff' }}>blujet</div>
          <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>پنل مدیریت</div>
        </div>
      </div>

      <div style={{ padding: '0 5px 11px' }}>
        <div style={{ display: 'block', fontSize: 10, color: STAFF_PANEL.textMuted, marginBottom: 6, paddingRight: 3 }}>
          نقش این پنل
        </div>
        <div
          data-testid="panel-shell-role"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: STAFF_PANEL.roleBadgeBg,
            border: `1px solid ${STAFF_PANEL.roleBadgeBorder}`,
            borderRadius: 10,
            padding: '9px 11px',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: STAFF_PANEL.accent,
              flex: 'none',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 800, color: STAFF_PANEL.text }}>{roleLabel}</span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflowY: 'auto' }}>
        {nav === null && <div style={{ padding: '10px 11px', fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</div>}
        {nav?.length === 0 && (
          <div style={{ padding: '10px 11px', fontSize: 12, color: STAFF_PANEL.textMuted }}>تبی برای این نقش تعریف نشده است.</div>
        )}
        {nav?.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={isActive(item.key)}
            badge={badges[item.key]}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        ))}
      </nav>

      <button
        type="button"
        data-testid="panel-shell-signout"
        onClick={() => void onSignOut()}
        style={{
          marginTop: 'auto',
          width: '100%',
          padding: '10px 11px',
          borderRadius: 10,
          border: `1px solid ${STAFF_PANEL.sidebarBorder}`,
          background: 'transparent',
          color: STAFF_PANEL.navMuted,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        خروج از حساب
      </button>
    </>
  );

  return (
    <div
      dir="rtl"
      data-testid="panel-shell"
      style={{
        fontFamily: 'Vazirmatn, sans-serif',
        background: STAFF_PANEL.pageBg,
        color: STAFF_PANEL.text,
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '248px 1fr',
        gridTemplateRows: isMobile ? 'auto 1fr' : '1fr',
      }}
    >
      {isMobile && (
        <header
          style={{
            gridColumn: '1 / -1',
            position: 'sticky',
            top: 0,
            zIndex: 150,
            background: STAFF_PANEL.sidebarBg,
            borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
            padding: '0 16px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <button
            type="button"
            data-testid="panel-mobile-menu-open"
            aria-label="منوی پنل"
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: `1px solid ${STAFF_PANEL.inputBorder}`,
              background: STAFF_PANEL.inputBg,
              color: STAFF_PANEL.text,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 18,
            }}
          >
            ☰
          </button>
          <span style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>blujet</span>
          <span style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>{roleLabel}</span>
        </header>
      )}

      {isMobile && mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(13,22,35,0.55)',
          }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            data-testid="panel-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(280px, 88vw)',
              height: '100%',
              background: STAFF_PANEL.sidebarBg,
              borderLeft: `1px solid ${STAFF_PANEL.sidebarBorder}`,
              padding: '15px 11px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                data-testid="panel-mobile-menu-close"
                aria-label="بستن"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: STAFF_PANEL.navMuted,
                  fontSize: 24,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {!isMobile && (
        <aside
          data-testid="panel-sidebar"
          style={{
            background: STAFF_PANEL.sidebarBg,
            borderLeft: `1px solid ${STAFF_PANEL.sidebarBorder}`,
            padding: '15px 11px',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {sidebarContent}
        </aside>
      )}

      <main style={{ padding: isMobile ? '16px 16px 34px' : '18px 21px 34px', minWidth: 0, overflowY: 'auto' }}>
        <Outlet context={{ nav }} />
      </main>
    </div>
  );
}
