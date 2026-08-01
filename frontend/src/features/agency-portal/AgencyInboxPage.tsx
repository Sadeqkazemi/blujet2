import { useEffect, useState, type FormEvent } from 'react';
import { fetchInbox, postInboxMessage } from '../../api/agency-portal';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { AgencyMessage } from '../../types/agency-portal';

const STR: Record<
  StoredLocale,
  {
    heading: string;
    subtitle: string;
    errorFallback: string;
    sendErrorFallback: string;
    loading: string;
    inboxTitle: string;
    empty: string;
    youLabel: string;
    airlineLabel: string;
    replyTag: string;
    noticeTag: string;
    replyPlaceholder: string;
    sendReplyBtn: string;
    selectPrompt: string;
  }
> = {
  fa: {
    heading: 'کارتابل و پیام‌ها',
    subtitle: 'مکاتبه مستقیم با واحد بازرگانی blujet',
    errorFallback: 'خطا در دریافت پیام‌ها.',
    sendErrorFallback: 'خطا در ارسال پیام.',
    loading: 'در حال بارگذاری…',
    inboxTitle: 'صندوق پیام‌ها',
    empty: 'هنوز پیامی وجود ندارد.',
    youLabel: 'شما',
    airlineLabel: 'blujet',
    replyTag: 'پاسخ',
    noticeTag: 'اطلاعیه',
    replyPlaceholder: 'پاسخ خود را بنویسید…',
    sendReplyBtn: 'ارسال پاسخ',
    selectPrompt: 'یک پیام از لیست انتخاب کنید.',
  },
  en: {
    heading: 'Inbox & Messages',
    subtitle: "Direct correspondence with blujet's commercial team",
    errorFallback: 'Error loading messages.',
    sendErrorFallback: 'Error sending the message.',
    loading: 'Loading…',
    inboxTitle: 'Inbox',
    empty: 'No messages yet.',
    youLabel: 'You',
    airlineLabel: 'blujet',
    replyTag: 'Reply',
    noticeTag: 'Notice',
    replyPlaceholder: 'Write your reply…',
    sendReplyBtn: 'Send reply',
    selectPrompt: 'Select a message from the list.',
  },
  ar: {
    heading: 'الوارد والرسائل',
    subtitle: 'تواصل مباشر مع فريق blujet التجاري',
    errorFallback: 'خطأ في تحميل الرسائل.',
    sendErrorFallback: 'خطأ في إرسال الرسالة.',
    loading: 'جارٍ التحميل…',
    inboxTitle: 'صندوق الرسائل',
    empty: 'لا توجد رسائل بعد.',
    youLabel: 'أنت',
    airlineLabel: 'blujet',
    replyTag: 'رد',
    noticeTag: 'إشعار',
    replyPlaceholder: 'اكتب ردك…',
    sendReplyBtn: 'إرسال الرد',
    selectPrompt: 'اختر رسالة من القائمة.',
  },
};

function messageFrom(m: AgencyMessage, locale: StoredLocale, t: (typeof STR)['fa']) {
  return m.senderIsAgency ? t.youLabel : t.airlineLabel;
}

function messageInitial(m: AgencyMessage, locale: StoredLocale, t: (typeof STR)['fa']) {
  const from = messageFrom(m, locale, t);
  if (from === 'blujet') return 'BJ';
  return locale === 'en' ? 'YO' : locale === 'ar' ? 'أن' : 'ش';
}

function messageSubject(body: string): string {
  const line = body.split('\n').find((l) => l.trim()) ?? body;
  return line.length > 56 ? `${line.slice(0, 53)}…` : line;
}

function messageTag(m: AgencyMessage, t: (typeof STR)['fa']) {
  if (m.senderIsAgency) {
    return { label: t.replyTag, color: '#1668c4', bg: '#eef4fb' };
  }
  return { label: t.noticeTag, color: '#1f8a5b', bg: '#eaf7f0' };
}

export default function AgencyInboxPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [messages, setMessages] = useState<AgencyMessage[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  function reload() {
    fetchInbox()
      .then((msgs) => {
        setMessages(msgs);
        setSelectedId((prev) => {
          if (prev && msgs.some((m) => m.id === prev)) return prev;
          return msgs[0]?.id ?? null;
        });
      })
      .catch(() => setError(t.errorFallback));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, []);

  const selected = messages?.find((m) => m.id === selectedId) ?? null;

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

  if (error) return <p style={{ fontSize: 13, color: '#e5484d' }}>{error}</p>;
  if (!messages) return <p style={{ fontSize: 13, color: '#8a96a6' }}>{t.loading}</p>;

  const selectedTag = selected ? messageTag(selected, t) : null;

  return (
    <div data-testid="agency-inbox">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', margin: 0 }}>{t.heading}</h1>
        <div style={{ fontSize: 11.5, color: '#7a8696', marginTop: 3 }}>{t.subtitle}</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 13,
          alignItems: 'stretch',
        }}
      >
        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 12px',
              borderBottom: '1px solid #eef2f7',
              fontSize: 13,
              fontWeight: 800,
              color: '#0d2640',
            }}
          >
            {t.inboxTitle}
          </div>
          {messages.length === 0 ? (
            <p style={{ padding: '26px 14px', textAlign: 'center', color: '#8a96a6', fontSize: 11.5, margin: 0 }}>
              {t.empty}
            </p>
          ) : (
            messages.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid="agency-inbox-item"
                  onClick={() => {
                    setSelectedId(m.id);
                    setBody('');
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'inherit',
                    padding: '11px 12px',
                    border: 'none',
                    borderBottom: '1px solid #f4f6fa',
                    cursor: 'pointer',
                    background: active ? '#f4f8fc' : '#fff',
                    borderInlineEnd: `3px solid ${active ? '#1668c4' : 'transparent'}`,
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0d2640' }}>
                      {messageFrom(m, locale, t)}
                    </span>
                    <span style={{ fontSize: 10, color: '#9aa4b2' }}>{formatJalaliDateTime(m.createdAt)}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: '#5a6678',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {messageSubject(m.body)}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 14,
            padding: 16,
            minHeight: isMobile ? 280 : 340,
          }}
        >
          {!selected ? (
            <p style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: '#8a96a6', margin: 0 }}>
              {t.selectPrompt}
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 13,
                  borderBottom: '1px solid #eef2f7',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: '#eef4fb',
                      color: '#1668c4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 11.5,
                      flex: 'none',
                    }}
                  >
                    {messageInitial(selected, locale, t)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640' }}>
                      {messageFrom(selected, locale, t)}
                    </div>
                    <div style={{ fontSize: 11, color: '#8a96a6' }}>{formatJalaliDateTime(selected.createdAt)}</div>
                  </div>
                </div>
                {selectedTag && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: selectedTag.color,
                      background: selectedTag.bg,
                      padding: '4px 9px',
                      borderRadius: 8,
                    }}
                  >
                    {selectedTag.label}
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: 15.5, fontWeight: 800, color: '#0d2640', margin: '18px 0 12px' }}>
                {messageSubject(selected.body)}
              </h3>
              <p
                data-testid="agency-inbox-body"
                style={{ fontSize: 12.5, lineHeight: 1.85, color: '#3f546b', margin: 0, whiteSpace: 'pre-line' }}
              >
                {selected.body}
              </p>

              <form
                onSubmit={onSend}
                style={{
                  marginTop: 24,
                  paddingTop: 15,
                  borderTop: '1px solid #eef2f7',
                  display: 'flex',
                  gap: 8,
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                }}
              >
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t.replyPlaceholder}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 46,
                    background: '#f6f8fb',
                    border: '1px solid #e3e9f1',
                    borderRadius: 11,
                    padding: '0 13px',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    color: '#16202e',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  style={{
                    height: 46,
                    padding: '0 20px',
                    background: '#1668c4',
                    color: '#fff',
                    borderRadius: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: sending || !body.trim() ? 0.6 : 1,
                    flex: isMobile ? '1 1 100%' : 'none',
                    justifyContent: 'center',
                  }}
                >
                  {t.sendReplyBtn}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
