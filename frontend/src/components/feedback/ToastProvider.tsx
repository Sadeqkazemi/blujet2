import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AUTH_TOAST,
  TOAST_DURATION_MS,
  TOAST_STYLES,
  type ToastItem,
  type ToastType,
} from './toast-types';

type ToastApi = {
  push: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const uid = useRef(0);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++uid.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      warning: (message) => push('warning', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        data-testid="toast-stack"
        aria-live="polite"
        aria-relevant="additions"
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9600,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 10,
          alignItems: 'center',
          width: 'min(92vw, 420px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              data-testid={`toast-${t.type}`}
              role={t.type === 'error' ? 'alert' : 'status'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: style.bg,
                color: style.fg,
                padding: '13px 18px',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 700,
                boxShadow: '0 12px 30px -12px rgba(13,38,102,.45)',
                animation: 'blujetToastIn .25s ease-out',
                width: '100%',
                pointerEvents: 'auto',
                fontFamily: 'inherit',
              }}
            >
              <span
                style={{
                  flex: 'none',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: style.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: style.fg,
                }}
              >
                {style.icon}
              </span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes blujetToastIn {
          from { opacity: 0; transform: translateY(14px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/** Optional toast access for providers that may mount outside ToastProvider in tests. */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext);
}

export { AUTH_TOAST };
