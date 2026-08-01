import type { CSSProperties, ReactNode } from 'react';
import { STAFF_PANEL } from '../lib/staff-panel-theme';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Use staff panel dark card styling (management panels). */
  dark?: boolean;
}

export default function Modal({ title, onClose, children, dark }: ModalProps) {
  const panelStyle: CSSProperties | undefined = dark
    ? {
        width: '100%',
        maxWidth: 448,
        borderRadius: 16,
        border: `1px solid ${STAFF_PANEL.cardBorder}`,
        background: STAFF_PANEL.cardBg,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14]/60 p-4 backdrop-blur-[3px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className={dark ? undefined : 'w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl'}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={dark ? undefined : 'flex items-center justify-between border-b border-border px-5 py-4'}
          style={
            dark
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${STAFF_PANEL.sidebarBorder}`,
                  padding: '16px 20px',
                }
              : undefined
          }
        >
          <h3
            className={dark ? undefined : 'text-sm font-black text-ink'}
            style={dark ? { fontSize: 13, fontWeight: 900, color: '#fff', margin: 0 } : undefined}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className={dark ? undefined : 'text-muted transition hover:text-ink'}
            style={
              dark
                ? { background: 'none', border: 'none', color: STAFF_PANEL.textMuted, cursor: 'pointer', fontFamily: 'inherit' }
                : undefined
            }
          >
            ✕
          </button>
        </div>
        <div className={dark ? undefined : 'p-5'} style={dark ? { padding: 20 } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}
