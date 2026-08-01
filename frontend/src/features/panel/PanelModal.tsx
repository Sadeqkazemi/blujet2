import type { ReactNode } from 'react';
import { panelCard, panelMuted, panelTitle } from './panel-theme';

interface PanelModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Dark-themed modal for management panel pages. */
export default function PanelModal({ title, onClose, children, wide }: PanelModalProps) {
  return (
    <div
      className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="panel-modal-title"
        className={`${panelCard} w-full ${wide ? 'max-w-lg' : 'max-w-md'} p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="panel-modal-title" className={`m-0 text-sm ${panelTitle}`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className={`text-lg leading-none ${panelMuted} transition hover:text-white`}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
