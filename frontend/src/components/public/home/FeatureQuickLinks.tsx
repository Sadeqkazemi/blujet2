import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StoredLocale } from '../../../hooks/useLocale';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { horizontalScrollStyle, useHorizontalDragScroll } from '../../../hooks/useHorizontalDragScroll';

const ICONS: ReactNode[] = [
  <svg key="seat" width="28" height="28" viewBox="0 0 24 24" fill="#8a96a6">
    <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h7A1.5 1.5 0 0 1 17 3.5V13H7z" />
    <path d="M6 13h12a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0v-.5H6v.5a1 1 0 1 1-2 0v-3a2 2 0 0 1 2-2z" />
    <path d="M8 20.5a1 1 0 1 1 2 0v.5a1 1 0 1 1-2 0zM14 20.5a1 1 0 1 1 2 0v.5a1 1 0 1 1-2 0z" />
  </svg>,
  <svg key="bag" width="28" height="28" viewBox="0 0 24 24" fill="#8a96a6">
    <path d="M10 2.5h4a1.5 1.5 0 0 1 1.5 1.5v1H19a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.5V4A1.5 1.5 0 0 1 10 2.5zm.5 2.5h3V4.5h-3V9zM5 9v8h14V9z" />
    <path d="M11 10.5a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0z" />
  </svg>,
  <svg key="change" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a96a6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12a8 8 0 0 1 13.3-6" />
    <path d="M17.3 3v3.5h-3.5" />
    <path d="M20 12a8 8 0 0 1-13.3 6" />
    <path d="M6.7 21v-3.5h3.5" />
  </svg>,
  <svg key="status" width="28" height="28" viewBox="0 0 24 24" fill="#8a96a6">
    <path d="M13 2.6a1 1 0 0 0-2 0v5.1L4.4 11a1.3 1.3 0 0 0-.7 1.2v1a.6.6 0 0 0 .8.6L11 12v4.6l-2.1 1.5a.6.6 0 0 0-.25.5v1a.5.5 0 0 0 .65.48L12 19l2.7 1.1a.5.5 0 0 0 .65-.48v-1a.6.6 0 0 0-.25-.5L13 16.6V12l6.5 1.8a.6.6 0 0 0 .8-.6v-1a1.3 1.3 0 0 0-.7-1.2L13 7.7z" />
  </svg>,
];

interface FeatureQuickLinksProps {
  locale: StoredLocale;
  labels: string[];
  hrefs: string[];
}

/** design-reference-v2 homepage features row with SVG icons. */
export default function FeatureQuickLinks({ locale, labels, hrefs }: FeatureQuickLinksProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { containerRef, dragScrollProps } = useHorizontalDragScroll();

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '20px 26px 0' : '49px 26px 23px' }}>
      <div
        ref={isMobile ? containerRef : undefined}
        className={isMobile ? 'hscroll' : undefined}
        {...(isMobile ? dragScrollProps : {})}
        style={{
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)',
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          ...(isMobile ? horizontalScrollStyle : { overflow: 'hidden' }),
        }}
      >
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            data-testid={`feature-link-${i}`}
            onClick={() => navigate(hrefs[i])}
            style={{
              textAlign: 'center',
              border: 'none',
              borderLeft: i > 0 && !isMobile ? '1px solid #eef2f7' : undefined,
              flex: isMobile ? '0 0 calc(50% - 6.5px)' : undefined,
              touchAction: isMobile ? 'pan-x' : undefined,
              padding: '22px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              background: '#fff',
              fontFamily: 'inherit',
            }}
          >
            {ICONS[i]}
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#3b4554',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {label}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
