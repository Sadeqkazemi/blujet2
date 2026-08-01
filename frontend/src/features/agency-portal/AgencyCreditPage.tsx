import { useEffect, useState } from 'react';
import {
  fetchCredit,
  fetchInvoices,
  fetchLedger,
  fetchMyCreditRequests,
  payInvoice,
  requestCreditIncrease,
} from '../../api/agency-portal';
import { faDigits, faMoney, parseTomanToRial } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import { ApiRequestError } from '../../api/envelope';
import Modal from '../../components/Modal';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type {
  AgencyCredit,
  AgencyCreditRequest,
  AgencyInvoice,
  AgencyLedgerEntry,
} from '../../types/agency-portal';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const LEDGER_LABEL: Record<AgencyLedgerEntry['type'], Tr> = {
  SALE: { fa: 'فروش بلیط', en: 'Ticket Sale', ar: 'بيع تذكرة' },
  REFUND: { fa: 'استرداد', en: 'Refund', ar: 'استرداد' },
  SETTLEMENT: { fa: 'تسویه', en: 'Settlement', ar: 'تسوية' },
  COMMISSION: { fa: 'کمیسیون', en: 'Commission', ar: 'عمولة' },
};

const LEDGER_STYLE: Record<AgencyLedgerEntry['type'], { color: string; bg: string }> = {
  SALE: { color: '#e8553a', bg: '#fdecec' },
  REFUND: { color: '#1f8a5b', bg: '#eaf7f0' },
  SETTLEMENT: { color: '#1668c4', bg: '#eef4fb' },
  COMMISSION: { color: '#1f8a5b', bg: '#eaf7f0' },
};

const INVOICE_STATUS: Record<
  AgencyInvoice['status'],
  { label: Tr; color: string; bg: string }
> = {
  PAID: {
    label: { fa: 'پرداخت‌شده', en: 'Paid', ar: 'مدفوع' },
    color: '#1f8a5b',
    bg: '#eaf7f0',
  },
  UNPAID: {
    label: { fa: 'در انتظار پرداخت', en: 'Awaiting Payment', ar: 'بانتظار الدفع' },
    color: '#e8893a',
    bg: '#fdf1e7',
  },
  OVERDUE: {
    label: { fa: 'معوق', en: 'Overdue', ar: 'متأخر' },
    color: '#e8553a',
    bg: '#fdecec',
  },
};

const CREDIT_REQUEST_STATUS: Record<AgencyCreditRequest['status'], { label: Tr; color: string; bg: string }> = {
  PENDING: {
    label: { fa: 'در انتظار بررسی', en: 'Under Review', ar: 'قيد المراجعة' },
    color: '#e8893a',
    bg: '#fdf1e7',
  },
  APPROVED: {
    label: { fa: 'تأیید شد', en: 'Approved', ar: 'تمت الموافقة' },
    color: '#1f8a5b',
    bg: '#eaf7f0',
  },
  REJECTED: {
    label: { fa: 'رد شد', en: 'Rejected', ar: 'مرفوض' },
    color: '#e8553a',
    bg: '#fdecec',
  },
};

const STR: Record<
  StoredLocale,
  {
    heading: string;
    subtitle: string;
    sectionTitle: string;
    addCreditBtn: string;
    loading: string;
    errorFallback: string;
    payErrorFallback: string;
    toman: string;
    creditLimitLabel: string;
    creditUsedLabel: string;
    creditRemainingLabel: string;
    invoicesTitle: string;
    invoicesPendingLabel: string;
    invoiceDesc: string;
    issuedOnLabel: string;
    dueOnLabel: string;
    payBtn: string;
    payingBtn: string;
    paidLabel: string;
    invoicesEmpty: string;
    creditRequestsHeading: string;
    ledgerHeading: string;
    ledgerEmpty: string;
    modalTitle: string;
    modalDesc: string;
    requestedLimitLabel: string;
    noteLabel: string;
    requestedLimitRequired: string;
    requestSubmitFallback: string;
    submitBtn: string;
    submittingBtn: string;
  }
> = {
  fa: {
    heading: 'اعتبار و موجودی',
    subtitle: 'سقف اعتبار، فاکتورهای شرکت هواپیمایی و فعالیت حساب',
    sectionTitle: 'اعتبار و مانده حساب',
    addCreditBtn: 'افزایش اعتبار',
    loading: 'در حال بارگذاری…',
    errorFallback: 'خطا در دریافت اطلاعات اعتبار.',
    payErrorFallback: 'خطا در پرداخت فاکتور.',
    toman: 'تومان',
    creditLimitLabel: 'سقف اعتبار',
    creditUsedLabel: 'مصرف‌شده',
    creditRemainingLabel: 'باقیمانده',
    invoicesTitle: 'فاکتورهای صادرشده توسط ایرلاین',
    invoicesPendingLabel: 'فاکتور در انتظار پرداخت',
    invoiceDesc: 'فاکتور دوره‌ای',
    issuedOnLabel: 'صدور',
    dueOnLabel: 'سررسید',
    payBtn: 'پرداخت از اعتبار',
    payingBtn: 'در حال پرداخت…',
    paidLabel: 'پرداخت‌شده',
    invoicesEmpty: 'فاکتوری صادر نشده است.',
    creditRequestsHeading: 'درخواست‌های افزایش اعتبار',
    ledgerHeading: 'گردش حساب اخیر',
    ledgerEmpty: 'تراکنشی ثبت نشده است.',
    modalTitle: 'درخواست افزایش اعتبار',
    modalDesc:
      'درخواست شما برای بررسی به واحد بازرگانی/مالی ارسال می‌شود و تنها پس از تأیید، سقف اعتبار تغییر می‌کند.',
    requestedLimitLabel: 'سقف درخواستی (تومان)',
    noteLabel: 'یادداشت (اختیاری)',
    requestedLimitRequired: 'سقف درخواستی را وارد کنید.',
    requestSubmitFallback: 'خطا در ثبت درخواست.',
    submitBtn: 'ارسال درخواست',
    submittingBtn: 'در حال ارسال…',
  },
  en: {
    heading: 'Credit & Balance',
    subtitle: 'Credit limit, airline invoices, and account activity',
    sectionTitle: 'Credit & Balance',
    addCreditBtn: 'Add Credit',
    loading: 'Loading…',
    errorFallback: 'Error loading credit information.',
    payErrorFallback: 'Error paying the invoice.',
    toman: 'Toman',
    creditLimitLabel: 'Credit Limit',
    creditUsedLabel: 'Used',
    creditRemainingLabel: 'Remaining',
    invoicesTitle: 'Invoices issued by the airline',
    invoicesPendingLabel: 'invoices pending payment',
    invoiceDesc: 'Periodic invoice',
    issuedOnLabel: 'Issued',
    dueOnLabel: 'Due',
    payBtn: 'Pay from credit',
    payingBtn: 'Paying…',
    paidLabel: 'Paid',
    invoicesEmpty: 'No invoices issued yet.',
    creditRequestsHeading: 'Credit Increase Requests',
    ledgerHeading: 'Recent account activity',
    ledgerEmpty: 'No transactions recorded yet.',
    modalTitle: 'Credit Increase Request',
    modalDesc:
      'Your request is sent to the commercial/finance team for review; the credit limit only changes once approved.',
    requestedLimitLabel: 'Requested Limit (Toman)',
    noteLabel: 'Note (optional)',
    requestedLimitRequired: 'Enter the requested limit.',
    requestSubmitFallback: 'Error submitting the request.',
    submitBtn: 'Submit Request',
    submittingBtn: 'Sending…',
  },
  ar: {
    heading: 'الرصيد والائتمان',
    subtitle: 'سقف الائتمان وفواتير شركة الطيران ونشاط الحساب',
    sectionTitle: 'رصيد الحساب',
    addCreditBtn: 'إضافة رصيد',
    loading: 'جارٍ التحميل…',
    errorFallback: 'خطأ في تحميل معلومات الرصيد.',
    payErrorFallback: 'خطأ في دفع الفاتورة.',
    toman: 'تومان',
    creditLimitLabel: 'سقف الائتمان',
    creditUsedLabel: 'المستخدم',
    creditRemainingLabel: 'المتبقي',
    invoicesTitle: 'فواتير صادرة عن شركة الطيران',
    invoicesPendingLabel: 'فاتورة بانتظار الدفع',
    invoiceDesc: 'فاتورة دورية',
    issuedOnLabel: 'الإصدار',
    dueOnLabel: 'الاستحقاق',
    payBtn: 'الدفع من الرصيد',
    payingBtn: 'جارٍ الدفع…',
    paidLabel: 'مدفوع',
    invoicesEmpty: 'لم تصدر أي فاتورة بعد.',
    creditRequestsHeading: 'طلبات زيادة الرصيد',
    ledgerHeading: 'نشاط الحساب الأخير',
    ledgerEmpty: 'لا توجد معاملات مسجّلة بعد.',
    modalTitle: 'طلب زيادة الرصيد',
    modalDesc:
      'يُرسل طلبك إلى فريق المبيعات/المالية للمراجعة؛ لا يتغيّر سقف الرصيد إلا بعد الموافقة عليه.',
    requestedLimitLabel: 'الحد المطلوب (تومان)',
    noteLabel: 'ملاحظة (اختياري)',
    requestedLimitRequired: 'أدخل الحد المطلوب.',
    requestSubmitFallback: 'خطأ في إرسال الطلب.',
    submitBtn: 'إرسال الطلب',
    submittingBtn: 'جارٍ الإرسال…',
  },
};

const INVOICE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);

export default function AgencyCreditPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [credit, setCredit] = useState<AgencyCredit | null>(null);
  const [invoices, setInvoices] = useState<AgencyInvoice[]>([]);
  const [ledger, setLedger] = useState<AgencyLedgerEntry[]>([]);
  const [creditRequests, setCreditRequests] = useState<AgencyCreditRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestedLimit, setRequestedLimit] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  function reload() {
    Promise.all([fetchCredit(), fetchInvoices(), fetchLedger(), fetchMyCreditRequests()])
      .then(([c, i, l, r]) => {
        setCredit(c);
        setInvoices(i);
        setLedger(l);
        setCreditRequests(r);
      })
      .catch(() => setError(t.errorFallback));
  }

  useEffect(reload, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPay(invoiceId: string) {
    setPayingId(invoiceId);
    try {
      await payInvoice(invoiceId);
      reload();
    } catch {
      setError(t.payErrorFallback);
    } finally {
      setPayingId(null);
    }
  }

  async function onSubmitRequest() {
    const limitIrr = parseTomanToRial(requestedLimit);
    if (!limitIrr || limitIrr <= 0) {
      setRequestError(t.requestedLimitRequired);
      return;
    }
    setRequestError(null);
    setSubmittingRequest(true);
    try {
      await requestCreditIncrease(limitIrr, requestNote.trim() || undefined);
      setRequestOpen(false);
      setRequestedLimit('');
      setRequestNote('');
      reload();
    } catch (err) {
      setRequestError(err instanceof ApiRequestError ? err.message : t.requestSubmitFallback);
    } finally {
      setSubmittingRequest(false);
    }
  }

  if (error) return <p style={{ fontSize: 13, color: '#e5484d' }}>{error}</p>;
  if (!credit) return <p style={{ fontSize: 13, color: '#8a96a6' }}>{t.loading}</p>;

  const unpaidCount = invoices.filter((inv) => inv.status !== 'PAID').length;

  return (
    <div data-testid="agency-credit">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', margin: 0 }}>{t.heading}</h1>
        <div style={{ fontSize: 11.5, color: '#7a8696', marginTop: 3 }}>{t.subtitle}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640' }}>{t.sectionTitle}</span>
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            style={{
              height: 42,
              padding: '0 17px',
              background: '#1668c4',
              color: '#fff',
              borderRadius: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t.addCreditBtn}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 13,
          }}
        >
          {(
            [
              [t.creditLimitLabel, faMoney(credit.limitIrr), '#0d2640'],
              [t.creditUsedLabel, faMoney(credit.usedIrr), '#e8553a'],
              [t.creditRemainingLabel, faMoney(credit.remainingIrr), '#1f8a5b'],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: '#8a96a6' }}>{label}</div>
              <div style={{ fontSize: 20.5, fontWeight: 900, color, marginTop: 6 }}>
                {value} <span style={{ fontSize: 11, fontWeight: 400 }}>{t.toman}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, overflow: 'hidden' }}>
          <div
            style={{
              padding: '11px 14px',
              borderBottom: '1px solid #eef2f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640' }}>{t.invoicesTitle}</span>
            {unpaidCount > 0 && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#e8893a',
                  background: '#fdf1e7',
                  border: '1px solid #f7e0c4',
                  padding: '4px 10px',
                  borderRadius: 14,
                }}
              >
                {faDigits(unpaidCount)} {t.invoicesPendingLabel}
              </span>
            )}
          </div>
          {invoices.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a96a6', margin: 0 }}>{t.invoicesEmpty}</p>
          ) : (
            invoices.map((inv) => {
              const st = INVOICE_STATUS[inv.status];
              const isPaid = inv.status === 'PAID';
              return (
                <div
                  key={inv.id}
                  data-testid="agency-invoice-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 11,
                    padding: '12px 14px',
                    borderBottom: '1px solid #f4f6fa',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: '#eef4fb',
                        color: '#1668c4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      {INVOICE_ICON}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#16202e' }}>{t.invoiceDesc}</div>
                      <div style={{ fontSize: 10.5, color: '#8a96a6', marginTop: 3 }}>
                        <span dir="ltr">{inv.invoiceNo}</span>
                        {' · '}
                        {t.issuedOnLabel} {formatJalaliDate(inv.issuedAt)}
                        {' · '}
                        {t.dueOnLabel} {formatJalaliDate(inv.dueAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: locale === 'en' ? 'left' : 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0d2640' }}>
                        {faMoney(inv.amountIrr)} {t.toman}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: st.color, marginTop: 2 }}>{st.label[locale]}</div>
                    </div>
                    {!isPaid ? (
                      <button
                        type="button"
                        disabled={payingId === inv.id}
                        onClick={() => void onPay(inv.id)}
                        style={{
                          height: 40,
                          padding: '0 16px',
                          background: '#1668c4',
                          color: '#fff',
                          borderRadius: 10,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          opacity: payingId === inv.id ? 0.7 : 1,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <path d="M2 10h20" />
                        </svg>
                        {payingId === inv.id ? t.payingBtn : t.payBtn}
                      </button>
                    ) : (
                      <span
                        style={{
                          height: 40,
                          padding: '0 15px',
                          background: '#eaf7f0',
                          color: '#1f8a5b',
                          border: '1px solid #cdeede',
                          borderRadius: 10,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        {t.paidLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {creditRequests.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d2640', marginBottom: 12 }}>{t.creditRequestsHeading}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {creditRequests.map((r) => {
                const st = CREDIT_REQUEST_STATUS[r.status];
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      border: '1px solid #f4f6fa',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>
                      {faMoney(r.requestedLimitIrr)} {t.toman}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: st.color,
                        background: st.bg,
                        padding: '4px 10px',
                        borderRadius: 14,
                      }}
                    >
                      {st.label[locale]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid #eef2f7', fontSize: 13.5, fontWeight: 800, color: '#0d2640' }}>
            {t.ledgerHeading}
          </div>
          {ledger.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a96a6', margin: 0 }}>{t.ledgerEmpty}</p>
          ) : (
            ledger.map((entry) => {
              const style = LEDGER_STYLE[entry.type];
              const isCredit = Number(entry.signedAmountIrr) < 0;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderBottom: '1px solid #f4f6fa',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        background: style.bg,
                        color: style.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {entry.type === 'SALE' ? '−' : '+'}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#16202e' }}>{LEDGER_LABEL[entry.type][locale]}</div>
                      <div style={{ fontSize: 11, color: '#8a96a6', marginTop: 2 }}>{formatJalaliDateTime(entry.occurredAt)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isCredit ? '#1f8a5b' : '#e8553a' }}>
                    {isCredit ? '+' : '−'}
                    {faMoney(Math.abs(Number(entry.signedAmountIrr)))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {requestOpen && (
        <Modal title={t.modalTitle} onClose={() => !submittingRequest && setRequestOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: '#5a6678', lineHeight: 1.8, margin: 0 }}>{t.modalDesc}</p>
            <div>
              <label htmlFor="requestedLimit" style={{ display: 'block', fontSize: 11.5, color: '#5a6678', marginBottom: 6 }}>
                {t.requestedLimitLabel}
              </label>
              <input
                id="requestedLimit"
                dir="ltr"
                inputMode="numeric"
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 11,
                  border: '1.5px solid #e3e9f1',
                  background: '#fafbfd',
                  padding: '11px 13px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label htmlFor="requestNote" style={{ display: 'block', fontSize: 11.5, color: '#5a6678', marginBottom: 6 }}>
                {t.noteLabel}
              </label>
              <textarea
                id="requestNote"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 11,
                  border: '1.5px solid #e3e9f1',
                  background: '#fafbfd',
                  padding: '11px 13px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            </div>
            {requestError && (
              <p role="alert" style={{ fontSize: 12, color: '#e5484d', margin: 0 }}>
                {requestError}
              </p>
            )}
            <button
              type="button"
              disabled={submittingRequest}
              onClick={() => void onSubmitRequest()}
              style={{
                border: 'none',
                borderRadius: 11,
                background: '#1668c4',
                color: '#fff',
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: submittingRequest ? 0.7 : 1,
              }}
            >
              {submittingRequest ? t.submittingBtn : t.submitBtn}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
