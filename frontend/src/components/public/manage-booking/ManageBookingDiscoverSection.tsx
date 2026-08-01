import { Link } from 'react-router-dom';
import type { StoredLocale } from '../../../hooks/useLocale';
import { formatToman } from '../../../lib/fa-format';

export interface DiscoverDestination {
  code: string;
  city: string;
  category: string;
  meta: string;
  tomanPrice: number;
  grad: string;
  imageUrl?: string | null;
  tag?: string | null;
}

export interface ManageBookingDiscoverSectionProps {
  locale: StoredLocale;
  isMobile: boolean;
  destinations: DiscoverDestination[];
  labels: {
    title: string;
    subtitle: string;
    viewAll: string;
    startsFrom: string;
    toman: string;
    bannerBadge: string;
    bannerTitle: string;
    bannerSub: string;
    bannerBtn: string;
  };
}

export default function ManageBookingDiscoverSection({
  locale,
  isMobile,
  destinations,
  labels,
}: ManageBookingDiscoverSectionProps) {
  const destCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const bannerPad = isMobile ? '24px 22px' : '34px 46px';
  const arrow = locale === 'en' ? '→' : '←';

  return (
    <div style={{ marginTop: 38 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 15,
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16.5, fontWeight: 900, color: '#16202e' }}>{labels.title}</div>
          <div style={{ fontSize: 11.5, color: '#8a96a6', marginTop: 4 }}>{labels.subtitle}</div>
        </div>
        <Link
          to="/destinations"
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: '#1668c4',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {labels.viewAll}
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: destCols, gap: 18 }}>
        {destinations.map((d) => (
          <Link
            key={d.code}
            to={`/results?dest=${d.code}`}
            style={{
              position: 'relative',
              height: 270,
              borderRadius: 18,
              overflow: 'hidden',
              display: 'block',
              textDecoration: 'none',
              background: d.imageUrl ? '#dbe7f6' : d.grad,
              transition: 'transform .2s, box-shadow .2s',
            }}
          >
            {d.imageUrl ? (
              <img
                src={d.imageUrl}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg,rgba(13,38,64,0) 40%,rgba(13,38,64,.82))',
                pointerEvents: 'none',
              }}
            />
            {d.tag ? (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  whiteSpace: 'nowrap',
                  background: '#caa53a',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '4px 11px',
                  borderRadius: 14,
                }}
              >
                {d.tag}
              </span>
            ) : null}
            <span
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                background: 'rgba(255,255,255,.16)',
                backdropFilter: 'blur(4px)',
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 12,
              }}
            >
              {d.category}
            </span>
            <div
              style={{
                position: 'absolute',
                right: 0,
                left: 0,
                bottom: 0,
                padding: '13px 15px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ lineHeight: 1.6 }}>
                <span style={{ display: 'block', color: '#fff', fontSize: 16.5, fontWeight: 900, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                  {d.city}{' '}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#c9dcf3' }} dir="ltr">
                    {d.code}
                  </span>
                </span>
                <span style={{ display: 'block', color: '#c9dcf3', fontSize: 10.5 }}>{d.meta}</span>
              </span>
              <span style={{ textAlign: locale === 'en' ? 'right' : 'left', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                <span style={{ display: 'block', color: '#9fc0e8', fontSize: 9 }}>{labels.startsFrom}</span>
                <span style={{ display: 'block', color: '#fff', fontSize: 14, fontWeight: 900 }}>
                  {formatToman(d.tomanPrice, locale)}{' '}
                  <span style={{ fontSize: 9, fontWeight: 400, color: '#c9dcf3' }}>{labels.toman}</span>
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div
        style={{
          marginTop: 44,
          position: 'relative',
          borderRadius: 24,
          overflow: 'hidden',
          minHeight: 208,
          boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)',
          background: 'linear-gradient(100deg,#0d2640 0%,#1668c4 48%,#5ea3e8 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(100deg,rgba(13,38,102,.9) 0%,rgba(22,104,196,.66) 48%,rgba(22,104,196,.12) 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 26,
            padding: bannerPad,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: '#ffffff22',
                color: '#fff',
                padding: '5px 11px',
                borderRadius: 20,
                fontSize: 11.5,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7ee0b0' }} />
              {labels.bannerBadge}
            </div>
            <h2 style={{ fontSize: 25, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>
              {labels.bannerTitle}
            </h2>
            <p style={{ fontSize: 13.5, color: '#e7eefb', margin: 0, lineHeight: 1.7, maxWidth: 480 }}>{labels.bannerSub}</p>
          </div>
          <Link
            to="/club"
            style={{
              flex: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '11px 25px',
              background: '#fff',
              color: '#1668c4',
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 12px 28px -14px rgba(11,33,56,.5)',
            }}
          >
            <span>{labels.bannerBtn}</span>
            <span style={{ fontSize: 15.5 }}>{arrow}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
