import { useEffect, useState, type FormEvent } from 'react';
import { fetchInbox, postInboxMessage } from '../../api/agency-portal';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { AgencyMessage } from '../../types/agency-portal';

export default function AgencyInboxPage() {
  const [messages, setMessages] = useState<AgencyMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  function reload() {
    fetchInbox()
      .then(setMessages)
      .catch(() => setError('خطا در دریافت پیام‌ها.'));
  }

  useEffect(reload, []);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await postInboxMessage(body.trim());
      setBody('');
      reload();
    } catch {
      setError('خطا در ارسال پیام.');
    } finally {
      setSending(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!messages) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">کارتابل و پیام‌ها</h1>
      <p className="mb-6 text-sm text-muted">مکاتبه مستقیم با واحد بازرگانی blujet</p>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">پیامی ثبت نشده است.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[70%] rounded-xl px-3.5 py-2.5 text-xs ${
                m.senderIsAgency
                  ? 'self-end bg-accent/10 text-ink'
                  : 'self-start bg-[#f3f5f8] text-ink'
              }`}
            >
              <div className="mb-1 text-[10px] font-bold text-muted">
                {m.senderIsAgency ? 'شما' : 'blujet'}
              </div>
              <div>{m.body}</div>
              <div className="mt-1 text-[10px] text-muted">{formatJalaliDateTime(m.createdAt)}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSend} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="پیام خود را بنویسید…"
          className="flex-1 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          ارسال
        </button>
      </form>
    </div>
  );
}
