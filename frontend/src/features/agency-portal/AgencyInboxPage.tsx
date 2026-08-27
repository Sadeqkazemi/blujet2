import { useEffect, useState, type FormEvent } from 'react';
import { fetchInbox, postInboxMessage } from '../../api/agency-portal';
import { fetchMySupportTickets, submitMySupportTicket } from '../../api/support-tickets';
import { formatLocaleDateTime } from '../../lib/locale-format';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyMessage } from '../../types/agency-portal';
import type { MySupportTicketRow } from '../../types/support-tickets';
import Modal from '../../components/Modal';
import AttachmentPicker from '../../components/AttachmentPicker';
import AttachmentList from '../../components/AttachmentList';
import type { ReferralAttachment } from '../../types/cartable';

function messageParts(message: AgencyMessage) {
  const lines = message.body.split(/\r?\n/);
  const subjectLine = lines.find((line) => /^(موضوع|Subject|الموضوع):/i.test(line.trim()));
  const subject = subjectLine?.replace(/^[^:]+:\s*/, '').trim() || '';
  const body = lines
    .filter((line) => !/^(گیرنده|Recipient|المستلم|موضوع|Subject|الموضوع):/i.test(line.trim()))
    .join('\n')
    .trim() || message.body;
  return { subject, body };
}

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
  requesterName: string;
  requesterPhone: string;
  phonePlaceholder: string;
  ticketValidation: string;
  ticketSuccess: string;
  ticketsHeading: string;
  ticketsEmpty: string;
  ticketsLoadError: string;
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
    requesterName: 'نام درخواست‌کننده', requesterPhone: 'شماره تماس', phonePlaceholder: 'مثلاً ۰۹۱۲۱۲۳۴۵۶۷',
    ticketValidation: 'نام، شماره تماس معتبر، موضوع و متن پیام را کامل کنید.', ticketSuccess: 'پیام شما ثبت شد. کد پیگیری:',
    ticketsHeading: 'پیام‌های ارسالی', ticketsEmpty: 'پیامی برای پشتیبانی ثبت نشده است.', ticketsLoadError: 'خطا در دریافت پیام‌های پشتیبانی.',
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
    requesterName: 'Requester name', requesterPhone: 'Phone number', phonePlaceholder: 'e.g. +989121234567',
    ticketValidation: 'Enter a name, valid phone number, subject, and message.', ticketSuccess: 'Your message was submitted. Tracking code:',
    ticketsHeading: 'Sent messages', ticketsEmpty: 'No support messages yet.', ticketsLoadError: 'Error loading support messages.',
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
    requesterName: 'اسم مقدم الطلب', requesterPhone: 'رقم الهاتف', phonePlaceholder: 'مثال: ٠٩١٢١٢٣٤٥٦٧',
    ticketValidation: 'أدخل الاسم ورقم هاتف صحيحاً والموضوع ونص الرسالة.', ticketSuccess: 'تم تسجيل رسالتك. رمز المتابعة:',
    ticketsHeading: 'الرسائل المرسلة', ticketsEmpty: 'لا توجد رسائل دعم بعد.', ticketsLoadError: 'خطأ في تحميل رسائل الدعم.',
  },
};

export default function AgencyInboxPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [messages, setMessages] = useState<AgencyMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [subject, setSubject] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<MySupportTicketRow[] | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);
  const [ticketAttachments, setTicketAttachments] = useState<ReferralAttachment[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<ReferralAttachment[]>([]);

  function reload() {
    fetchInbox()
      .then((rows) => {
        setMessages(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => setError(t.errorFallback));
  }

  function reloadTickets() {
    fetchMySupportTickets()
      .then((rows) => {
        setTickets(rows);
        setTicketsError(null);
      })
      .catch(() => {
        setTickets([]);
        setTicketsError(t.ticketsLoadError);
      });
  }

  useEffect(() => {
    fetchInbox()
      .then((rows) => {
        setMessages(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => setError(t.errorFallback));
    fetchMySupportTickets()
      .then((rows) => {
        setTickets(rows);
        setTicketsError(null);
      })
      .catch(() => {
        setTickets([]);
        setTicketsError(t.ticketsLoadError);
      });
  }, [t.errorFallback, t.ticketsLoadError]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (
      requesterName.trim().length < 2 ||
      requesterPhone.trim().length < 8 ||
      body.trim().length < 2 ||
      subject.trim().length < 2
    ) {
      setValidationError(t.ticketValidation);
      return;
    }
    setSending(true);
    setValidationError(null);
    setTicketNotice(null);
    try {
      const created = await submitMySupportTicket({
        requesterName: requesterName.trim(),
        requesterPhone: requesterPhone.trim(),
        subject: subject.trim(),
        body: body.trim(),
        attachmentIds: ticketAttachments.map((file) => file.id),
      });
      setBody('');
      setSubject('');
      setRequesterName('');
      setRequesterPhone('');
      setTicketAttachments([]);
      setComposeOpen(false);
      setTicketNotice(`${t.ticketSuccess} ${created.trackingCode}`);
      reloadTickets();
    } catch {
      setValidationError(t.sendErrorFallback);
    } finally {
      setSending(false);
    }
  }

  async function onReply(replySubject: string) {
    if (!replyBody.trim()) return;
    setSending(true);
    setValidationError(null);
    try {
      await postInboxMessage(
        `${t.subject}: ${replySubject}\n\n${replyBody.trim()}`,
        replyAttachments.map((file) => file.id),
      );
      setReplyBody('');
      setReplyAttachments([]);
      reload();
    } catch {
      setError(t.sendErrorFallback);
    } finally {
      setSending(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!messages) return <p className="p-8 text-sm text-muted">{t.loading}</p>;

  const selected = messages.find((message) => message.id === selectedId) ?? messages[0] ?? null;
  const fallbackSubject = locale === 'fa' ? 'پیام مدیریت' : locale === 'ar' ? 'رسالة الإدارة' : 'Management message';
  const replyPlaceholder = locale === 'fa' ? 'پاسخ خود را بنویسید…' : locale === 'ar' ? 'اكتب ردك…' : 'Write your reply…';

  return (
    <div data-testid="agency-inbox-page">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h1 className="text-lg font-black text-[#0d2640]">{locale === 'fa' ? 'صندوق پیام‌ها' : t.heading}</h1></div>
        <button type="button" onClick={() => setComposeOpen(true)} className="rounded-xl bg-accent px-4 py-2.5 text-xs font-black text-white">＋ {t.newMessage}</button>
      </div>

      {ticketNotice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{ticketNotice}</p>}

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-[#edf0f5] bg-white py-16 text-center text-xs text-muted">{t.empty}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-[#e8edf3] bg-white">
            <h2 className="border-b border-[#edf0f5] px-5 py-4 text-sm font-black text-[#0d2640]">{locale === 'fa' ? 'صندوق پیام‌ها' : t.heading}</h2>
            {messages.map((message) => {
              const parts = messageParts(message);
              const active = selected?.id === message.id;
              return (
                <button key={message.id} type="button" onClick={() => setSelectedId(message.id)} className={`block w-full border-b border-[#edf0f5] px-5 py-4 text-start last:border-0 ${active ? 'bg-[#f5f9fe]' : 'bg-white hover:bg-[#fafbfd]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-xs font-black text-[#1a2d42]">{message.senderIsAgency ? t.youLabel : locale === 'fa' ? 'مدیریت blujet' : 'blujet management'}</strong>
                    <time className="text-[10px] text-[#a0a9b5]">{formatLocaleDateTime(message.createdAt, locale)}</time>
                  </div>
                  <p className="mt-2 truncate text-[11px] text-[#6f7b8b]">{parts.subject || fallbackSubject}</p>
                </button>
              );
            })}
          </section>

          {selected && (() => {
            const parts = messageParts(selected);
            return (
              <section className="rounded-2xl border border-[#e8edf3] bg-white p-5">
                <div className="flex items-start justify-between gap-3 border-b border-[#edf0f5] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef5fc] text-xs font-black text-[#1668c4]">مت</span>
                    <div><div className="text-xs font-black text-[#1a2d42]">{selected.senderIsAgency ? t.youLabel : locale === 'fa' ? 'مدیریت blujet' : 'blujet management'}</div><div className="mt-1 text-[10px] text-muted">{formatLocaleDateTime(selected.createdAt, locale)}</div></div>
                  </div>
                  <span className="rounded-lg bg-[#eef5fc] px-3 py-1 text-[10px] font-bold text-[#1668c4]">{locale === 'fa' ? 'مکاتبه' : 'Message'}</span>
                </div>
                <h3 className="mt-5 text-base font-black text-[#0d2640]">{parts.subject || fallbackSubject}</h3>
                <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[#526174]">{parts.body}</p>
                {selected.attachments?.length ? (
                  <AttachmentList attachments={selected.attachments} />
                ) : null}
                <div className="mt-6 flex gap-2 border-t border-[#edf0f5] pt-4">
                  <input value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder={replyPlaceholder} className="h-12 min-w-0 flex-1 rounded-xl border border-[#e1e6ee] bg-[#fafbfd] px-4 text-sm outline-none focus:border-[#1668c4]" />
                  <button type="button" disabled={!replyBody.trim() || sending} onClick={() => void onReply(parts.subject || fallbackSubject)} className="h-12 rounded-xl bg-[#1668c4] px-5 text-sm font-black text-white disabled:opacity-50">{t.sendBtn}</button>
                </div>
                <div className="mt-3">
                  <AttachmentPicker
                    value={replyAttachments}
                    onChange={setReplyAttachments}
                    disabled={sending}
                  />
                </div>
              </section>
            );
          })()}
        </div>
      )}

      <section className="mt-4 rounded-2xl border border-[#e8edf3] bg-white p-5" data-testid="agency-support-tickets">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-[#0d2640]">{t.ticketsHeading}</h2>
          <span className="rounded-lg bg-[#eef5fc] px-3 py-1 text-[10px] font-bold text-[#1668c4]">{tickets?.length ?? 0}</span>
        </div>
        {ticketsError ? (
          <p role="alert" className="text-xs text-danger">{ticketsError}</p>
        ) : tickets === null ? (
          <p className="text-xs text-muted">{t.loading}</p>
        ) : tickets.length === 0 ? (
          <p className="text-xs text-muted">{t.ticketsEmpty}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-xl border border-[#e8edf3] bg-[#fafbfd] p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-xs font-black text-[#1a2d42]">{ticket.subject}</strong>
                  <span dir="ltr" className="text-[10px] font-bold text-[#1668c4]">{ticket.trackingCode}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-6 text-[#6f7b8b]">{ticket.body}</p>
                <time className="mt-3 block text-[10px] text-[#a0a9b5]">{formatLocaleDateTime(ticket.updatedAt, locale)}</time>
              </article>
            ))}
          </div>
        )}
      </section>

      {composeOpen && <Modal title={t.newMessage} onClose={() => setComposeOpen(false)} variant="light" maxWidthClass="max-w-xl"><form onSubmit={onSend} className="space-y-4" data-testid="agency-compose-message">
        <label className="block text-xs font-bold text-muted">{t.requesterName}<input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-[#fafbfd] px-3 text-sm outline-none focus:border-accent" /></label>
        <label className="block text-xs font-bold text-muted">{t.requesterPhone}<input dir="ltr" inputMode="tel" value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} placeholder={t.phonePlaceholder} className="mt-2 h-12 w-full rounded-xl border border-border bg-[#fafbfd] px-3 text-sm outline-none focus:border-accent" /></label>
        <label className="block text-xs font-bold text-muted">{t.subject}<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.subjectPlaceholder} className="mt-2 h-12 w-full rounded-xl border border-border bg-[#fafbfd] px-3 text-sm outline-none focus:border-accent" /></label>
        <label className="block text-xs font-bold text-muted">{t.placeholder}<textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.placeholder} rows={5} className="mt-2 w-full rounded-xl border border-border bg-[#fafbfd] p-3 text-sm outline-none focus:border-accent" /></label>
        <AttachmentPicker
          value={ticketAttachments}
          onChange={setTicketAttachments}
          disabled={sending}
        />
        {validationError && <p role="alert" className="text-xs text-danger">{validationError}</p>}
        <div className="flex gap-2"><button type="submit" disabled={sending} className="h-12 flex-1 rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-60">{t.sendBtn}</button><button type="button" onClick={() => { setComposeOpen(false); setValidationError(null); }} className="h-12 rounded-xl bg-[#f1f3f7] px-5 text-sm font-bold text-muted">{t.cancel}</button></div>
      </form></Modal>}
    </div>
  );
}
