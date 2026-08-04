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
    <div>
      <div className="mb-6 flex items-center justify-end">
        <button
          onClick={() => setRequestOpen(true)}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">{t.creditLimitLabel}</div>
          <div className="mt-1 text-lg font-black text-ink">{faMoney(credit.limitIrr)} {t.toman}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">{t.creditUsedLabel}</div>
          <div className="mt-1 text-lg font-black text-ink">{faMoney(credit.usedIrr)} {t.toman}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">{t.creditRemainingLabel}</div>
          <div className="mt-1 text-lg font-black text-accent">{faMoney(credit.remainingIrr)} {t.toman}</div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">{t.invoicesHeading}</div>
        {invoices.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t.invoicesEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="py-2 font-bold">{t.colInvoiceNo}</th>
                  <th className="py-2 font-bold">{t.colDueDate}</th>
                  <th className="py-2 font-bold">{t.colAmount}</th>
                  <th className="py-2 font-bold">{t.colStatus}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = INVOICE_STATUS_LOCAL[inv.status];
                  return (
                    <tr key={inv.id} className="border-b border-border/60">
                      <td className="py-2.5">
                        <span className="ltr">{inv.invoiceNo}</span>
                      </td>
                      <td className="py-2.5">{formatJalaliDate(inv.dueAt)}</td>
                      <td className="py-2.5 font-bold">{faMoney(inv.amountIrr)} {t.toman}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>
                          {st.label[locale]}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {inv.status !== 'PAID' && (
                          <button
                            disabled={payingId === inv.id}
                            onClick={() => void onPay(inv.id)}
                            className="rounded-md bg-[#10b98118] px-2.5 py-1 text-[10px] font-bold text-[#059669] transition hover:bg-[#10b98130] disabled:opacity-60"
                          >
                            {payingId === inv.id ? t.payingBtn : t.payBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {invoices.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8a96a6', margin: 0 }}>{t.invoicesEmpty}</p>
          ) : (
            invoices.map((inv) => {
              const st = INVOICE_STATUS[inv.status];
              const isPaid = inv.status === 'PAID';
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <span className="font-bold">{faMoney(r.requestedLimitIrr)} {t.toman}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label[locale]}</span>
                </div>
              );
            })
          )}
        </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">{t.ledgerHeading}</div>
        {ledger.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t.ledgerEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div>
                  <div className="font-bold">{LEDGER_LABEL[entry.type][locale]}</div>
                  <div className="text-[10px] text-muted">{formatJalaliDateTime(entry.occurredAt)}</div>
                </div>
                <span className={`font-bold ${Number(entry.signedAmountIrr) < 0 ? 'text-[#059669]' : 'text-danger'}`}>
                  {Number(entry.signedAmountIrr) < 0 ? '+' : '−'}
                  {faMoney(Math.abs(Number(entry.signedAmountIrr)))}
                </span>
              </div>
            ))}
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
                className="ltr w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm font-bold outline-none focus:border-accent"
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
