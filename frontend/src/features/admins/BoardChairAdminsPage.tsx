import { useState } from 'react';
import { panelCard, panelMuted, panelTitle } from '../panel/panel-theme';

/**
 * پنل رئیس هیئت مدیره — تب «مدیران» (design-reference-v2).
 * Empty shell only: mock manager rows from the design bundle are intentionally
 * omitted so product can wire real admin CRUD in a follow-up phase.
 */
export default function BoardChairAdminsPage() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className={`${panelCard} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-panel-border px-[15px] py-3">
          <h3 className={`m-0 text-[14.5px] ${panelTitle}`}>مدیران</h3>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] bg-panel-accent px-[11px] py-[7px] text-[11.5px] font-bold text-white transition hover:brightness-110"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            افزودن مدیر / ادمین
          </button>
        </div>

        <div className="px-2 py-[5px]">
          <div
            className={`grid grid-cols-[2fr_1.6fr_1.2fr_1fr_0.5fr] border-b border-panel-border px-[11px] py-2.5 text-[11px] font-bold ${panelMuted}`}
          >
            <span>نام</span>
            <span>نقش</span>
            <span>آخرین ورود</span>
            <span>وضعیت</span>
            <span />
          </div>
          <p className={`py-[22px] text-center text-[11.5px] ${panelMuted}`}>
            هنوز اطلاعاتی وارد نشده است.
          </p>
        </div>
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onClick={() => setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="add-admin-title"
            className={`${panelCard} w-full max-w-md p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-admin-title" className={`mb-2 text-sm ${panelTitle}`}>
              افزودن مدیر / ادمین
            </h2>
            <p className={`mb-4 text-[11.5px] leading-relaxed ${panelMuted}`}>
              این بخش در فاز بعدی پیاده‌سازی می‌شود. فعلاً فهرست مدیران خالی است.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="w-full rounded-[11px] bg-panel-accent py-2.5 text-xs font-extrabold text-white"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
