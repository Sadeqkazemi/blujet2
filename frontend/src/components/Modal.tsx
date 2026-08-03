import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'dark' | 'light';
}

export default function Modal({ title, onClose, children, variant = 'light' }: ModalProps) {
  const isDark = variant === 'dark';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14]/60 p-4 backdrop-blur-[3px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${
          isDark ? 'border-[#2a3550] bg-[#141d2e]' : 'border-border bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between px-5 py-4 ${
            isDark ? 'border-b border-[#1f2a3d]' : 'border-b border-border'
          }`}
        >
          <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-ink'}`}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="بستن"
            className={`transition ${isDark ? 'text-[#9fb0c7] hover:text-white' : 'text-muted hover:text-ink'}`}
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
