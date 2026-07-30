import { Link } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useT } from '../../lib/i18n';
import { useCareersEnabled } from '../../hooks/useCareersEnabled';

/** Public-site footer — matches design-reference-v2/صفحه اصلی.dc.html:
 * fa/en/ar translated + a single-column mobile layout. */
export default function PublicFooter() {
  const t = useT();
  const isMobile = useIsMobile();
  const careersEnabled = useCareersEnabled();

  return (
    <footer style={{ background: '#0d2640', color: '#aebfd4', marginTop: 72 }}>
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '39px 26px 20px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr 1fr 1fr',
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
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>{t('footerColServices')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
            <Link to="/results" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerBookFlight')}
            </Link>
            <Link to="/manage-booking" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerManageBooking')}
            </Link>
            <Link to="/flight-status" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerFlightStatus')}
            </Link>
            <Link to="/club" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('navLoyalty')}
            </Link>
            <Link to="/manage-booking" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerRefund')}
            </Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>{t('footerColCompany')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
            <Link to="/about" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerAbout')}
            </Link>
            <Link to="/contact" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerContact')}
            </Link>
            <Link to="/travel-info" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerTerms')}
            </Link>
            {careersEnabled && (
              <Link to="/careers" style={{ color: '#aebfd4', textDecoration: 'none' }}>
                {t('footerCareers')}
              </Link>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>{t('footerColSupport')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: '13.5px' }}>
            <Link to="/support" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerHelpCenter')}
            </Link>
            <Link to="/support" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerFaq')}
            </Link>
            <span dir="ltr" style={{ textAlign: 'right' }}>
              {t('footerPhone')}
            </span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #ffffff12' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '15px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#7d92ad' }}>
          <span>{t('footerCopyright')}</span>
        </div>
      </div>
    </footer>
  );
}
