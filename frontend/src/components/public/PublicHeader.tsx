import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchClubPoints, fetchMyProfile } from '../../api/publicSite';
import { localeDigits } from '../../lib/locale-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useT } from '../../lib/i18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  accountTabHref,
  mobileAccountNavItems,
  mobileAccountNavLabel,
} from '../../features/public-site/account/account-nav-items';
import ConfirmActionDialog from '../ConfirmActionDialog';

const TIER_KEY: Record<string, 'tierSilver' | 'tierGold' | 'tierPlatinum'> = {
  SILVER: 'tierSilver',
  GOLD: 'tierGold',
  PLATINUM: 'tierPlatinum',
};

const NOTIFICATIONS: Record<StoredLocale, { icon: string; title: string; body: string; time: string }[]> = {
  fa: [
    { icon: '✈', title: 'یادآوری سفر', body: 'پرواز تهران → دبی شما فرداست. آنلاین چک‌این باز است.', time: '۱ ساعت پیش' },
    { icon: '★', title: 'امتیاز باشگاه', body: '۴۵۰ امتیاز از خرید قبلی به حساب شما اضافه شد.', time: 'دیروز' },
    { icon: '🏷', title: 'کد تخفیف', body: 'کد BLUE20 برای پروازهای داخلی تا پایان هفته فعال است.', time: '۲ روز پیش' },
  ],
  en: [
    { icon: '✈', title: 'Trip reminder', body: 'Your Tehran → Dubai flight is tomorrow. Online check-in is open.', time: '1 hour ago' },
    { icon: '★', title: 'Loyalty points', body: '450 points from your last purchase were added to your account.', time: 'Yesterday' },
    { icon: '🏷', title: 'Discount code', body: 'Code BLUE20 is active for domestic flights until the end of the week.', time: '2 days ago' },
  ],
  ar: [
    { icon: '✈', title: 'تذكير بالرحلة', body: 'رحلتك من طهران إلى دبي غدًا. تسجيل الوصول عبر الإنترنت متاح.', time: 'قبل ساعة' },
    { icon: '★', title: 'نقاط النادي', body: 'تمت إضافة ٤٥٠ نقطة من عمليتك الأخيرة إلى حسابك.', time: 'أمس' },
    { icon: '🏷', title: 'رمز الخصم', body: 'الرمز BLUE20 مفعّل للرحلات الداخلية حتى نهاية الأسبوع.', time: 'قبل يومين' },
  ],
};

const LANG_OPTIONS: { value: StoredLocale; label: string }[] = [
  { value: 'fa', label: 'فارسی' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const LOGOUT_COPY: Record<StoredLocale, { title: string; message: string; confirm: string; cancel: string; busy: string }> = {
  fa: { title: 'خروج از حساب', message: 'آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟', confirm: 'بله، خارج شو', cancel: 'انصراف', busy: 'در حال خروج…' },
  en: { title: 'Sign out', message: 'Are you sure you want to sign out of your account?', confirm: 'Yes, sign out', cancel: 'Cancel', busy: 'Signing out…' },
  ar: { title: 'تسجيل الخروج', message: 'هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟', confirm: 'نعم، تسجيل الخروج', cancel: 'إلغاء', busy: 'جارٍ تسجيل الخروج…' },
};

function GlobeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z" />
    </svg>
  );
}

function UserOutlineIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function UserFilledIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-9 2.69-9 6v2h18v-2c0-3.31-3.67-6-9-6z" />
    </svg>
  );
}

function ChevronIcon({ isRTL }: { isRTL: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9aa4b2"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', transform: isRTL ? 'scaleX(-1)' : undefined }}
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function isFlightsRoute(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/results') ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/payment')
  );
}

/** Sticky public-site header — matches design-reference-v2 shared shell. */
export default function PublicHeader() {
  const { status, user, signOut } = useAuth();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const isMobile = useIsMobile();
  const location = useLocation();
  const isRTL = locale !== 'en';
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginDrawerOpen, setLoginDrawerOpen] = useState(false);
  const [club, setClub] = useState<{ isMember: boolean; level: string | null; balance: number } | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const loggedIn = status === 'authenticated' && user?.role === 'USER';
  const notifications = NOTIFICATIONS[locale];
  const notifCount = notifications.length;
  const notifCountLabel = localeDigits(notifCount, locale);
  const logoutCopy = LOGOUT_COPY[locale];

  function requestSignOut() {
    setMenuOpen(false);
    setMobileMenuOpen(false);
    setLogoutConfirmOpen(true);
  }

  async function confirmSignOut() {
    setLogoutBusy(true);
    try {
      await signOut();
      setLogoutConfirmOpen(false);
    } finally {
      setLogoutBusy(false);
    }
  }

  useEffect(() => {
    if (!loggedIn) {
      setClub(null);
      setProfileIncomplete(false);
      return;
    }
    fetchClubPoints()
      .then(setClub)
      .catch(() => setClub(null));
    fetchMyProfile()
      .then((p) => setProfileIncomplete(p.completionPct < 100))
      .catch(() => setProfileIncomplete(false));
  }, [loggedIn]);

  const navLinks = [
    { to: '/', label: t('navFlights'), active: isFlightsRoute(location.pathname) },
    { to: '/destinations', label: t('navDestinations'), active: location.pathname.startsWith('/destinations') },
    { to: '/club', label: t('navLoyalty'), active: location.pathname.startsWith('/club') },
    { to: '/support', label: t('navSupport'), active: location.pathname.startsWith('/support') },
  ];

  const tierLabel = club?.level ? t(TIER_KEY[club.level] ?? 'tierSilver') : null;
  const logoTextColor = isMobile ? '#fff' : '#16202e';
  const logoSquareBg = isMobile ? '#fff' : '#1668c4';
  const logoIconColor = isMobile ? '#1668c4' : '#fff';

  const langDropdown = (
    <>
      <div onClick={() => setLangOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
      <div
        style={{
          position: 'absolute',
          top: 44,
          [isRTL ? 'left' : 'right']: 0,
          width: 150,
          background: '#fff',
          border: '1px solid #e6eaf0',
          borderRadius: 14,
          boxShadow: '0 20px 50px -16px rgba(13,38,64,.35)',
          zIndex: 130,
          overflow: 'hidden',
          padding: 6,
        }}
      >
        {LANG_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            data-testid={`public-lang-option-${opt.value}`}
            onClick={() => {
              setLocale(opt.value);
              setLangOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '9px 11px',
              borderRadius: 9,
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#16202e',
              cursor: 'pointer',
            }}
          >
            {opt.label}
            {locale === opt.value && <span style={{ color: '#1668c4', fontWeight: 900 }}>✓</span>}
          </div>
        ))}
      </div>
    </>
  );

  const completeProfileBanner = profileIncomplete ? (
    <Link
      to="/account?tab=account-info"
      data-testid="public-complete-profile"
      onClick={() => {
        setMenuOpen(false);
        setMobileMenuOpen(false);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        background: '#fff7ed',
        borderBottom: '1px solid #f6dcbb',
        textDecoration: 'none',
        color: '#9a5b16',
        fontSize: '11.5px',
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#e5484d',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          flex: 'none',
        }}
      >
        !
      </span>
      {t('completeProfileLabel')}
    </Link>
  ) : null;

  const profileWarnDot = (borderColor: string) =>
    profileIncomplete ? (
      <span
        data-testid="public-profile-incomplete-dot"
        style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: '#e5484d',
          border: `1.5px solid ${borderColor}`,
        }}
      />
    ) : null;

  const userMenuItems = (mobileCompact: boolean) => (
    <>
      {completeProfileBanner}
      <Link
        to="/account"
        onClick={() => setMenuOpen(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#16202e', textDecoration: 'none', fontWeight: 600 }}
      >
        <span style={{ color: '#1668c4' }}>
          <UserFilledIcon size={14} />
        </span>
        {t('profileLabel')}
      </Link>
      <Link
        to="/manage-booking"
        onClick={() => setMenuOpen(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#16202e', textDecoration: 'none', fontWeight: 600 }}
      >
        <span style={{ color: '#1668c4' }}>🧳</span>
        {t('tripsLabel')}
      </Link>
      {!mobileCompact && (
        <Link
          to="/manage-booking"
          onClick={() => setMenuOpen(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#16202e', textDecoration: 'none', fontWeight: 600 }}
        >
          <span style={{ color: '#1668c4' }}>↺</span>
          {t('refundLabel')}
        </Link>
      )}
      <Link
        to="/club"
        onClick={() => setMenuOpen(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#16202e', textDecoration: 'none', fontWeight: 600 }}
      >
        <span style={{ color: '#1668c4' }}>★</span>
        {t('navLoyalty')}
      </Link>
      <span
        data-testid="public-logout"
        onClick={requestSignOut}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, fontSize: '11.5px', color: '#e5484d', fontWeight: 600, cursor: 'pointer' }}
      >
        <span>↩</span>
        {t('logoutLabel')}
      </span>
    </>
  );

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div
        style={{
          background: isMobile ? '#1668c4' : '#fff',
          borderBottom: isMobile ? 'none' : '1px solid #e6eaf0',
          boxShadow: '0 2px 12px -8px rgba(13,38,102,.25)',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '0 26px',
            height: isMobile ? 62 : 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {isMobile && (
            <span
              data-testid="public-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen((v) => !v)}
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 18,
                color: '#fff',
                flex: 'none',
              }}
            >
              ☰
            </span>
          )}

          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: logoTextColor }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: logoSquareBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: logoIconColor,
                fontSize: 19,
              }}
            >
              ✈
            </div>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-.5px', color: logoTextColor }}>blujet</span>
          </Link>

          {!isMobile && (
            <nav style={{ display: 'flex', gap: 30, fontSize: '16.5px', color: '#3b4554', fontWeight: 600, height: '100%', alignItems: 'center' }}>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={
                    link.active
                      ? { color: '#1668c4', height: '100%', display: 'flex', alignItems: 'center', borderBottom: '3px solid #1668c4', textDecoration: 'none' }
                      : { textDecoration: 'none', color: '#3b4554' }
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <span
                  data-testid="public-lang-toggle"
                  onClick={() => setLangOpen((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: '#5a6678',
                    border: '1.5px solid #e2e7ee',
                    borderRadius: 20,
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                  }}
                >
                  <GlobeIcon />
                  {locale.toUpperCase()}
                </span>
                {langOpen && langDropdown}
              </div>
              {!loggedIn && (
                <>
                  <Link
                    to="/signin"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '7px 15px',
                      border: '1.5px solid #d5e1f0',
                      color: '#0d2640',
                      borderRadius: 10,
                      fontSize: '12.5px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <UserOutlineIcon />
                    {t('btnLoginSignup')}
                  </Link>
                  <Link
                    to="/club"
                    style={{
                      padding: '8px 18px',
                      background: '#1668c4',
                      color: '#fff',
                      borderRadius: 10,
                      fontSize: '12.5px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('btnJoinClub')}
                  </Link>
                </>
              )}

              {loggedIn && user && (
                <>
                  <div style={{ position: 'relative' }}>
                    <div
                      data-testid="public-notif-toggle"
                      onClick={() => setNotifOpen((v) => !v)}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: '#f3f5f8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#5a6678',
                        fontSize: '16.5px',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      🔔
                      <span
                        style={{
                          position: 'absolute',
                          top: 5,
                          [isRTL ? 'left' : 'right']: 8,
                          minWidth: 16,
                          height: 16,
                          padding: '0 3px',
                          boxSizing: 'border-box',
                          borderRadius: 8,
                          background: '#e5484d',
                          border: '1.5px solid #fff',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                        }}
                      >
                        {notifCountLabel}
                      </span>
                    </div>
                    {notifOpen && (
                      <>
                        <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
                        <div
                          style={{
                            position: 'absolute',
                            top: 52,
                            [isRTL ? 'left' : 'right']: 0,
                            width: 340,
                            background: '#fff',
                            border: '1px solid #e6eaf0',
                            borderRadius: 14,
                            boxShadow: '0 20px 50px -16px rgba(13,38,64,.35)',
                            zIndex: 130,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ padding: '11px 12px', borderBottom: '1px solid #eef1f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0d2640' }}>{t('notificationsTitle')}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1668c4', background: '#eef4fb', padding: '2px 7px', borderRadius: 12 }}>
                              {t('notifNewLabel')}
                            </span>
                          </div>
                          <div style={{ maxHeight: 360, overflow: 'auto' }}>
                            {notifications.map((n) => (
                              <div key={n.title + n.time} style={{ display: 'flex', gap: 9, padding: '11px 12px', borderBottom: '1px solid #f4f6fa' }}>
                                <span style={{ width: 34, height: 34, borderRadius: 10, background: '#f3f5f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15.5px', flex: 'none' }}>
                                  {n.icon}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#16202e' }}>{n.title}</div>
                                  <div style={{ fontSize: 13, color: '#6b7787', marginTop: 2, lineHeight: 1.7 }}>{n.body}</div>
                                  <div style={{ fontSize: '12.5px', color: '#6b7787', marginTop: 4 }}>{n.time}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div
                      data-testid="public-user-menu-toggle"
                      onClick={() => setMenuOpen((v) => !v)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#fff',
                        border: '1px solid #e6eaf0',
                        padding: '4px 10px 4px 7px',
                        borderRadius: 28,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#1668c4,#0d3b66)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13.5px',
                          position: 'relative',
                        }}
                      >
                        <UserFilledIcon />
                        {profileWarnDot('#fff')}
                      </div>
                      <div style={{ lineHeight: 1.35, textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#16202e' }}>{user.fullName}</div>
                        {profileIncomplete ? (
                          <div style={{ fontSize: 10, color: '#e5484d', fontWeight: 700 }}>{t('completeProfileLabel')}</div>
                        ) : (
                          club?.isMember && tierLabel && <div style={{ fontSize: 10, color: '#caa53a', fontWeight: 700 }}>★ {tierLabel}</div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: '#6b7787', marginRight: 2 }}>▼</span>
                    </div>

                    {menuOpen && (
                      <>
                        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
                        <div
                          style={{
                            position: 'absolute',
                            top: 54,
                            [isRTL ? 'left' : 'right']: 0,
                            width: 320,
                            background: '#fff',
                            border: '1px solid #e6eaf0',
                            borderRadius: 14,
                            boxShadow: '0 20px 50px -16px rgba(13,38,64,.35)',
                            zIndex: 130,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ padding: 12, background: 'linear-gradient(135deg,#0d2640,#16406e)', color: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14.5px' }}>
                                <UserFilledIcon size={22} />
                              </div>
                              <div style={{ lineHeight: 1.5 }}>
                                <div style={{ fontSize: '14.5px', fontWeight: 800 }}>{user.fullName}</div>
                                {club?.isMember && tierLabel && <div style={{ fontSize: '10.5px', color: '#caa53a', fontWeight: 700 }}>★ {tierLabel}</div>}
                              </div>
                            </div>
                            {club?.isMember && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '7px 11px' }}>
                                <span style={{ fontSize: 13, color: '#aac4e2' }}>{t('pointsLabel')}</span>
                                <span style={{ fontSize: '13.5px', fontWeight: 800 }}>{localeDigits(club.balance, locale)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: 5 }}>{userMenuItems(false)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{ position: 'relative' }}>
                <span
                  data-testid="public-lang-toggle-mobile"
                  onClick={() => setLangOpen((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    height: 36,
                    padding: '0 9px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,.16)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 800,
                  }}
                >
                  <GlobeIcon size={16} />
                  {locale.toUpperCase()}
                </span>
                {langOpen && langDropdown}
              </div>
              {loggedIn && user ? (
                <div style={{ position: 'relative' }}>
                  <span
                    data-testid="public-user-menu-toggle-mobile"
                    onClick={() => setMenuOpen((v) => !v)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <UserOutlineIcon size={19} />
                    {profileWarnDot('#0d2640')}
                  </span>
                  {menuOpen && (
                    <>
                      <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 120 }} />
                      <div
                        style={{
                          position: 'absolute',
                          top: 46,
                          [isRTL ? 'left' : 'right']: 0,
                          width: 250,
                          background: '#fff',
                          border: '1px solid #e6eaf0',
                          borderRadius: 14,
                          boxShadow: '0 20px 50px -16px rgba(13,38,64,.35)',
                          zIndex: 130,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: 13, background: 'linear-gradient(135deg,#0d2640,#16406e)', color: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                              <UserFilledIcon size={18} />
                            </div>
                            <div style={{ lineHeight: 1.5 }}>
                              <div style={{ fontSize: '13.5px', fontWeight: 800 }}>{user.fullName}</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ padding: 5 }}>{userMenuItems(true)}</div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span
                  data-testid="public-signin-mobile"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLoginDrawerOpen(true);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <UserOutlineIcon size={19} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isMobile && mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 210, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '26px 20px 18px' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#16202e' }}>{t('menuTitle')}</span>
            <span
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: 'absolute',
                [isRTL ? 'left' : 'right']: 20,
                top: 22,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: '#16202e',
                cursor: 'pointer',
              }}
            >
              ×
            </span>
          </div>
          <div style={{ padding: '4px 24px 0', display: 'flex', flexDirection: 'column' }}>
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                padding: '20px 0',
                textDecoration: 'none',
                color: '#16202e',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              {t('navFlights')}
            </Link>
            {loggedIn &&
              mobileAccountNavItems().map((item) => (
                <Link
                  key={item.key}
                  to={accountTabHref(item.key)}
                  data-testid={`public-mobile-account-${item.key}`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    padding: '20px 0',
                    textDecoration: 'none',
                    color: '#16202e',
                    fontSize: 17,
                    fontWeight: 700,
                    borderTop: '1px solid #eef1f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap' }}>{mobileAccountNavLabel(item, locale)}</span>
                  <ChevronIcon isRTL={isRTL} />
                </Link>
              ))}
            {navLinks.slice(1).map((link, i, arr) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '20px 0',
                  textDecoration: 'none',
                  color: '#16202e',
                  fontSize: 17,
                  fontWeight: 700,
                  borderTop: '1px solid #eef1f5',
                  borderBottom: i === arr.length - 1 ? '1px solid #eef1f5' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                {link.label}
                <ChevronIcon isRTL={isRTL} />
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 'auto', padding: '14px 24px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!loggedIn && (
              <span
                data-testid="public-login-drawer-open"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLoginDrawerOpen(true);
                }}
                style={{ textAlign: 'center', padding: 13, border: '1.5px solid #d5e1f0', color: '#0d2640', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('btnLoginOnly')}
              </span>
            )}
            {loggedIn && user && (
              <span
                data-testid="public-logout"
                onClick={requestSignOut}
                style={{ padding: '10px 0', color: '#e5484d', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                ↩ {t('logoutLabel')}
              </span>
            )}
          </div>
        </div>
      )}

      {loginDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(165deg,#0d2640,#1668c4)',
            color: '#fff',
            zIndex: 210,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '26px 20px 18px' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{t('loginDrawerTitle')}</span>
            <span
              data-testid="public-login-drawer-close"
              onClick={() => setLoginDrawerOpen(false)}
              style={{
                position: 'absolute',
                [isRTL ? 'left' : 'right']: 20,
                top: 22,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              ×
            </span>
          </div>
          <div style={{ padding: '34px 28px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#dbe7f7', margin: '8px 0 34px' }}>{t('loginWelcome')}</p>
            <Link
              to="/signin"
              onClick={() => setLoginDrawerOpen(false)}
              style={{
                display: 'block',
                padding: 16,
                background: '#fff',
                color: '#0d2640',
                borderRadius: 30,
                fontSize: '15.5px',
                fontWeight: 800,
                textDecoration: 'none',
                marginBottom: 14,
              }}
            >
              {t('btnLoginOnly')}
            </Link>
            <Link
              to="/club"
              onClick={() => setLoginDrawerOpen(false)}
              style={{
                display: 'block',
                padding: 16,
                background: 'transparent',
                color: '#fff',
                border: '1.5px solid rgba(255,255,255,.6)',
                borderRadius: 30,
                fontSize: '15.5px',
                fontWeight: 800,
                textDecoration: 'none',
                marginBottom: 22,
              }}
            >
              {t('btnJoinClub')}
            </Link>
            <Link
              to="/club"
              onClick={() => setLoginDrawerOpen(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                color: '#fff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {t('discoverMoreLabel')} <span>{isRTL ? '←' : '→'}</span>
            </Link>
          </div>
        </div>
      )}
      <ConfirmActionDialog
        open={logoutConfirmOpen}
        title={logoutCopy.title}
        message={logoutCopy.message}
        confirmLabel={logoutCopy.confirm}
        cancelLabel={logoutCopy.cancel}
        busy={logoutBusy}
        busyLabel={logoutCopy.busy}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmSignOut}
        variant="light"
        testId="public-logout-confirm"
      />
    </header>
  );
}
