import { Link } from 'react-router-dom';
import type { StoredLocale } from '../../../hooks/useLocale';

export interface CustomerLoginVisualPanelProps {
  locale: StoredLocale;
  title: string;
  subtitle: string;
}

export default function CustomerLoginVisualPanel({ locale, title, subtitle }: CustomerLoginVisualPanelProps) {
  return (
    <div
      data-testid="signin-visual-panel"
      style={{
        background: 'linear-gradient(160deg,#0d2640,#1668c4)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '30px 28px',
        minHeight: 420,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: -60,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: '#ffffff14',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 130,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: '#ffffff0d',
        }}
      />
      <svg
        viewBox="0 0 400 600"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
        aria-hidden
      >
        <path
          d="M 430 560 C 300 430, 210 320, 60 150"
          fill="none"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2"
          strokeDasharray="2 12"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '11%',
          left: '-10%',
          width: '120%',
          fontSize: 120,
          textAlign: 'center',
          opacity: 0.35,
          filter: 'drop-shadow(0 30px 40px rgba(5,18,36,.45))',
          pointerEvents: 'none',
          animation: 'planeFloat 7s ease-in-out infinite',
        }}
      >
        ✈
      </div>
      <style>{`
        @keyframes planeFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(-1.5deg); }
        }
      `}</style>
      <div style={{ position: 'relative', color: '#fff' }}>
        <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.7, marginBottom: 10 }}>{title}</div>
        <p style={{ fontSize: 12, color: '#d6e4f7', lineHeight: 2.1, margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

export interface CustomerLoginCardHeaderProps {
  locale: StoredLocale;
  showForgot: boolean;
  forgotLabel: string;
  langLabel: string;
  isMobile: boolean;
  onToggleLang: () => void;
}

export function CustomerLoginCardHeader({
  showForgot,
  forgotLabel,
  langLabel,
  isMobile,
  onToggleLang,
}: CustomerLoginCardHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#16202e' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
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
        <span style={{ fontWeight: 900, fontSize: 19 }}>blujet</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          data-testid="signin-lang-toggle"
          onClick={onToggleLang}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            color: '#5a6678',
            border: '1.5px solid #e2e7ee',
            borderRadius: 20,
            padding: '7px 13px',
            fontSize: 12,
            fontWeight: 700,
            background: '#fff',
            fontFamily: 'inherit',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z" />
          </svg>
          {langLabel}
        </button>
        {showForgot && !isMobile && (
          <Link
            to="/forgot-password"
            style={{
              textDecoration: 'none',
              fontSize: 11.5,
              color: '#8a96a6',
              fontWeight: 700,
              border: '1.5px solid #e6ebf2',
              borderRadius: 100,
              padding: '8px 15px',
            }}
          >
            {forgotLabel}
          </Link>
        )}
        {isMobile && (
          <Link
            to="/"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#f3f5f8',
              color: '#5a6678',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              textDecoration: 'none',
            }}
            aria-label="Close"
          >
            ×
          </Link>
        )}
      </div>
    </div>
  );
}
