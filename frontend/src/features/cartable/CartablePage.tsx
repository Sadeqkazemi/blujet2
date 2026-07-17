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
import Modal from '../../components/Modal';
import ComposeMessageModal from './ComposeMessageModal';
import type {
  CartableCategory,
  CartableListResult,
  CartableTask,
  ChairPermission,
  StaffDirectoryEntry,
} from '../../types/cartable';

const CATEGORY_CARDS: { key: CartableCategory; label: string }[] = [
  { key: 'ADMIN', label: 'درخواست اداری' },
  { key: 'AGENCY', label: 'همکاری آژانس' },
  { key: 'MANAGER', label: 'درخواست مدیران' },
];

const CATEGORY_BADGES: Record<CartableCategory, string> = {
  ADMIN: 'اداری',
  AGENCY: 'همکاری آژانس',
  MANAGER: 'درخواست مدیر',
};

export default function CartablePage() {
  const { user } = useAuth();
  const hasChairGate = user?.role === 'FINANCE_MANAGER' || user?.role === 'COMMERCIAL_MANAGER';

  const [result, setResult] = useState<CartableListResult | null>(null);
  const [category, setCategory] = useState<CartableCategory | null>(null);
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
      const data = await fetchCartable({ category: category ?? undefined });
      setResult(data);
      if (hasChairGate) setChairPerm(await fetchChairPermission());
    } catch {
      setError('خطا در دریافت کارتابل.');
    } finally {
      setLoading(false);
    }
  }, [category, hasChairGate]);

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

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">کارتابل من</h1>
          <p className="mt-1 text-sm text-muted">درخواست‌های در انتظار بررسی شما</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-text-2">
            {faDigits(result?.totalOpen ?? 0)} مورد
          </span>
          <button
            onClick={() => setComposeOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            ایجاد پیام
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      {hasChairGate && (
        <section className="mb-6 rounded-xl border border-[#f59e0b40] bg-[#f59e0b0d] p-5">
          <h2 className="text-sm font-bold text-[#92400e]">ارجاع و ارسال گزارش به رئیس هیئت مدیره</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#92400e]/80">
            دسترسی کامل کارتابل و ارجاعات مخصوص مدیر ارشد و مدیر عامل است؛ ارسال گزارش به رئیس هیئت مدیره
            نیازمند مجوز ایشان است.
          </p>
          <div className="mt-3">
            {chairPerm?.status === 'APPROVED' ? (
              <span className="rounded-full bg-[#10b98124] px-3 py-1.5 text-xs font-bold text-[#059669]">
                مجوز تأیید شد ✓
              </span>
            ) : chairPerm?.status === 'PENDING' ? (
              <span className="rounded-full bg-[#f59e0b24] px-3 py-1.5 text-xs font-bold text-[#b45309]">
                درخواست ارسال شد — در انتظار تأیید
              </span>
            ) : (
              <button
                onClick={() => void onRequestChairPerm()}
                className="rounded-lg bg-[#b45309] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#92400e]"
              >
                درخواست مجوز از رئیس هیئت مدیره
              </button>
            )}
          </div>
        </section>
      )}

      <div className="mb-6 grid grid-cols-3 gap-4">
        {CATEGORY_CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(category === c.key ? null : c.key)}
            className={`rounded-xl border p-4 text-right transition ${
              category === c.key ? 'border-accent bg-accent/5' : 'border-border bg-white hover:border-accent/40'
            }`}
          >
            <div className="text-[11px] text-muted">{c.label}</div>
            <div className="font-num mt-1 text-lg font-black text-ink">
              {faDigits(result?.counts[c.key] ?? 0)}
            </div>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">در حال بارگذاری…</p>
      ) : tasks.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {category ? 'موردی با این فیلتر یافت نشد ✓' : 'کارتابل خالی است ✓'}
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{t.title}</span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                    {CATEGORY_BADGES[t.category]}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  ارسال از: {t.senderLabelFa ?? t.sender?.fullName ?? '—'}
                </div>
              </div>
              <span className="font-num text-[10px] text-muted-2">{formatJalaliDateTime(t.createdAt)}</span>
              <button
                onClick={() => openReview(t)}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
              >
                بررسی
              </button>
            </li>
          ))}
        </ul>
      )}

      {composeOpen && (
        <ComposeMessageModal
          onClose={() => setComposeOpen(false)}
          onSent={(label) => setNotice(`پیام به «${label}» ارسال شد`)}
        />
      )}

      {reviewTask && (
        <Modal title="بررسی درخواست" onClose={() => setReviewTask(null)}>
          <div className="mb-3">
            <div className="text-sm font-bold text-ink">{reviewTask.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-text-2">{reviewTask.description}</p>
          </div>
          <div className="mb-4 rounded-lg bg-surface p-3">
            <div className="text-[10px] text-muted">ارسال‌کننده‌ی درخواست</div>
            <div className="mt-0.5 text-xs font-bold text-ink">
              {reviewTask.senderLabelFa ?? reviewTask.sender?.fullName ?? '—'}
            </div>
          </div>

          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="review-note">
            نظر مدیر *
          </label>
          <textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="توضیح یا دلیل تصمیم خود را بنویسید…"
            rows={3}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />

          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="review-transfer">
            انتقال به مدیر دیگر (اختیاری)
          </label>
          <select
            id="review-transfer"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-white p-3 text-xs outline-none transition focus:border-accent"
          >
            <option value="">— انتخاب مدیر —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.roleLabelFa}
              </option>
            ))}
          </select>

          {reviewError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {reviewError}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => void onDecide('transfer')}
              disabled={!transferTo}
              className="rounded-lg border border-accent/40 px-4 py-2 text-xs font-bold text-accent transition hover:bg-accent/5 disabled:opacity-50"
            >
              انتقال
            </button>
            <button
              onClick={() => void onDecide('reject')}
              className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
            >
              انصراف
            </button>
            <button
              onClick={() => void onDecide('approve')}
              className="rounded-lg bg-[#059669] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#047857]"
            >
              تأیید
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
