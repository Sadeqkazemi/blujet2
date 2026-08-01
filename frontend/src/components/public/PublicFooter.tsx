import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useT } from '../../lib/i18n';
import { useCareersEnabled } from '../../hooks/useCareersEnabled';
import { useSocialLinks } from '../../hooks/useSocialLinks';
import { SocialIcon, socialBrandColor } from './SocialIcon';

/** Mobile footer accordion section (design-reference-v2: details/summary). */
function AccordionSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 24px',
          fontSize: '13.5px',
          fontWeight: 700,
          color: '#fff',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #ffffff14',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {title}
        <span style={{ color: '#7d92ad', fontSize: 12, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      {open && (
        <div style={{ padding: '14px 24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 13, fontSize: 13, borderBottom: '1px solid #ffffff14' }}>
          {children}
        </div>
      )}
    </div>
  );
}

const FOOT_LINK: React.CSSProperties = { color: '#aebfd4', textDecoration: 'none' };

/** Public-site footer — matches design-reference-v2/صفحه اصلی.dc.html:
 * fa/en/ar translated + mobile accordion layout. */
export default function PublicFooter() {
  const t = useT();
  const isMobile = useIsMobile();
  const careersEnabled = useCareersEnabled();
  const socialLinks = useSocialLinks();

  if (isMobile) {
    return (
      <footer style={{ background: '#0d2640', color: '#aebfd4', marginTop: 72 }}>
        <div style={{ padding: '34px 24px 6px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15 }}>
              ✈
            </div>
            <span style={{ fontWeight: 900, fontSize: 17, color: '#fff' }}>blujet</span>
          </div>
          <p style={{ fontSize: '12.5px', lineHeight: 1.8, margin: '0 auto 16px', maxWidth: 270, color: '#aebfd4' }}>{t('footerTagline')}</p>
          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.name}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: '#ffffff14',
                    color: socialBrandColor(link.id),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                  }}
                >
                  <SocialIcon id={link.id} size={18} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, borderTop: '1px solid #ffffff14' }}>
          <AccordionSection title={t('footerColServices')}>
            <Link to="/results" style={FOOT_LINK}>{t('footerBookFlight')}</Link>
            <Link to="/manage-booking" style={FOOT_LINK}>{t('footerManageBooking')}</Link>
            <Link to="/flight-status" style={FOOT_LINK}>{t('footerFlightStatus')}</Link>
            <Link to="/club" style={FOOT_LINK}>{t('navLoyalty')}</Link>
            <Link to="/manage-booking" style={FOOT_LINK}>{t('footerRefund')}</Link>
          </AccordionSection>
          <AccordionSection title={t('footerColCompany')}>
            <Link to="/about" style={FOOT_LINK}>{t('footerAbout')}</Link>
            <Link to="/contact" style={FOOT_LINK}>{t('footerContact')}</Link>
            <Link to="/travel-info" style={FOOT_LINK}>{t('footerTerms')}</Link>
            <Link to="/blog" style={FOOT_LINK}>{t('footerBlog')}</Link>
            {careersEnabled && <Link to="/careers" style={FOOT_LINK}>{t('footerCareers')}</Link>}
          </AccordionSection>
          <AccordionSection title={t('footerColSupport')}>
            <Link to="/support" style={FOOT_LINK}>{t('footerHelpCenter')}</Link>
            <Link to="/support" style={FOOT_LINK}>{t('footerFaq')}</Link>
            <span dir="ltr">{t('footerPhone')}</span>
          </AccordionSection>
        </div>

        <div style={{ padding: '16px 24px', textAlign: 'center', fontSize: 11, color: '#7d92ad' }}>{t('footerCopyright')}</div>
      </footer>
    );
  }

  return (
    <footer style={{ background: '#0d2640', color: '#aebfd4', marginTop: 72 }}>
      <div
        style={{
          maxWidth: 1180,
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
          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.name}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: '#ffffff14',
                    color: socialBrandColor(link.id),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                  }}
                >
                  <SocialIcon id={link.id} size={18} />
                </a>
              ))}
            </div>
          )}
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
            <Link to="/blog" style={{ color: '#aebfd4', textDecoration: 'none' }}>
              {t('footerBlog')}
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
