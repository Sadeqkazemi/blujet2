import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'light' | 'dark';
}

export default function Modal({ title, onClose, children, variant = 'light' }: ModalProps) {
  const dark = variant === 'dark';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14]/72 p-4 backdrop-blur-[3px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${
          dark ? 'border-[#2a3550] bg-[#141d2e]' : 'border-border bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between px-5 py-4 ${
            dark ? 'border-b border-[#1f2a3d]' : 'border-b border-border'
          }`}
        >
          <h3 className={`text-sm font-black ${dark ? 'text-white' : 'text-ink'}`}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className={dark ? 'text-[#6b7b94] transition hover:text-white' : 'text-muted transition hover:text-ink'}
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
