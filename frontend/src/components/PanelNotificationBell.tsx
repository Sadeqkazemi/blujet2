import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { faDigits } from '../lib/fa-format';

export interface PanelNotificationItem {
  key: string;
  title: string;
  sublabel?: string;
  to: string;
  tone: 'danger' | 'purple';
}

const TONE_DOT: Record<PanelNotificationItem['tone'], string> = {
  danger: 'bg-danger',
  purple: 'bg-[#a855f7]',
};

/** Every item here comes from data the shell already fetches for the nav
 * badges (cartable tasks, refund queue, staff/referral counts) — there is
 * no separate notifications table, this is a read-only view over the same
 * live sources, so the bell can never show something the sidebar badges
 * don't already back with a real count. */
export default function PanelNotificationBell({ items }: { items: PanelNotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="اعلان‌ها"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-panel-ink transition hover:bg-white/10"
      >
        <span aria-hidden>🔔</span>
        {items.length > 0 && (
          <span
            data-testid="notification-bell-count"
            className="font-num absolute -left-1.5 -top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-extrabold text-white"
          >
            {faDigits(items.length)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-white/10 bg-panel-surface p-2 shadow-lg">
          <div className="px-2 py-1.5 text-xs font-bold text-panel-ink">اعلان‌ها</div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-panel-muted">اعلان جدیدی ندارید.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(item.to);
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start text-xs transition hover:bg-white/5"
                  >
                    <span className={`mt-1 h-2 w-2 flex-none rounded-full ${TONE_DOT[item.tone]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-panel-ink">{item.title}</span>
                      {item.sublabel && (
                        <span className="block truncate text-[10px] text-panel-muted">{item.sublabel}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
