import { useEffect, useState, type FormEvent } from 'react';
import { fetchInbox, postInboxMessage } from '../../api/agency-portal';
import { formatLocaleDateTime } from '../../lib/locale-format';
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
  newMessage: string;
  recipient: string;
  subject: string;
  subjectPlaceholder: string;
  validation: string;
  cancel: string;
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
    newMessage: 'پیام جدید', recipient: 'گیرنده', subject: 'موضوع',
    subjectPlaceholder: 'موضوع پیام', validation: 'لطفاً گیرنده، موضوع و متن پیام را کامل کنید.', cancel: 'انصراف',
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
    newMessage: 'New message', recipient: 'Recipient', subject: 'Subject',
    subjectPlaceholder: 'Message subject', validation: 'Complete the recipient, subject and message.', cancel: 'Cancel',
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
    newMessage: 'رسالة جديدة', recipient: 'المستلم', subject: 'الموضوع',
    subjectPlaceholder: 'موضوع الرسالة', validation: 'أكمل المستلم والموضوع ونص الرسالة.', cancel: 'إلغاء',
  },
};

export default function AgencyInboxPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [messages, setMessages] = useState<AgencyMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
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
    if (!body.trim() || !subject.trim()) {
      setValidationError(t.validation);
      return;
    }
    setSending(true);
    setValidationError(null);
    try {
      await postInboxMessage(`${t.subject}: ${subject.trim()}\n\n${body.trim()}`);
      setBody('');
      setSubject('');
      setComposeOpen(false);
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h1 className="text-lg font-black text-ink">{t.heading}</h1><p className="mt-1 text-xs text-muted">{t.subtitle}</p></div>
        <button type="button" onClick={() => setComposeOpen(true)} className="rounded-lg bg-accent px-4 py-2.5 text-xs font-black text-white">+ {t.newMessage}</button>
      </div>
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
              <div className="mt-1 text-[10px] text-muted">{formatLocaleDateTime(m.createdAt, locale)}</div>
            </div>
          ))
        )}
      </div>

      {composeOpen && <form onSubmit={onSend} className="rounded-2xl border border-[#d6e4f8] bg-white p-5 shadow-sm" data-testid="agency-compose-message">
        <h2 className="mb-4 text-sm font-black text-ink">{t.newMessage}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-muted">{t.recipient}
            <select className="mt-1.5 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm" defaultValue="commercial"><option value="commercial">blujet · {t.subtitle}</option></select>
          </label>
          <label className="text-xs font-bold text-muted">{t.subject}
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.subjectPlaceholder} className="mt-1.5 h-11 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-accent" />
          </label>
          <label className="text-xs font-bold text-muted sm:col-span-2">{t.placeholder}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.placeholder} rows={5} className="mt-1.5 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-accent" />
          </label>
        </div>
        {validationError && <p role="alert" className="mt-3 text-xs text-danger">{validationError}</p>}
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={sending} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{t.sendBtn}</button>
          <button type="button" onClick={() => { setComposeOpen(false); setValidationError(null); }} className="rounded-lg border border-border px-5 py-2.5 text-sm font-bold text-muted">{t.cancel}</button>
        </div>
      </form>}
    </div>
  );
}
