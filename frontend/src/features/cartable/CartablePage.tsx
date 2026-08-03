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
import JalaliDatePicker from '../../components/JalaliDatePicker';
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
  const isDarkPanel = user?.role === 'FINANCE_MANAGER' || user?.role === 'COMMERCIAL_MANAGER';
  const hasChairGate = isDarkPanel;

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

  const titleClass = isDarkPanel ? 'text-[20.5px] font-black text-white' : 'text-xl font-black text-ink';
  const subClass = isDarkPanel ? 'mt-1 text-sm text-[#6b7b94]' : 'mt-1 text-sm text-muted';
  const countPillClass = isDarkPanel
    ? 'rounded-full bg-[#18223a] px-3 py-1.5 text-xs font-bold text-[#9fb0c7]'
    : 'rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-text-2';
  const categoryCardClass = (active: boolean) =>
    isDarkPanel
      ? `rounded-xl border p-4 text-right transition ${
          active ? 'border-[#3b82f6] bg-[#3b82f61a]' : 'border-[#1f2a3d] bg-[#141d2e] hover:border-[#3b82f666]'
        }`
      : `rounded-xl border p-4 text-right transition ${
          active ? 'border-accent bg-accent/5' : 'border-border bg-white hover:border-accent/40'
        }`;
  const categoryLabelClass = isDarkPanel ? 'text-[11px] text-[#6b7b94]' : 'text-[11px] text-muted';
  const categoryValueClass = isDarkPanel ? 'font-num mt-1 text-lg font-black text-white' : 'font-num mt-1 text-lg font-black text-ink';
  const taskRowClass = isDarkPanel
    ? 'flex flex-wrap items-center gap-4 rounded-xl border border-[#22304a] bg-[#0f1726] p-4'
    : 'flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-4';
  const taskTitleClass = isDarkPanel ? 'text-sm font-bold text-white' : 'text-sm font-bold text-ink';
  const taskMetaClass = isDarkPanel ? 'mt-1 text-[11px] text-[#6b7b94]' : 'mt-1 text-[11px] text-muted';
  const taskDateClass = isDarkPanel ? 'font-num text-[10px] text-[#6b7b94]' : 'font-num text-[10px] text-muted-2';
  const categoryBadgeClass = isDarkPanel
    ? 'rounded-full bg-[#3b82f624] px-2.5 py-0.5 text-[10px] font-bold text-[#60a5fa]'
    : 'rounded-full bg-surface-2 px-2.5 py-0.5 text-[10px] font-bold text-accent';
  const filterBtnClass = isDarkPanel
    ? 'rounded-lg border border-[#28344c] px-3 py-2 text-xs font-bold text-[#6b7b94] transition hover:text-white'
    : 'rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted transition hover:text-ink';
  const emptyTextClass = isDarkPanel ? 'py-10 text-center text-sm text-[#6b7b94]' : 'py-10 text-center text-sm text-muted';

  return (
    <div className={isDarkPanel ? 'px-[21px] pb-[34px] pt-[18px]' : 'p-8'}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={titleClass}>کارتابل من</h1>
          <p className={subClass}>درخواست‌های در انتظار بررسی شما</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={countPillClass}>{faDigits(result?.totalOpen ?? 0)} مورد</span>
          <button
            onClick={() => setComposeOpen(true)}
            className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2563eb]"
          >
            ایجاد پیام
          </button>
        </div>
      </div>

      {error && (
        <p className={`mb-4 rounded-lg p-3 text-sm ${isDarkPanel ? 'bg-[#f8717124] text-[#f87171]' : 'bg-danger/10 text-danger'}`}>
          {error}
        </p>
      )}
      {notice && (
        <p className={`mb-4 rounded-lg p-3 text-sm ${isDarkPanel ? 'bg-[#34d39924] text-[#34d399]' : 'bg-[#10b98115] text-[#059669]'}`}>
          {notice}
        </p>
      )}

      {hasChairGate && (
        <section className="mb-6 rounded-xl border border-[#f59e0b59] bg-[#f59e0b14] p-5">
          <h2 className="text-sm font-bold text-[#fbbf24]">ارجاع و ارسال گزارش به رئیس هیئت مدیره</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#cdd7e5]">
            دسترسی کامل کارتابل و ارجاعات مخصوص مدیر ارشد و مدیر عامل است؛ ارسال گزارش به رئیس هیئت مدیره
            نیازمند مجوز ایشان است.
          </p>
          <div className="mt-3">
            {chairPerm?.status === 'APPROVED' ? (
              <span className="rounded-full bg-[#34d39924] px-3 py-1.5 text-xs font-bold text-[#34d399]">
                مجوز تأیید شد ✓
              </span>
            ) : chairPerm?.status === 'PENDING' ? (
              <span className="rounded-full bg-[#f59e0b24] px-3 py-1.5 text-xs font-bold text-[#fbbf24]">
                درخواست ارسال شد — در انتظار تأیید
              </span>
            ) : (
              <button
                onClick={() => void onRequestChairPerm()}
                className="rounded-lg bg-[#f59e0b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#d97706]"
              >
                درخواست مجوز از رئیس هیئت مدیره
              </button>
            )}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <JalaliDatePicker label="فیلتر روز (شمسی)" value={filterDate} onChange={setFilterDate} />
        </div>
        {filterDate && (
          <button onClick={() => setFilterDate(null)} className={filterBtnClass}>
            حذف فیلتر روز
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        {CATEGORY_CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(category === c.key ? null : c.key)}
            className={categoryCardClass(category === c.key)}
          >
            <div className={categoryLabelClass}>{c.label}</div>
            <div className={categoryValueClass}>{faDigits(result?.counts[c.key] ?? 0)}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <p className={emptyTextClass}>در حال بارگذاری…</p>
      ) : tasks.length === 0 ? (
        <p className={emptyTextClass}>
          {category ? 'موردی با این فیلتر یافت نشد ✓' : 'کارتابل خالی است ✓'}
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className={taskRowClass}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={taskTitleClass}>{t.title}</span>
                  <span className={categoryBadgeClass}>{CATEGORY_BADGES[t.category]}</span>
                </div>
                <div className={taskMetaClass}>
                  ارسال از: {t.senderLabelFa ?? t.sender?.fullName ?? '—'}
                </div>
              </div>
              <span className={taskDateClass}>{formatJalaliDateTime(t.createdAt)}</span>
              <button
                onClick={() => openReview(t)}
                className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2563eb]"
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
        <Modal variant={isDarkPanel ? 'dark' : 'light'} title="بررسی درخواست" onClose={() => setReviewTask(null)}>
          <div className="mb-3">
            <div className={`text-sm font-bold ${isDarkPanel ? 'text-white' : 'text-ink'}`}>{reviewTask.title}</div>
            <p className={`mt-1 text-xs leading-relaxed ${isDarkPanel ? 'text-[#9fb0c7]' : 'text-text-2'}`}>
              {reviewTask.description}
            </p>
          </div>
          <div
            className={`mb-4 rounded-lg p-3 ${isDarkPanel ? 'border border-[#22304a] bg-[#0f1726]' : 'bg-surface'}`}
          >
            <div className={`text-[10px] ${isDarkPanel ? 'text-[#6b7b94]' : 'text-muted'}`}>ارسال‌کننده‌ی درخواست</div>
            <div className={`mt-0.5 text-xs font-bold ${isDarkPanel ? 'text-[#e7ecf3]' : 'text-ink'}`}>
              {reviewTask.senderLabelFa ?? reviewTask.sender?.fullName ?? '—'}
            </div>
          </div>

          <label
            className={`mb-1 block text-xs font-bold ${isDarkPanel ? 'text-white' : 'text-ink'}`}
            htmlFor="review-note"
          >
            نظر مدیر *
          </label>
          <textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="توضیح یا دلیل تصمیم خود را بنویسید…"
            rows={3}
            className={`w-full rounded-lg border p-3 text-xs outline-none transition ${
              isDarkPanel
                ? 'border-[#28344c] bg-[#18223a] text-[#e7ecf3] focus:border-[#3b82f6]'
                : 'border-border focus:border-accent'
            }`}
          />

          <label
            className={`mb-1 mt-3 block text-xs font-bold ${isDarkPanel ? 'text-white' : 'text-ink'}`}
            htmlFor="review-transfer"
          >
            انتقال به مدیر دیگر (اختیاری)
          </label>
          <select
            id="review-transfer"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className={`w-full rounded-lg border p-3 text-xs outline-none transition ${
              isDarkPanel
                ? 'border-[#28344c] bg-[#18223a] text-[#e7ecf3] focus:border-[#3b82f6]'
                : 'border-border bg-white focus:border-accent'
            }`}
          >
            <option value="">— انتخاب مدیر —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.roleLabelFa}
              </option>
            ))}
          </select>

          {reviewError && (
            <p role="alert" className={`mt-2 text-xs ${isDarkPanel ? 'text-[#f87171]' : 'text-danger'}`}>
              {reviewError}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => void onDecide('transfer')}
              disabled={!transferTo}
              className={`rounded-lg border px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                isDarkPanel
                  ? 'border-[#3b82f64d] text-[#60a5fa] hover:bg-[#3b82f61a]'
                  : 'border-accent/40 text-accent hover:bg-accent/5'
              }`}
            >
              انتقال
            </button>
            <button
              onClick={() => void onDecide('reject')}
              className="rounded-lg bg-[#f87171] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ef4444]"
            >
              انصراف
            </button>
            <button
              onClick={() => void onDecide('approve')}
              className="rounded-lg bg-[#16a34a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#15803d]"
            >
              تأیید
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
