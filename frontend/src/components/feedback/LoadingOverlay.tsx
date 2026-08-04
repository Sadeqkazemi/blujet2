import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type LoadingApi = {
  visible: boolean;
  message: string;
  show: (message?: string) => void;
  hide: () => void;
};

const LoadingContext = createContext<LoadingApi | null>(null);

const DEFAULT_MESSAGE = 'لطفاً صبر کنید…';

/** Full-screen plane spinner overlay — matches design «نوتیف و لودینگ». */
export function LoadingProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  const show = useCallback((nextMessage = DEFAULT_MESSAGE) => {
    setMessage(nextMessage);
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  const api = useMemo(() => ({ visible, message, show, hide }), [visible, message, show, hide]);

  return (
    <LoadingContext.Provider value={api}>
      {children}
      {visible && <FullscreenLoading message={message} />}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

export function useOptionalLoading(): LoadingApi | null {
  return useContext(LoadingContext);
}

export function FullscreenLoading({ message }: { message: string }) {
  return (
    <div
      data-testid="fullscreen-loading"
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: 'rgba(13,38,102,.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="96" height="96" viewBox="0 0 96 96" style={{ position: 'absolute', inset: 0 }} aria-hidden>
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="5" />
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke="#f5a623"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="60 190"
            style={{ animation: 'blujetSpin 1.1s linear infinite', transformOrigin: '48px 48px' }}
          />
        </svg>
        <div style={{ fontSize: 30, animation: 'blujetFly 1.6s ease-in-out infinite' }} aria-hidden>
          ✈
        </div>
      </div>
      <div style={{ color: '#fff', fontSize: 14.5, fontWeight: 800 }}>{message}</div>
      <div style={{ display: 'flex', gap: 6 }} aria-hidden>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.9, animation: 'blujetSpin 1s linear infinite' }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.6 }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.35 }} />
      </div>
      <style>{`
        @keyframes blujetSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blujetFly {
          0% { transform: translateX(-14px) translateY(2px) rotate(-6deg); }
          50% { transform: translateX(14px) translateY(-2px) rotate(6deg); }
          100% { transform: translateX(-14px) translateY(2px) rotate(-6deg); }
        }
      `}</style>
    </div>
  );
}

/** Inline row spinner used inside cards/forms. */
export function InlineLoading({ text }: { text: string }) {
  return (
    <div
      data-testid="inline-loading"
      role="status"
      aria-busy="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: '#f6f8fb',
        borderRadius: 12,
      }}
    >
      <div style={{ position: 'relative', width: 26, height: 26, flex: 'none' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid #dce4ef',
            borderTopColor: '#1668c4',
            animation: 'blujetSpin 0.85s linear infinite',
          }}
        />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3c4c63' }}>{text}</span>
      <style>{`@keyframes blujetSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
