import { useEffect, useState, type FormEvent } from 'react';
import { fetchInbox, postInboxMessage } from '../../api/agency-portal';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyMessage } from '../../types/agency-portal';

// کارتابل و پیام‌ها — most strings reuse
// design-reference-v2/پنل آژانس.dc.html's own isEN vocabulary
// (inboxTitle, replyPlaceholder, sendReplyLabel, noMessagesLabel); AR has
// no counterpart there and is hand-translated.
const STR: Record<StoredLocale, {
  heading: string;
  subtitle: string;
  errorFallback: string;
  sendErrorFallback: string;
  loading: string;
  empty: string;
  youLabel: string;
  placeholder: string;
  sendBtn: string;
}> = {
  fa: {
    heading: 'کارتابل و پیام‌ها',
    subtitle: 'مکاتبه مستقیم با واحد بازرگانی blujet',
    errorFallback: 'خطا در دریافت پیام‌ها.',
    sendErrorFallback: 'خطا در ارسال پیام.',
    loading: 'در حال بارگذاری…',
    empty: 'پیامی ثبت نشده است.',
    youLabel: 'شما',
    placeholder: 'پیام خود را بنویسید…',
    sendBtn: 'ارسال',
  },
  en: {
    heading: 'Inbox & Messages',
    subtitle: "Direct correspondence with blujet's commercial team",
    errorFallback: 'Error loading messages.',
    sendErrorFallback: 'Error sending the message.',
    loading: 'Loading…',
    empty: 'No messages yet.',
    youLabel: 'You',
    placeholder: 'Write your message…',
    sendBtn: 'Send',
  },
  ar: {
    heading: 'الوارد والرسائل',
    subtitle: 'تواصل مباشر مع فريق blujet التجاري',
    errorFallback: 'خطأ في تحميل الرسائل.',
    sendErrorFallback: 'خطأ في إرسال الرسالة.',
    loading: 'جارٍ التحميل…',
    empty: 'لا توجد رسائل بعد.',
    youLabel: 'أنت',
    placeholder: 'اكتب رسالتك…',
    sendBtn: 'إرسال',
  },
};

export default function AgencyInboxPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [messages, setMessages] = useState<AgencyMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  function reload() {
    fetchInbox()
      .then(setMessages)
      .catch(() => setError(t.errorFallback));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(t.sendErrorFallback);
    } finally {
      setSending(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!messages) return <p className="p-8 text-sm text-muted">{t.loading}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t.empty}</p>
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
                {m.senderIsAgency ? t.youLabel : 'blujet'}
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
          placeholder={t.placeholder}
          className="flex-1 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {t.sendBtn}
        </button>
      </form>
    </div>
  );
}
