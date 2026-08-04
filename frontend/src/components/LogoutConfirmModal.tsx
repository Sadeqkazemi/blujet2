import { useEffect, useId, useRef } from 'react';

type LogoutConfirmModalProps = {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Shared logout confirmation — matches design screenshots
 * (logout-confirm.png / logout-test.png). Used by staff PanelShell and
 * agency portal so every authenticated surface has the same exit UX. */
export default function LogoutConfirmModal({
  open,
  busy = false,
  onCancel,
  onConfirm,
}: LogoutConfirmModalProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(7,11,20,.72)] p-4 backdrop-blur-[3px]"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="logout-confirm-modal"
        className="w-full max-w-[360px] rounded-2xl bg-white p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fee2e2] text-[#ef4444]">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        </div>
        <h2 id={titleId} className="mb-2 text-[17px] font-black text-[#0f172a]">
          خروج از حساب کاربری
        </h2>
        <p className="mb-6 text-[13px] leading-relaxed text-[#64748b]">
          آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟
        </p>
        <div className="flex gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            data-testid="logout-cancel"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-3 text-[13px] font-bold text-[#0f172a] transition hover:bg-[#f8fafc] disabled:opacity-60"
          >
            انصراف
          </button>
          <button
            type="button"
            data-testid="logout-confirm"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#ef4444] px-3 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#dc2626] disabled:opacity-60"
          >
            {busy ? 'در حال خروج…' : 'بله، خارج شو'}
          </button>
        </div>
      </div>
    </div>
  );
}
