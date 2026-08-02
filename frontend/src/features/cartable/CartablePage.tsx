import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  approveCartableTask,
  fetchCartable,
  fetchChairPermission,
  fetchStaffDirectory,
  rejectCartableTask,
  requestChairPermission,
  transferCartableTask,
} from '../../api/cartable';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import ComposeMessageModal from './ComposeMessageModal';
import PanelAlert from '../panel/PanelAlert';
import PanelModal from '../panel/PanelModal';
import {
  panelBtnGhost,
  panelBtnPrimary,
  panelCard,
  panelInput,
  panelMuted,
  panelMuted2,
  panelText,
  panelTitle,
} from '../panel/panel-theme';
import type {
  CartableCategory,
  CartableListResult,
  CartableTask,
  ChairPermission,
  StaffDirectoryEntry,
} from '../../types/cartable';

const CATEGORY_CARDS: {
  key: CartableCategory;
  label: string;
  iconBg: string;
  iconColor: string;
  icon: string;
}[] = [
  {
    key: 'ADMIN',
    label: 'درخواست اداری',
    iconBg: 'rgba(59,130,246,.16)',
    iconColor: '#3b82f6',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  },
  {
    key: 'AGENCY',
    label: 'همکاری آژانس',
    iconBg: 'rgba(245,158,11,.16)',
    iconColor: '#f59e0b',
    icon: '<path d="M3 21h18"/><path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16"/><path d="M19 21V10a1 1 0 0 0-1-1h-3"/>',
  },
  {
    key: 'MANAGER',
    label: 'درخواست مدیران',
    iconBg: 'rgba(168,85,247,.16)',
    iconColor: '#a855f7',
    icon: '<path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  },
];

const CATEGORY_BADGES: Record<CartableCategory, { label: string; className: string }> = {
  ADMIN: { label: 'اداری', className: 'bg-[rgba(59,130,246,.16)] text-[#60a5fa]' },
  AGENCY: { label: 'همکاری آژانس', className: 'bg-[rgba(245,158,11,.16)] text-[#fbbf24]' },
  MANAGER: { label: 'درخواست مدیر', className: 'bg-[rgba(168,85,247,.16)] text-[#c084fc]' },
};

function relativeFa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return 'همین الان';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${faDigits(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  return formatJalaliDateTime(iso);
}

export default function CartablePage() {
  const { user } = useAuth();
  const hasChairGate = user?.role === 'FINANCE_MANAGER' || user?.role === 'COMMERCIAL_MANAGER';

  const [result, setResult] = useState<CartableListResult | null>(null);
  const [category, setCategory] = useState<CartableCategory | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [chairPerm, setChairPerm] = useState<ChairPermission | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const [reviewTask, setReviewTask] = useState<CartableTask | null>(null);
  const [note, setNote] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchCartable({
        category: category ?? undefined,
        date: filterDate ?? undefined,
      });
      setResult(data);
      if (hasChairGate) setChairPerm(await fetchChairPermission());
    } catch {
      setError('خطا در دریافت کارتابل.');
    } finally {
      setLoading(false);
    }
  }, [category, filterDate, hasChairGate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchStaffDirectory()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  function openReview(task: CartableTask) {
    setReviewTask(task);
    setNote('');
    setTransferTo('');
    setReviewError(null);
  }

  async function onDecide(action: 'approve' | 'reject' | 'transfer') {
    if (!reviewTask) return;
    if (!note.trim()) {
      setReviewError('برای ثبت تصمیم، درج نظر مدیر الزامی است.');
      return;
    }
    try {
      if (action === 'approve') {
        await approveCartableTask(reviewTask.id, note.trim());
        setNotice('درخواست تأیید شد ✓');
      } else if (action === 'reject') {
        await rejectCartableTask(reviewTask.id, note.trim());
        setNotice('درخواست رد شد');
      } else {
        const target = staff.find((s) => s.id === transferTo);
        await transferCartableTask(reviewTask.id, transferTo, note.trim());
        setNotice(`درخواست به ${target?.fullName ?? 'مدیر مقصد'} منتقل شد`);
      }
      setReviewTask(null);
      await load();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'خطا در ثبت تصمیم.');
    }
  }

  async function onRequestChairPerm() {
    try {
      setChairPerm(await requestChairPermission());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال درخواست.');
    }
  }

  const tasks = result?.tasks ?? [];
  const badge = reviewTask ? CATEGORY_BADGES[reviewTask.category] : null;

  return (
    <div>
      {error && <PanelAlert>{error}</PanelAlert>}
      {notice && <PanelAlert tone="success">{notice}</PanelAlert>}

      {hasChairGate && (
        <section className="mb-6 rounded-[14px] border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.08)] p-5">
          <h2 className="text-sm font-bold text-[#fbbf24]">ارجاع و ارسال گزارش به رئیس هیئت مدیره</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#fbbf24]/80">
            دسترسی کامل کارتابل و ارجاعات مخصوص مدیر ارشد و مدیر عامل است؛ ارسال گزارش به رئیس هیئت مدیره نیازمند مجوز
            ایشان است.
          </p>
          <div className="mt-3">
            {chairPerm?.status === 'APPROVED' ? (
              <span className="rounded-full bg-[rgba(52,211,153,.16)] px-3 py-1.5 text-xs font-bold text-[#34d399]">
                مجوز تأیید شد ✓
              </span>
            ) : chairPerm?.status === 'PENDING' ? (
              <span className="rounded-full bg-[rgba(245,158,11,.16)] px-3 py-1.5 text-xs font-bold text-[#f59e0b]">
                درخواست ارسال شد — در انتظار تأیید
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void onRequestChairPerm()}
                className="rounded-lg bg-[#f59e0b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#d97706]"
              >
                درخواست مجوز از رئیس هیئت مدیره
              </button>
            )}
          </div>
        </section>
      )}

      <div className="mb-6 grid grid-cols-1 gap-[13px] sm:grid-cols-3">
        {CATEGORY_CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(category === c.key ? null : c.key)}
            className={`${panelCard} flex items-center justify-between p-4 text-right transition ${
              category === c.key ? 'border-panel-accent bg-[rgba(59,130,246,.08)]' : 'hover:border-panel-accent/40'
            }`}
          >
            <div>
              <div className="font-num text-[22px] font-black text-white">{faDigits(result?.counts[c.key] ?? 0)}</div>
              <div className={`mt-1 text-[11.5px] ${panelMuted}`}>{c.label}</div>
            </div>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-[11px]"
              style={{ background: c.iconBg, color: c.iconColor }}
              dangerouslySetInnerHTML={{
                __html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${c.icon}</svg>`,
              }}
            />
          </button>
        ))}
      </div>

      <div className={`${panelCard} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border px-[15px] py-3">
          <div className="flex items-center gap-2">
            <h3 className={`m-0 text-[14.5px] ${panelTitle}`}>کارتابل من</h3>
            <span className="rounded-full bg-[#f87171] px-2 py-0.5 text-[10px] font-extrabold text-white">
              {faDigits(result?.totalOpen ?? 0)} مورد
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JalaliDatePicker label="" value={filterDate} onChange={setFilterDate} />
            {filterDate && (
              <button type="button" onClick={() => setFilterDate(null)} className={panelBtnGhost}>
                حذف تاریخ
              </button>
            )}
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className={`flex items-center gap-1.5 ${panelBtnPrimary}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              ایجاد پیام
            </button>
          </div>
        </div>

        <div className="px-2 py-2">
          {loading ? (
            <p className={`py-10 text-center text-sm ${panelMuted}`}>در حال بارگذاری…</p>
          ) : tasks.length === 0 ? (
            <p className={`py-10 text-center text-sm ${panelMuted}`}>
              {category ? 'موردی با این فیلتر یافت نشد ✓' : 'کارتابل خالی است ✓'}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {tasks.map((t) => {
                const cat = CATEGORY_BADGES[t.category];
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center gap-3 border-b border-[#1b2536] px-[11px] py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[12.5px] font-bold ${panelText}`}>{t.title}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cat.className}`}>
                          {cat.label}
                        </span>
                      </div>
                      <div className={`mt-1 text-[11px] ${panelMuted}`}>
                        ارسال از: {t.senderLabelFa ?? t.sender?.fullName ?? '—'}
                      </div>
                    </div>
                    <span className={`text-[10.5px] ${panelMuted2}`}>{relativeFa(t.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => openReview(t)}
                      className={`flex items-center gap-1.5 ${panelBtnPrimary}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4-4" />
                      </svg>
                      بررسی
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {composeOpen && (
        <ComposeMessageModal
          onClose={() => setComposeOpen(false)}
          onSent={(label) => setNotice(`پیام به «${label}» ارسال شد`)}
        />
      )}

      {reviewTask && badge && (
        <PanelModal
          title="بررسی درخواست"
          onClose={() => setReviewTask(null)}
          wide
          footer={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onDecide('approve')}
                className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-[#16a34a] text-[12.5px] font-extrabold text-white transition hover:brightness-110"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                تأیید
              </button>
              <button
                type="button"
                onClick={() => void onDecide('reject')}
                className="flex h-[46px] items-center justify-center gap-1.5 rounded-[11px] border border-[rgba(248,113,113,.4)] bg-[rgba(248,113,113,.12)] px-5 text-[12.5px] font-extrabold text-[#f87171]"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void onDecide('transfer')}
                disabled={!transferTo}
                className={`flex h-[46px] items-center justify-center gap-1.5 px-5 disabled:opacity-50 ${panelBtnGhost}`}
              >
                انتقال
              </button>
            </div>
          }
        >
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${badge.className}`}>{badge.label}</span>
          </div>
          <div className="mb-1 text-[15px] font-extrabold text-white">{reviewTask.title}</div>
          <p className={`mb-4 text-[11.5px] leading-relaxed ${panelMuted}`}>{reviewTask.description}</p>

          <div className="mb-4 flex items-center gap-3 rounded-[11px] bg-[#0f1726] px-[13px] py-[11px]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#28344c] text-[11px] font-extrabold text-white">
              {(reviewTask.sender?.fullName ?? '؟').slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1 leading-snug">
              <div className={`text-[10px] ${panelMuted}`}>ارسال‌کننده‌ی درخواست</div>
              <div className={`text-xs font-bold ${panelText}`}>
                {reviewTask.senderLabelFa ?? reviewTask.sender?.fullName ?? '—'}
              </div>
            </div>
            <span className={`text-[10.5px] ${panelMuted2}`}>{relativeFa(reviewTask.createdAt)}</span>
          </div>

          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`} htmlFor="review-note">
            نظر مدیر <span className="text-[#f87171]">*</span>
          </label>
          <textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="توضیح یا دلیل تصمیم خود را بنویسید…"
            rows={3}
            className={`mb-3 min-h-[90px] w-full resize-y px-[11px] py-2.5 ${panelInput}`}
          />

          <label className={`mb-2 block text-[11.5px] font-bold ${panelText}`} htmlFor="review-transfer">
            انتقال به مدیر دیگر (اختیاری)
          </label>
          <select
            id="review-transfer"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className={`h-[46px] w-full cursor-pointer px-[11px] ${panelInput}`}
          >
            <option value="">— انتخاب مدیر —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.roleLabelFa}
              </option>
            ))}
          </select>

          {reviewError && (
            <p role="alert" className="mt-3 text-[11.5px] font-semibold text-[#f87171]">
              {reviewError}
            </p>
          )}
        </PanelModal>
      )}
    </div>
  );
}
