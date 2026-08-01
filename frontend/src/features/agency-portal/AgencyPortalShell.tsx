import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { fetchProfile } from '../../api/agency-portal';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyProfile } from '../../types/agency-portal';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const NAV_ITEMS: { key: string; label: Tr; icon: string }[] = [
  { key: '', label: { fa: 'داشبورد', en: 'Dashboard', ar: 'لوحة التحكم' }, icon: '▦' },
  { key: 'seats', label: { fa: 'صندلی‌های تخصیص‌یافته', en: 'Allocated Seats', ar: 'المقاعد المخصصة' }, icon: '💺' },
  { key: 'webservice', label: { fa: 'وب‌سرویس (API)', en: 'Web Service (API)', ar: 'خدمة الويب (API)' }, icon: '🔗' },
  { key: 'apidocs', label: { fa: 'مستندات وب‌سرویس', en: 'Web Service Docs', ar: 'توثيق خدمة الويب' }, icon: '📄' },
  { key: 'credit', label: { fa: 'اعتبار و مانده', en: 'Credit & Balance', ar: 'الرصيد والائتمان' }, icon: '💳' },
  { key: 'sales', label: { fa: 'فروش و گزارش', en: 'Sales & Reports', ar: 'المبيعات والتقارير' }, icon: '📊' },
  { key: 'inbox', label: { fa: 'کارتابل و پیام‌ها', en: 'Inbox & Messages', ar: 'الوارد والرسائل' }, icon: '✉' },
  { key: 'profile', label: { fa: 'پروفایل و مدارک', en: 'Profile & Documents', ar: 'الملف الشخصي والمستندات' }, icon: '👤' },
];

const STR: Record<
  StoredLocale,
  {
    b2bPartner: string;
    activePrefix: string;
    menuTitle: string;
    signOut: string;
    closeMenu: string;
  }
> = {
  fa: {
    b2bPartner: 'همکار B2B',
    activePrefix: '● فعال',
    menuTitle: 'منوی پنل آژانس',
    signOut: 'خروج از حساب',
    closeMenu: 'بستن',
  },
  en: {
    b2bPartner: 'B2B Partner',
    activePrefix: '● Active',
    menuTitle: 'Agency Panel Menu',
    signOut: 'Log Out',
    closeMenu: 'Close',
  },
  ar: {
    b2bPartner: 'شريك B2B',
    activePrefix: '● نشط',
    menuTitle: 'قائمة لوحة الوكالة',
    signOut: 'تسجيل الخروج',
    closeMenu: 'إغلاق',
  },
};

function agencyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'PA';
}

function navPath(key: string) {
  return key === '' ? '/agency' : `/agency/${key}`;
}

function NavButton({
  item,
  locale,
  active,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  locale: StoredLocale;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={navPath(item.key)}
      end={item.key === ''}
      onClick={onNavigate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 11px',
        borderRadius: 11,
        fontSize: 12.5,
        fontWeight: active ? 800 : 600,
        color: active ? '#1668c4' : '#5a6678',
        background: active ? '#eef4fb' : 'transparent',
        textDecoration: 'none',
      }}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 14 }}>
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label[locale]}</span>
    </NavLink>
  );
}

export default function AgencyPortalShell() {
  const { user, signOut } = useAuth();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const dir = locale === 'en' ? 'ltr' : 'rtl';
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<AgencyProfile | null>(null);

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const agencyName = profile?.fullName ?? user?.fullName ?? '—';
  const initials = agencyInitials(agencyName);
  const activeCode = profile?.licenseNo
    ? `${t.activePrefix} · ${locale === 'en' ? 'Code' : locale === 'ar' ? 'رمز' : 'کد'} ${profile.licenseNo}`
    : t.b2bPartner;

  function isActive(key: string) {
    const path = navPath(key);
    return key === '' ? location.pathname === '/agency' || location.pathname === '/agency/' : location.pathname.startsWith(path);
  }

  async function onSignOut() {
    await signOut();
    navigate('/agency/login', { replace: true });
  }

  const sidebar = (
    <>
      <div
        style={{
          background: '#f0f5fb',
          border: '1px solid #e1ebf6',
          borderRadius: 13,
          padding: 11,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#1668c4,#3b8ae0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12.5,
              color: '#fff',
              flex: 'none',
            }}
          >
            {initials}
          </div>
          <div style={{ lineHeight: 1.4, minWidth: 0 }}>
            <div
              data-testid="agency-shell-name"
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#0d2640',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {agencyName}
            </div>
            <div style={{ fontSize: 10, color: '#1f8a5b', fontWeight: 700 }}>{activeCode}</div>
          </div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.key || 'dashboard'}
            item={item}
            locale={locale}
            active={isActive(item.key)}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        ))}
      </nav>

      <button
        type="button"
        data-testid="agency-shell-signout"
        onClick={() => void onSignOut()}
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '10px 11px',
          borderTop: '1px solid #eef2f7',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: '#e8553a',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'inherit',
          width: '100%',
        }}
      >
        ↩ {t.signOut}
      </button>
    </>
  );

  return (
    <div
      dir={dir}
      style={{
        fontFamily: 'Vazirmatn, Inter, sans-serif',
        background: '#f6f8fb',
        color: '#16202e',
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
            background: '#fff',
            borderBottom: '1px solid #e6eaf0',
            boxShadow: '0 2px 12px -8px rgba(13,38,102,.25)',
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
            data-testid="agency-mobile-menu-open"
            aria-label={t.menuTitle}
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 17,
              color: '#16202e',
              fontFamily: 'inherit',
            }}
          >
            ☰
          </button>
          <Link to="/agency" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#1668c4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 18,
              }}
            >
              ✈
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px' }}>blujet</span>
          </Link>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#1668c4,#3b8ae0)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            {initials}
          </div>
        </header>
      )}

      {mobileMenuOpen && isMobile && (
        <div
          data-testid="agency-mobile-menu"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#fff',
            zIndex: 210,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '26px 20px 18px' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#16202e' }}>{t.menuTitle}</span>
            <button
              type="button"
              data-testid="agency-mobile-menu-close"
              aria-label={t.closeMenu}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: 'absolute',
                insetInlineEnd: 20,
                top: 22,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: '#16202e',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: '4px 24px 0', display: 'flex', flexDirection: 'column' }}>
            {NAV_ITEMS.map((item, i) => (
              <NavLink
                key={item.key || 'dashboard'}
                to={navPath(item.key)}
                end={item.key === ''}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '20px 0',
                  color: '#16202e',
                  fontSize: 17,
                  fontWeight: isActive(item.key) ? 800 : 700,
                  borderTop: i === 0 ? 'none' : '1px solid #eef1f5',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{item.label[locale]}</span>
                {!isActive(item.key) && <span style={{ color: '#9aa4b2' }}>‹</span>}
              </NavLink>
            ))}
          </div>
          <div style={{ marginTop: 'auto', padding: '14px 24px 32px' }}>
            <button
              type="button"
              onClick={() => void onSignOut()}
              style={{
                display: 'block',
                padding: '10px 0',
                color: '#e5484d',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.signOut}
            </button>
          </div>
        </div>
      )}

      {!isMobile && (
        <aside
          data-testid="agency-sidebar"
          style={{
            background: '#fff',
            borderInlineStart: '1px solid #e9eef4',
            padding: '15px 11px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            position: 'sticky',
            top: 0,
            height: '100vh',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px 14px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#1668c4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 18,
              }}
            >
              ✈
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px', color: '#0d2640' }}>blujet</span>
          </div>
          {sidebar}
        </aside>
      )}

      <main style={{ padding: isMobile ? 16 : 22, minWidth: 0, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
