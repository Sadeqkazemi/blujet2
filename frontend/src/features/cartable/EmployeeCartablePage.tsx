import { useCallback, useEffect, useState } from 'react';
import {
  approveCartableTask,
  fetchCartable,
  fetchManagerRecipients,
  fetchSentManagerMessages,
  sendEmployeeManagerMessage,
} from '../../api/cartable';
import { faDigits } from '../../lib/fa-format';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { formatJalaliDateTime } from '../../lib/jalali';
import { fetchEmployeeContext } from '../../api/panels';
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
  const [canProcess, setCanProcess] = useState(false);

  const [msgTo, setMsgTo] = useState('');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cartable, context] = await Promise.all([
        fetchCartable(),
        fetchEmployeeContext(),
      ]);
      setResult(cartable);
      const mayProcess = context.permissionKeys.includes('ct_process');
      setCanProcess(mayProcess);
      if (mayProcess) {
        try {
          const [mgrs, sentMsgs] = await Promise.all([
            fetchManagerRecipients(),
            fetchSentManagerMessages(),
          ]);
          setRecipients(mgrs);
          setSent(sentMsgs);
        } catch {
          setRecipients([]);
          setSent([]);
        }
      } else {
        setRecipients([]);
        setSent([]);
      }
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
  const tasksPager = usePagination(tasks);
  const canSend = msgTo && msgText.trim().length > 0;

  return (
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <div className="mb-5">
        <h1 className="m-0 text-[20.5px] font-black text-white">کارتابل من</h1>
        <p className="mt-1 text-[11.5px] text-[#6b7b94]">کارهای در انتظار اقدام شما</p>
      </div>

      {error && (
        <p className="mb-4 rounded-[12px] border border-[#7f1d1d] bg-[#450a0a]/60 p-3 text-sm text-[#f87171]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-[12px] border border-[#14532d] bg-[rgba(16,185,129,.12)] p-3 text-sm text-[#34d399]">
          {notice}
        </p>
      )}

      {canProcess && <section className="mb-5 rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-[15px]">
        <h2 className="m-0 text-[14.5px] font-extrabold text-white">ارسال پیام به مدیر</h2>
        <p className="mt-1 text-[11px] text-[#6b7b94]">
          می‌توانید به مدیر واحد خود یا سایر مدیران پیام بدهید.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.7fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-[10px] text-[#6b7b94]" htmlFor="msg-to">
              گیرنده
            </label>
            <select
              id="msg-to"
              value={msgTo}
              onChange={(e) => setMsgTo(e.target.value)}
              className="w-full rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 py-2.5 text-xs text-[#e7ecf3] outline-none focus:border-[#3b82f6]"
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
            <label className="mb-1 block text-[10px] text-[#6b7b94]" htmlFor="msg-text">
              متن پیام
            </label>
            <input
              id="msg-text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="پیام خود را بنویسید…"
              className="w-full rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 py-2.5 text-xs text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
            />
          </div>
          <button
            type="button"
            disabled={!canSend || sending}
            onClick={() => void onSendMessage()}
            className={`rounded-[10px] px-4 py-2.5 text-xs font-bold transition ${
              canSend
                ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                : 'cursor-not-allowed bg-[#18223a] text-[#6b7b94]'
            }`}
          >
            ارسال
          </button>
        </div>

        {sent.length > 0 && (
          <div className="mt-4 border-t border-[#1f2a3d] pt-3">
            <div className="mb-2 text-[10px] font-bold text-[#6b7b94]">پیام‌های ارسالی</div>
            <ul className="space-y-2">
              {sent.map((s) => (
                <li
                  key={s.id}
                  className="rounded-[10px] border border-[#28344c] bg-[#18223a] px-3 py-2"
                >
                  <div className="text-[11px] text-[#e7ecf3]">{s.body}</div>
                  <div className="mt-1 text-[9px] text-[#6b7b94]">
                    به {s.toName} · {formatJalaliDateTime(s.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>}

      {loading ? (
        <p className="py-10 text-center text-sm text-[#6b7b94]">در حال بارگذاری…</p>
      ) : tasks.length === 0 ? (
        <p className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] py-10 text-center text-sm text-[#6b7b94]">
          کار بازی در کارتابل شما نیست.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasksPager.pageItems.map((t) => {
            const fromName = t.senderLabelFa ?? t.sender?.fullName ?? '—';
            const done = t.status !== 'OPEN';
            return (
              <li
                key={t.id}
                className={`flex flex-wrap items-center gap-3 rounded-[14px] border bg-[#141d2e] p-4 ${
                  done ? 'border-[#1f3d2f]' : 'border-[#1f2a3d]'
                }`}
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[rgba(59,130,246,.16)] text-sm font-bold text-[#60a5fa]">
                  {initials(fromName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#e7ecf3]">{t.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[#6b7b94]">
                    <span>{formatJalaliDateTime(t.createdAt)}</span>
                    <span>از {fromName}</span>
                  </div>
                </div>
                {!done && canProcess ? (
                  <button
                    type="button"
                    onClick={() => void onDone(t)}
                    className="rounded-[10px] bg-[#16a34a] px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-[#15803d]"
                  >
                    انجام شد ✓
                  </button>
                ) : done ? (
                  <span className="text-[11px] font-bold text-[#34d399]">تکمیل شد</span>
                ) : (
                  <span className="text-[11px] font-bold text-[#9fb0c7]">فقط مشاهده</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={tasksPager.page}
        totalPages={tasksPager.totalPages}
        onChange={tasksPager.setPage}
        variant="dark"
      />

      {result && result.totalOpen > 0 && (
        <p className="mt-4 text-center text-[11px] text-[#6b7b94]">
          {faDigits(result.totalOpen)} کار باز
        </p>
      )}
    </div>
  );
}
