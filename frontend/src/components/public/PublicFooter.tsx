import { Link } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCareersEnabled } from '../../hooks/useCareersEnabled';
import { useT } from '../../lib/i18n';

function AppStoreIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 12.5c-.03-2.36 1.93-3.5 2.02-3.55-1.1-1.6-2.8-1.82-3.4-1.85-1.44-.15-2.83.85-3.56.85-.74 0-1.87-.83-3.08-.8-1.58.02-3.05.92-3.86 2.34-1.66 2.88-.42 7.13 1.2 9.46.79 1.13 1.72 2.4 2.95 2.36 1.18-.05 1.63-.76 3.06-.76 1.42 0 1.83.76 3.08.73 1.28-.02 2.08-1.15 2.86-2.29.9-1.3 1.27-2.57 1.29-2.64-.03-.01-2.47-.95-2.5-3.76-.02-2.35 1.92-3.48 2-3.53-1.1-1.62-2.8-1.8-3.4-1.83M14.65 4.87c.66-.8 1.1-1.9.98-3.02-.95.04-2.1.63-2.78 1.43-.61.7-1.15 1.85-1 2.93 1.06.08 2.14-.53 2.8-1.34" />
    </svg>
  );
}

function GooglePlayIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.6 2.3c-.35.2-.6.6-.6 1.1v17.2c0 .5.25.9.6 1.1l9.6-9.7L3.6 2.3zm12.5 8.7 2.5-1.4c.7-.4.7-1.4 0-1.8l-2.6-1.5-2.7 2.8 2.8 2.9zm-2.9-2 2.7-2.8L5.1 1.7l8.1 7.3zm0 2.1-8.1 8.2 10.9-6.3-2.8-1.9z" />
    </svg>
  );
}

function DownloadButtons({ compact }: { compact?: boolean }) {
  const btnStyle = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: compact ? 6 : 7,
    background: '#ffffff14',
    border: '1px solid #ffffff1f',
    color: '#fff',
    padding: compact ? '7px 12px' : '8px 14px',
    borderRadius: 10,
    fontSize: compact ? 11 : '11.5px',
    fontWeight: 700,
    cursor: 'pointer' as const,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : undefined, gap: compact ? 8 : 9, flexWrap: 'wrap', marginBottom: compact ? 14 : 16 }}>
      <span data-testid="footer-app-store" style={btnStyle}>
        <AppStoreIcon size={compact ? 13 : 15} />
        App Store
      </span>
      <span data-testid="footer-google-play" style={btnStyle}>
        <GooglePlayIcon size={compact ? 13 : 15} />
        Google Play
      </span>
    </div>
  );
}

function TrustBadges({ compact }: { compact?: boolean }) {
  const t = useT();
  const size = compact ? 44 : 66;
  const fontSize = compact ? 7 : '8.5px';
  const borderRadius = compact ? 11 : 12;
  const badges = [t('badgeTrust'), t('badgeGuild'), t('badgeSamandehi'), t('badgeIata')];

  return (
    <div
      data-testid="footer-trust-badges"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : undefined,
        gap: compact ? 7 : 10,
        flexWrap: 'wrap',
      }}
    >
      {badges.map((label) => (
        <span
          key={label}
          style={{
            width: size,
            height: size,
            borderRadius,
            background: '#ffffff10',
            border: '1px solid #ffffff14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontSize,
            color: '#9fb2c9',
            lineHeight: compact ? 1.3 : 1.5,
            padding: compact ? 4 : 6,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function FooterLinkColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
        {links.map((link) => (
          <Link key={link.label} to={link.to} style={{ color: '#aebfd4', textDecoration: 'none' }}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MobileAccordionSection({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <details>
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 24px',
          fontSize: '13.5px',
          fontWeight: 700,
          color: '#fff',
          borderBottom: '1px solid #ffffff14',
          listStyle: 'none',
          cursor: 'pointer',
        }}
      >
        {title}
        <span className="footer-chev" style={{ color: '#7d92ad', fontSize: 12, transition: 'transform .2s' }}>
          ⌄
        </span>
      </summary>
      <div style={{ padding: '14px 24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 13, fontSize: 13, borderBottom: '1px solid #ffffff14' }}>
        {links.map((link) => (
          <Link key={link.label} to={link.to} style={{ color: '#aebfd4', textDecoration: 'none' }}>
            {link.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

/** Public-site footer — matches design-reference-v2 shared shell. */
export default function PublicFooter() {
  const t = useT();
  const isMobile = useIsMobile();
  const careersEnabled = useCareersEnabled();

  const serviceLinks = [
    { to: '/results', label: t('footerBookFlight') },
    { to: '/manage-booking', label: t('footerManageBooking') },
    { to: '/flight-status', label: t('footerFlightStatus') },
    { to: '/club', label: t('navLoyalty') },
  ];
  const companyLinks = [
    { to: '/about', label: t('footerAbout') },
    { to: '/contact', label: t('footerContact') },
    { to: '/travel-info', label: t('footerTerms') },
    ...(careersEnabled ? [{ to: '/careers', label: t('footerCareers') }] : []),
  ];
  const supportLinks = [
    { to: '/support', label: t('footerHelpCenter') },
    { to: '/support', label: t('footerFaq') },
  ];

  return (
    <footer style={{ background: '#0d2640', color: '#aebfd4', marginTop: 72 }}>
      <style>{`
        footer details[open] .footer-chev { transform: rotate(180deg); }
        footer summary::-webkit-details-marker { display: none; }
      `}</style>

      {!isMobile && (
        <>
          <div
            style={{
              maxWidth: 1320,
              margin: '0 auto',
              padding: '39px 26px 20px',
              display: 'grid',
              gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
              gap: 33,
            }}
          >
            <div>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, textDecoration: 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
                  ✈
                </div>
                <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>blujet</span>
              </Link>
              <p style={{ fontSize: '13.5px', lineHeight: 1.85, margin: '0 0 20px', maxWidth: 300 }}>{t('footerTagline')}</p>
              <DownloadButtons />
              <TrustBadges />
            </div>
            <FooterLinkColumn title={t('footerColServices')} links={serviceLinks} />
            <FooterLinkColumn title={t('footerColCompany')} links={companyLinks} />
            <FooterLinkColumn title={t('footerColSupport')} links={supportLinks} />
          </div>
          <div style={{ borderTop: '1px solid #ffffff12' }}>
            <div style={{ maxWidth: 1320, margin: '0 auto', padding: '15px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#7d92ad' }}>
              <span>{t('footerCopyright')}</span>
            </div>
          </div>
        </>
      )}

      {isMobile && (
        <>
          <div style={{ padding: '34px 24px 6px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15 }}>
                ✈
              </div>
              <span style={{ fontWeight: 900, fontSize: 17, color: '#fff' }}>blujet</span>
            </div>
            <p style={{ fontSize: '12.5px', lineHeight: 1.8, margin: '0 auto 16px', maxWidth: 270, color: '#aebfd4' }}>{t('footerTagline')}</p>
            <DownloadButtons compact />
            <TrustBadges compact />
          </div>
          <div style={{ marginTop: 22, borderTop: '1px solid #ffffff14' }}>
            <MobileAccordionSection title={t('footerColServices')} links={serviceLinks} />
            <MobileAccordionSection title={t('footerColCompany')} links={companyLinks} />
            <MobileAccordionSection title={t('footerColSupport')} links={supportLinks} />
          </div>
          <div style={{ padding: '16px 24px', textAlign: 'center', fontSize: 11, color: '#7d92ad' }}>{t('footerCopyright')}</div>
        </>
      )}
    </footer>
  );
}
