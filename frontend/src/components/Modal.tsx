import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Staff panels use the dark chrome by default. Pass "light" only for rare light surfaces. */
  variant?: 'dark' | 'light';
}

export default function Modal({ title, onClose, children, variant = 'dark' }: ModalProps) {
  const dark = variant === 'dark';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14]/70 p-4 backdrop-blur-[3px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${
          dark
            ? 'border-panel-border bg-panel-surface'
            : 'border-border bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between border-b px-5 py-4 ${
            dark ? 'border-panel-border' : 'border-border'
          }`}
        >
          <h3 className={`text-sm font-black ${dark ? 'text-white' : 'text-ink'}`}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className={
              dark
                ? 'text-panel-muted transition hover:text-white'
                : 'text-muted transition hover:text-ink'
            }
          >
            ✕
          </button>
        </div>
        <div className={`p-5 ${dark ? 'text-panel-ink' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
