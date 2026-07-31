import { useCallback, useEffect, useState } from 'react';
import {
  approveCartableTask,
  fetchCartable,
  fetchManagerRecipients,
  fetchSentManagerMessages,
  sendEmployeeManagerMessage,
} from '../../api/cartable';
import { faDigits } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type {
  CartableListResult,
  CartableTask,
  EmployeeManagerRecipient,
  SentEmployeeManagerMessage,
} from '../../types/cartable';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

export default function EmployeeCartablePage() {
  const [result, setResult] = useState<CartableListResult | null>(null);
  const [recipients, setRecipients] = useState<EmployeeManagerRecipient[]>([]);
  const [sent, setSent] = useState<SentEmployeeManagerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [msgTo, setMsgTo] = useState('');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cartable, mgrs, sentMsgs] = await Promise.all([
        fetchCartable(),
        fetchManagerRecipients(),
        fetchSentManagerMessages(),
      ]);
      setResult(cartable);
      setRecipients(mgrs);
      setSent(sentMsgs);
    } catch {
      setError('خطا در دریافت کارتابل.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDone(task: CartableTask) {
    try {
      await approveCartableTask(task.id, 'انجام شد');
      setNotice('کار تکمیل شد ✓');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت انجام کار.');
    }
  }

  async function onSendMessage() {
    if (!msgTo.trim()) {
      setError('گیرندهٔ پیام را انتخاب کنید');
      return;
    }
    if (!msgText.trim()) {
      setError('متن پیام را بنویسید');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendEmployeeManagerMessage({ toId: msgTo, body: msgText.trim() });
      const target = recipients.find((r) => r.id === msgTo);
      setNotice(`پیام به ${target?.fullName ?? 'مدیر'} ارسال شد ✓`);
      setMsgTo('');
      setMsgText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال پیام.');
    } finally {
      setSending(false);
    }
  }

  const tasks = result?.tasks ?? [];
  const canSend = msgTo && msgText.trim().length > 0;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-ink">کارتابل من</h1>
        <p className="mt-1 text-xs text-muted">کارهای در انتظار اقدام شما</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && (
        <p className="mb-4 rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>
      )}

      <section className="mb-5 rounded-xl border border-border bg-white p-4">
        <h2 className="text-sm font-bold text-ink">ارسال پیام به مدیر</h2>
        <p className="mt-1 text-[11px] text-muted">
          می‌توانید به مدیر واحد خود یا سایر مدیران پیام بدهید.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.7fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-[10px] text-muted" htmlFor="msg-to">
              گیرنده
            </label>
            <select
              id="msg-to"
              value={msgTo}
              onChange={(e) => setMsgTo(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-accent"
            >
              <option value="">انتخاب مدیر…</option>
              {recipients.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                  {m.isOwnManager ? ' (مدیر شما)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-muted" htmlFor="msg-text">
              متن پیام
            </label>
            <input
              id="msg-text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="پیام خود را بنویسید…"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-xs outline-none focus:border-accent"
            />
          </div>
          <button
            type="button"
            disabled={!canSend || sending}
            onClick={() => void onSendMessage()}
            className={`rounded-lg px-4 py-2.5 text-xs font-bold transition ${
              canSend ? 'bg-accent text-white hover:bg-accent/90' : 'bg-surface-2 text-muted'
            }`}
          >
            ارسال
          </button>
        </div>

        {sent.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-[10px] font-bold text-muted">پیام‌های ارسالی</div>
            <ul className="space-y-2">
              {sent.map((s) => (
                <li key={s.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="text-[11px] text-ink">{s.body}</div>
                  <div className="mt-1 text-[9px] text-muted">
                    به {s.toName} · {formatJalaliDateTime(s.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">در حال بارگذاری…</p>
      ) : tasks.length === 0 ? (
        <p className="rounded-xl border border-border bg-white py-10 text-center text-sm text-muted">
          کار بازی در کارتابل شما نیست.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => {
            const fromName = t.senderLabelFa ?? t.sender?.fullName ?? '—';
            const done = t.status !== 'OPEN';
            return (
              <li
                key={t.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 ${
                  done ? 'border-[#1f3d2f]' : 'border-border'
                }`}
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent/10 text-sm font-bold text-accent">
                  {initials(fromName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">{t.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted">
                    <span>{formatJalaliDateTime(t.createdAt)}</span>
                    <span>از {fromName}</span>
                  </div>
                </div>
                {!done ? (
                  <button
                    type="button"
                    onClick={() => void onDone(t)}
                    className="rounded-lg bg-[#16a34a] px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-[#15803d]"
                  >
                    انجام شد ✓
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-[#059669]">تکمیل شد</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {result && result.totalOpen > 0 && (
        <p className="mt-4 text-center text-[11px] text-muted">
          {faDigits(result.totalOpen)} کار باز
        </p>
      )}
    </div>
  );
}
