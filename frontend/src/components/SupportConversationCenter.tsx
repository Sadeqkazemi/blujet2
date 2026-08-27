import { useEffect, useMemo, useState } from 'react';
import { downloadFile } from '../api/files';
import { formatLocaleDateTime } from '../lib/locale-format';
import type { StoredLocale } from '../hooks/useLocale';
import type { ReferralAttachment } from '../types/cartable';
import type {
  MySupportTicketRow,
  SupportTicketStatus,
} from '../types/support-tickets';
import AttachmentPicker from './AttachmentPicker';

const STATUS_ORDER: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'ANSWERED',
  'CLOSED',
];

const COPY = {
  fa: {
    title: 'تیکت‌های من',
    newTicket: 'تیکت جدید',
    open: 'تیکت‌های باز',
    inProgress: 'در حال بررسی',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
    view: 'مشاهده',
    subject: 'عنوان',
    id: 'شناسه',
    status: 'وضعیت',
    operation: 'عملیات',
    empty: 'هنوز پیامی ثبت نشده است.',
    reply: 'پاسخ جدید',
    replyPlaceholder: 'پیام خود را بنویسید…',
    send: 'ارسال پیام',
    closedNotice: 'این گفتگو بسته شده است.',
    attach: 'پیوست‌ها',
    search: 'جستجو با شماره تیکت یا موضوع…',
    noResults: 'تیکتی با این شماره یا موضوع پیدا نشد.',
  },
  en: {
    title: 'My tickets',
    newTicket: 'New ticket',
    open: 'Open',
    inProgress: 'In progress',
    answered: 'Answered',
    closed: 'Closed',
    view: 'View',
    subject: 'Subject',
    id: 'ID',
    status: 'Status',
    operation: 'Action',
    empty: 'No support messages yet.',
    reply: 'New reply',
    replyPlaceholder: 'Write your message…',
    send: 'Send message',
    closedNotice: 'This conversation is closed.',
    attach: 'Attachments',
    search: 'Search by ticket number or subject…',
    noResults: 'No ticket matches this number or subject.',
  },
  ar: {
    title: 'تذاكري',
    newTicket: 'تذكرة جديدة',
    open: 'مفتوحة',
    inProgress: 'قيد المراجعة',
    answered: 'تم الرد',
    closed: 'مغلقة',
    view: 'عرض',
    subject: 'العنوان',
    id: 'المعرّف',
    status: 'الحالة',
    operation: 'الإجراء',
    empty: 'لا توجد رسائل دعم بعد.',
    reply: 'رد جديد',
    replyPlaceholder: 'اكتب رسالتك…',
    send: 'إرسال الرسالة',
    closedNotice: 'هذه المحادثة مغلقة.',
    attach: 'المرفقات',
    search: 'ابحث برقم التذكرة أو الموضوع…',
    noResults: 'لم يتم العثور على تذكرة مطابقة.',
  },
} as const;

const STATUS_ICON: Record<SupportTicketStatus, string> = {
  OPEN: '✉',
  IN_PROGRESS: '◷',
  ANSWERED: '✓',
  CLOSED: '▰',
};

export default function SupportConversationCenter({
  theme = 'dark',
  locale,
  tickets,
  selectedId,
  onSelect,
  onReply,
  onNew,
  newLabel,
  busy = false,
}: {
  theme?: 'light' | 'dark';
  locale: StoredLocale;
  tickets: MySupportTicketRow[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReply: (id: string, body: string, attachmentIds: string[]) => Promise<void>;
  onNew: () => void;
  newLabel?: string;
  busy?: boolean;
}) {
  const light = theme === 'light';
  const t = COPY[locale];
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<ReferralAttachment[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visibleTickets = useMemo(() => {
    const normalized = query.trim().replace(/^#/, '').toLocaleLowerCase();
    if (!normalized) return tickets ?? [];
    return (tickets ?? []).filter((ticket) =>
      `${ticket.trackingCode} ${ticket.subject}`.toLocaleLowerCase().includes(normalized),
    );
  }, [query, tickets]);
  const active =
    visibleTickets.find((ticket) => ticket.id === selectedId) ?? visibleTickets[0] ?? null;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        STATUS_ORDER.map((status) => [
          status,
          tickets?.filter((ticket) => ticket.status === status).length ?? 0,
        ]),
      ) as Record<SupportTicketStatus, number>,
    [tickets],
  );

  useEffect(() => {
    setReply('');
    setAttachments([]);
    setSendError(null);
  }, [active?.id]);

  const labels: Record<SupportTicketStatus, string> = {
    OPEN: t.open,
    IN_PROGRESS: t.inProgress,
    ANSWERED: t.answered,
    CLOSED: t.closed,
  };

  async function sendReply() {
    if (!active || reply.trim().length < 2 || busy) return;
    setSendError(null);
    try {
      await onReply(active.id, reply.trim(), attachments.map((file) => file.id));
      setReply('');
      setAttachments([]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'خطا در ارسال پیام.');
    }
  }

  return (
    <section
      data-testid="support-conversation-center"
      data-theme={theme}
      className={`overflow-hidden rounded-[22px] border shadow-[0_18px_48px_rgba(15,35,55,.1)] ${light ? 'border-[#dce6f0] bg-white text-[#334e68]' : 'border-[#202a3c] bg-[#0b111d] text-[#dce5f2]'}`}
      dir={locale === 'en' ? 'ltr' : 'rtl'}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-7 ${light ? 'border-[#e6edf4]' : 'border-[#1d2738]'}`}>
        <h2 className={`m-0 text-base font-black ${light ? 'text-[#102a43]' : 'text-white'}`}>{t.title}</h2>
        <button
          type="button"
          onClick={onNew}
          className="rounded-xl bg-[#4f82e8] px-4 py-2.5 text-xs font-black text-white"
        >
          ＋ {newLabel ?? t.newTicket}
        </button>
      </div>

      <div className={`grid grid-cols-2 gap-2 border-b px-4 py-4 sm:grid-cols-4 sm:px-7 ${light ? 'border-[#e6edf4] bg-[#f8fbfe]' : 'border-[#1d2738]'}`}>
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            data-testid={`support-status-${status}`}
            className={`rounded-2xl border px-3 py-3 text-center ${
              status === 'OPEN'
                ? light ? 'border-[#9fc2f4] bg-[#eaf3ff] text-[#2563b9]' : 'border-[#315a9d] bg-[#13233d] text-[#69a0ff]'
                : light ? 'border-[#dce6f0] bg-white text-[#52677d]' : 'border-[#202b3e] bg-[#101827] text-[#c5cedd]'
            }`}
          >
            <div className="text-2xl" aria-hidden="true">{STATUS_ICON[status]}</div>
            <div className="mt-1 text-[11px] font-black">{labels[status]}</div>
            <div className={`font-num mt-1 text-[10px] ${light ? 'text-[#71859a]' : 'text-[#8290a6]'}`}>{counts[status].toLocaleString(locale)}</div>
          </div>
        ))}
      </div>

      {!tickets ? (
        <div className={`p-10 text-center text-xs ${light ? 'text-[#71859a]' : 'text-[#8290a6]'}`}>…</div>
      ) : tickets.length === 0 ? (
        <div className={`p-12 text-center text-sm ${light ? 'text-[#71859a]' : 'text-[#8290a6]'}`}>{t.empty}</div>
      ) : (
        <div className="grid min-h-[470px] lg:grid-cols-[minmax(330px,0.9fr)_minmax(440px,1.35fr)]">
          <div className={`border-b lg:border-b-0 lg:border-e ${light ? 'border-[#e6edf4]' : 'border-[#1d2738]'}`}>
            <div className={`border-b p-4 sm:px-5 ${light ? 'border-[#e6edf4]' : 'border-[#1d2738]'}`}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className={`h-11 w-full rounded-xl border px-4 text-xs outline-none focus:border-[#4f82e8] ${light ? 'border-[#cedbe8] bg-white text-[#102a43] placeholder:text-[#8797a8]' : 'border-[#27344a] bg-[#101827] text-white placeholder:text-[#66758a]'}`}
              />
            </div>
            <div className={`grid grid-cols-[1fr_88px_90px] gap-2 border-b px-4 py-3 text-[10px] font-bold sm:grid-cols-[1fr_105px_100px_80px] sm:px-5 ${light ? 'border-[#e6edf4] bg-[#f8fafc] text-[#687b8f]' : 'border-[#1d2738] text-[#7f8ba0]'}`}>
              <span>{t.subject}</span><span>{t.id}</span><span>{t.status}</span><span className="hidden sm:block">{t.operation}</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {visibleTickets.map((ticket) => {
                const selected = active?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    data-testid="account-ticket"
                    type="button"
                    onClick={() => onSelect(ticket.id)}
                    className={`grid w-full grid-cols-[1fr_88px_90px] items-center gap-2 border-b px-4 py-4 text-start text-[11px] transition sm:grid-cols-[1fr_105px_100px_80px] sm:px-5 ${light ? `border-[#e6edf4] ${selected ? 'bg-[#eef5fd]' : 'bg-white hover:bg-[#f7fafc]'}` : `border-[#1d2738] ${selected ? 'bg-[#121d2f]' : 'hover:bg-[#101827]'}`}`}
                  >
                    <span className={`truncate font-black ${light ? 'text-[#17324d]' : 'text-[#dce5f2]'}`}>{ticket.subject}</span>
                    <span dir="ltr" className={`font-num truncate ${light ? 'text-[#61788f]' : 'text-[#8f9cb0]'}`}>#{ticket.trackingCode}</span>
                    <span className={`w-fit rounded-full px-2 py-1 text-[9px] font-bold ${light ? 'bg-[#e5f6ef] text-[#14805e]' : 'bg-[#123027] text-[#64d7ad]'}`}>{labels[ticket.status]}</span>
                    <span className={`hidden rounded-lg px-2 py-1.5 text-center text-[10px] font-bold sm:block ${light ? 'bg-[#eaf3ff] text-[#2563b9]' : 'bg-[#152136] text-[#6da2ff]'}`}>← {t.view}</span>
                  </button>
                );
              })}
              {visibleTickets.length === 0 && (
                <p className={`px-5 py-10 text-center text-xs ${light ? 'text-[#71859a]' : 'text-[#8290a6]'}`}>{t.noResults}</p>
              )}
            </div>
          </div>

          {active && (
            <article className="flex min-w-0 flex-col p-4 sm:p-6" data-testid="support-ticket-detail">
              <header className={`flex flex-wrap items-start justify-between gap-3 border-b pb-4 ${light ? 'border-[#e6edf4]' : 'border-[#1d2738]'}`}>
                <div>
                  <h3 className={`m-0 text-sm font-black ${light ? 'text-[#102a43]' : 'text-white'}`}>{active.subject}</h3>
                  <p dir="ltr" aria-label={`#${active.trackingCode}`} className={`font-num mt-1 text-[10px] ${light ? 'text-[#71859a]' : 'text-[#79879c]'}`}>
                    <span>#</span><span>{active.trackingCode.slice(0, 2)}</span><span>{active.trackingCode.slice(2)}</span>
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${light ? 'bg-[#e5f6ef] text-[#14805e]' : 'bg-[#123027] text-[#64d7ad]'}`}>{labels[active.status]}</span>
              </header>

              <div className="flex max-h-[330px] min-h-[230px] flex-col gap-4 overflow-y-auto py-5">
                {(active.conversation?.length
                  ? active.conversation
                  : [{
                      id: 'initial', body: active.body, senderType: 'REQUESTER' as const,
                      senderLabel: '', createdAt: active.createdAt,
                      attachments: active.attachments ?? [],
                    }]
                ).map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[88%] rounded-2xl border px-4 py-3 ${message.senderType === 'STAFF' ? light ? 'self-start border-[#d8e2ec] bg-[#f1f5f9]' : 'self-start border-[#364052] bg-[#29313f]' : light ? 'self-end border-[#b9d3f3] bg-[#eaf3ff]' : 'self-end border-[#274b84] bg-[#142743]'}`}
                  >
                    {message.senderLabel && <div className={`mb-2 text-[10px] font-black ${light ? 'text-[#2563b9]' : 'text-[#75a8ff]'}`}>{message.senderLabel}</div>}
                    <p className={`m-0 whitespace-pre-wrap text-xs leading-7 ${light ? 'text-[#29445e]' : 'text-[#d7dfeb]'}`}>{message.body}</p>
                    {message.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2" aria-label={t.attach}>
                        {message.attachments.map((file) => (
                          <button key={file.id} type="button" onClick={() => void downloadFile(file.id, file.fileName)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${light ? 'bg-white text-[#2563b9]' : 'bg-[#0e1725] text-[#79aaff]'}`}>📎 {file.fileName}</button>
                        ))}
                      </div>
                    )}
                    <time className={`font-num mt-2 block text-[9px] ${light ? 'text-[#71859a]' : 'text-[#738196]'}`}>{formatLocaleDateTime(message.createdAt, locale)}</time>
                  </div>
                ))}
              </div>

              {active.status === 'CLOSED' ? (
                <p className="mt-auto rounded-xl bg-[#26171b] px-4 py-3 text-center text-xs font-bold text-[#f08b98]">{t.closedNotice}</p>
              ) : (
                <div className={`mt-auto border-t pt-4 ${light ? 'border-[#e6edf4]' : 'border-[#1d2738]'}`}>
                  <label className="sr-only" htmlFor={`support-reply-${active.id}`}>{t.reply}</label>
                  <textarea
                    id={`support-reply-${active.id}`}
                    aria-label={t.reply}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={t.replyPlaceholder}
                    rows={3}
                    className={`w-full resize-none rounded-xl border p-3 text-xs leading-6 outline-none focus:border-[#4f82e8] ${light ? 'border-[#cedbe8] bg-white text-[#102a43] placeholder:text-[#8797a8]' : 'border-[#1c293b] bg-[#07111a] text-white placeholder:text-[#66758a]'}`}
                  />
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <AttachmentPicker value={attachments} onChange={(files) => setAttachments(files.slice(-1))} disabled={busy} />
                    <button type="button" disabled={busy || reply.trim().length < 2} onClick={() => void sendReply()} className="h-11 rounded-xl bg-[#4f82e8] px-5 text-xs font-black text-white disabled:opacity-50">{t.send}</button>
                  </div>
                  {sendError && <p role="alert" className="mt-2 text-xs text-[#f08b98]">{sendError}</p>}
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
