import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchInbox, fetchProfile } from '../../api/agency-portal';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import AgencyPortalHeader from './AgencyPortalHeader';
import AgencyPortalSidebar from './AgencyPortalSidebar';
import { AGENCY_PAGE_META, agencyNavKeyFromPath } from './agency-nav-config';

const STR: Record<StoredLocale, { newMessage: string }> = {
  fa: { newMessage: 'پیام جدید' },
  en: { newMessage: 'New message' },
  ar: { newMessage: 'رسالة جديدة' },
};

/** Agency portal shell — matches design-reference-v2/پنل آژانس.dc.html layout. */
export default function AgencyPortalShell() {
  const { user, signOut } = useAuth();
  const { locale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(900);
  const activeKey = agencyNavKeyFromPath(location.pathname);
  const pageMeta = AGENCY_PAGE_META[activeKey];
  const t = STR[locale];

  const [agencyName, setAgencyName] = useState(user?.fullName ?? '');
  const [licenseNo, setLicenseNo] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setAgencyName(p.fullName);
        setLicenseNo(p.licenseNo);
      })
      .catch(() => {
        /* profile optional for shell chrome */
      });
    fetchInbox()
      .then((msgs) => setInboxCount(msgs.length))
      .catch(() => setInboxCount(0));
  }, []);

  async function onSignOut() {
    setLogoutBusy(true);
    try {
      await signOut();
      navigate('/agency/login', { replace: true });
    } finally {
      setLogoutBusy(false);
      setLogoutOpen(false);
    }
  }

  const requestLogout = () => setLogoutOpen(true);

  return (
    <div
      dir={locale === 'en' ? 'ltr' : 'rtl'}
      style={{
        fontFamily: locale === 'en' ? 'Inter, sans-serif' : 'var(--font-sans)',
        background: '#f6f8fb',
        color: '#16202e',
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '248px 1fr',
      }}
    >
      <AgencyPortalHeader
        isMobile={isMobile}
        activeKey={activeKey}
        agencyName={agencyName}
        onSignOut={requestLogout}
      />

      {!isMobile && (
        <AgencyPortalSidebar
          activeKey={activeKey}
          agencyName={agencyName}
          licenseNo={licenseNo}
          inboxCount={inboxCount}
          onSignOut={requestLogout}
        />
      )}

      <main style={{ padding: isMobile ? '16px 14px 80px' : '16px 21px 34px', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', margin: 0 }}>{pageMeta.title[locale]}</h1>
            <div style={{ fontSize: 11.5, color: '#7a8696', marginTop: 3 }}>{pageMeta.subtitle[locale]}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link
              to="/agency/inbox"
              data-testid="agency-new-message"
              style={{
                height: 42,
                padding: '0 15px',
                background: '#1668c4',
                color: '#fff',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t.newMessage}
            </Link>
            <Link
              to="/agency/inbox"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#fff',
                border: '1px solid #e6ecf3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5a6678',
                textDecoration: 'none',
              }}
              aria-label={locale === 'fa' ? 'اعلان‌ها' : 'Notifications'}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.5 21a2 2 0 0 1-3 0" />
              </svg>
            </Link>
          </div>
        </div>
        <Outlet />
      </main>

      <LogoutConfirmModal
        open={logoutOpen}
        busy={logoutBusy}
        onCancel={() => {
          if (!logoutBusy) setLogoutOpen(false);
        }}
        onConfirm={() => void onSignOut()}
      />
    </div>
  );
}
