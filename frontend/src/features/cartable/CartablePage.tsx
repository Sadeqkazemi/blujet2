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
import {
  StaffAlert,
  StaffCountPill,
  StaffPanelPageHeader,
  StaffPrimaryButton,
} from '../../components/staff-panel-ui';
import { STAFF_PANEL } from '../../lib/staff-panel-theme';
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

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <StaffPanelPageHeader title="کارتابل من" subtitle="درخواست‌های در انتظار بررسی شما" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <StaffCountPill>{faDigits(result?.totalOpen ?? 0)} مورد</StaffCountPill>
          <StaffPrimaryButton onClick={() => setComposeOpen(true)}>ایجاد پیام</StaffPrimaryButton>
        </div>
      </div>

      {error && <StaffAlert tone="error">{error}</StaffAlert>}
      {notice && <StaffAlert tone="success">{notice}</StaffAlert>}

      {hasChairGate && (
        <section
          style={{
            marginBottom: 24,
            borderRadius: 14,
            border: `1px solid rgba(245,158,11,0.35)`,
            background: 'rgba(245,158,11,0.08)',
            padding: 16,
          }}
        >
          <h2 style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.warning, margin: 0 }}>
            ارجاع و ارسال گزارش به رئیس هیئت مدیره
          </h2>
          <p style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: STAFF_PANEL.navMuted }}>
            دسترسی کامل کارتابل و ارجاعات مخصوص مدیر ارشد و مدیر عامل است؛ ارسال گزارش به رئیس هیئت مدیره
            نیازمند مجوز ایشان است.
          </p>
          <div style={{ marginTop: 12 }}>
            {chairPerm?.status === 'APPROVED' ? (
              <span
                style={{
                  borderRadius: 20,
                  background: 'rgba(52,211,153,0.15)',
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: STAFF_PANEL.success,
                }}
              >
                مجوز تأیید شد ✓
              </span>
            ) : chairPerm?.status === 'PENDING' ? (
              <span
                style={{
                  borderRadius: 20,
                  background: 'rgba(245,158,11,0.15)',
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: STAFF_PANEL.warning,
                }}
              >
                درخواست ارسال شد — در انتظار تأیید
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void onRequestChairPerm()}
                style={{
                  borderRadius: 10,
                  background: STAFF_PANEL.warning,
                  color: '#fff',
                  padding: '8px 14px',
                  fontSize: 11.5,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                درخواست مجوز از رئیس هیئت مدیره
              </button>
            )}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
        <JalaliDatePicker label="فیلتر روز (شمسی)" value={filterDate} onChange={setFilterDate} />
        {filterDate && (
          <button
            type="button"
            onClick={() => setFilterDate(null)}
            style={{
              borderRadius: 10,
              border: `1px solid ${STAFF_PANEL.inputBorder}`,
              background: 'transparent',
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: STAFF_PANEL.textMuted,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            حذف فیلتر روز
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {CATEGORY_CARDS.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(active ? null : c.key)}
              style={{
                borderRadius: 14,
                border: `1px solid ${active ? STAFF_PANEL.accent : STAFF_PANEL.cardBorder}`,
                background: active ? STAFF_PANEL.accentSoft : STAFF_PANEL.cardBg,
                padding: 14,
                textAlign: 'right',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 11, color: STAFF_PANEL.textMuted }}>{c.label}</div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: '#fff' }}>
                {faDigits(result?.counts[c.key] ?? 0)}
              </div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>در حال بارگذاری…</p>
      ) : tasks.length === 0 ? (
        <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: STAFF_PANEL.textMuted }}>
          {category ? 'موردی با این فیلتر یافت نشد ✓' : 'کارتابل خالی است ✓'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((t) => (
            <li
              key={t.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 14,
                borderRadius: 14,
                border: `1px solid ${STAFF_PANEL.cardBorder}`,
                background: STAFF_PANEL.cardBg,
                padding: 14,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>{t.title}</span>
                  <span
                    style={{
                      borderRadius: 20,
                      background: STAFF_PANEL.accentSoft,
                      padding: '3px 10px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: STAFF_PANEL.accent,
                    }}
                  >
                    {CATEGORY_BADGES[t.category]}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: STAFF_PANEL.textMuted }}>
                  ارسال از: {t.senderLabelFa ?? t.sender?.fullName ?? '—'}
                </div>
              </div>
              <span style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>{formatJalaliDateTime(t.createdAt)}</span>
              <StaffPrimaryButton onClick={() => openReview(t)}>بررسی</StaffPrimaryButton>
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: STAFF_PANEL.text }}>{reviewTask.title}</div>
            <p style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: STAFF_PANEL.textMuted }}>{reviewTask.description}</p>
          </div>
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              background: STAFF_PANEL.inputBg,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 10, color: STAFF_PANEL.textMuted }}>ارسال‌کننده‌ی درخواست</div>
            <div style={{ marginTop: 2, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }}>
              {reviewTask.senderLabelFa ?? reviewTask.sender?.fullName ?? '—'}
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }} htmlFor="review-note">
            نظر مدیر *
          </label>
          <textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="توضیح یا دلیل تصمیم خود را بنویسید…"
            rows={3}
            style={{
              width: '100%',
              borderRadius: 10,
              border: `1px solid ${STAFF_PANEL.inputBorder}`,
              background: STAFF_PANEL.inputBg,
              color: STAFF_PANEL.text,
              padding: 12,
              fontSize: 11,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />

          <label style={{ display: 'block', marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 800, color: STAFF_PANEL.text }} htmlFor="review-transfer">
            انتقال به مدیر دیگر (اختیاری)
          </label>
          <select
            id="review-transfer"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            style={{
              width: '100%',
              borderRadius: 10,
              border: `1px solid ${STAFF_PANEL.inputBorder}`,
              background: STAFF_PANEL.inputBg,
              color: STAFF_PANEL.text,
              padding: 12,
              fontSize: 11,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          >
            <option value="">— انتخاب مدیر —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.roleLabelFa}
              </option>
            ))}
          </select>

          {reviewError && (
            <p role="alert" style={{ marginTop: 8, fontSize: 11, color: STAFF_PANEL.danger }}>
              {reviewError}
            </p>
          )}

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => void onDecide('transfer')}
              disabled={!transferTo}
              style={{
                borderRadius: 10,
                border: `1px solid ${STAFF_PANEL.accent}`,
                background: 'transparent',
                color: STAFF_PANEL.accent,
                padding: '8px 16px',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: transferTo ? 'pointer' : 'not-allowed',
                opacity: transferTo ? 1 : 0.5,
                fontFamily: 'inherit',
              }}
            >
              انتقال
            </button>
            <button
              type="button"
              onClick={() => void onDecide('reject')}
              style={{
                borderRadius: 10,
                background: STAFF_PANEL.danger,
                color: '#fff',
                padding: '8px 16px',
                fontSize: 11.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => void onDecide('approve')}
              style={{
                borderRadius: 10,
                background: STAFF_PANEL.success,
                color: '#fff',
                padding: '8px 16px',
                fontSize: 11.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              تأیید
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
