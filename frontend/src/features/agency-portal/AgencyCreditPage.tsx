import { useEffect, useState } from 'react';
import {
  fetchCredit,
  fetchInvoices,
  fetchLedger,
  fetchMyCreditRequests,
  payInvoice,
  requestCreditIncrease,
} from '../../api/agency-portal';
import { faMoney, parseTomanToRial } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import { ApiRequestError } from '../../api/envelope';
import Modal from '../../components/Modal';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type {
  AgencyCredit,
  AgencyCreditRequest,
  AgencyInvoice,
  AgencyLedgerEntry,
} from '../../types/agency-portal';

// اعتبار و مانده — EN strings mostly extracted from design-reference-v2/
// پنل آژانس.dc.html's own isEN vocabulary for this exact tab
// (creditBalanceTitle, creditLimitLabel, payFromCreditLabel, etc.); AR
// there is partial, filled in by hand to the same quality bar. This page
// deliberately keeps its OWN local invoice/credit-request status maps
// (not the shared `agency-labels.ts` used by the staff-side
// AgencyDetailPage) — that module stays Persian-only since staff panels
// are not locale-switchable per CLAUDE.md, and this agency-facing page's
// own fa wording ("تسویه شد" for paid) already differs slightly from the
// staff copy ("تسویه شد" vs the shared map's identical label, kept as-is
// here to avoid touching a module another still-fa-only surface depends on).
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

const INVOICE_STATUS_LOCAL: Record<AgencyInvoice['status'], { label: Tr; className: string }> = {
  PAID: { label: { fa: 'تسویه شد', en: 'Settled', ar: 'تمت التسوية' }, className: 'bg-[#10b98124] text-[#059669]' },
  UNPAID: { label: { fa: 'در انتظار پرداخت', en: 'Awaiting Payment', ar: 'بانتظار الدفع' }, className: 'bg-[#f59e0b24] text-[#b45309]' },
  OVERDUE: { label: { fa: 'معوق', en: 'Overdue', ar: 'متأخر' }, className: 'bg-danger/15 text-danger' },
};

const CREDIT_REQUEST_STATUS: Record<AgencyCreditRequest['status'], { label: Tr; className: string }> = {
  PENDING: { label: { fa: 'در انتظار بررسی', en: 'Under Review', ar: 'قيد المراجعة' }, className: 'bg-[#f59e0b24] text-[#b45309]' },
  APPROVED: { label: { fa: 'تأیید شد', en: 'Approved', ar: 'تمت الموافقة' }, className: 'bg-[#10b98124] text-[#059669]' },
  REJECTED: { label: { fa: 'رد شد', en: 'Rejected', ar: 'مرفوض' }, className: 'bg-danger/15 text-danger' },
};

const STR: Record<StoredLocale, {
  heading: string;
  subtitle: string;
  addCreditBtn: string;
  loading: string;
  errorFallback: string;
  payErrorFallback: string;
  toman: string;
  creditLimitLabel: string;
  creditUsedLabel: string;
  creditRemainingLabel: string;
  invoicesHeading: string;
  invoicesEmpty: string;
  colInvoiceNo: string;
  colDueDate: string;
  colAmount: string;
  colStatus: string;
  payBtn: string;
  payingBtn: string;
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
}> = {
  fa: {
    heading: 'اعتبار و مانده',
    subtitle: 'وضعیت اعتبار، فاکتورها و گردش حساب آژانس شما',
    addCreditBtn: 'افزایش اعتبار',
    loading: 'در حال بارگذاری…',
    errorFallback: 'خطا در دریافت اطلاعات اعتبار.',
    payErrorFallback: 'خطا در پرداخت فاکتور.',
    toman: 'تومان',
    creditLimitLabel: 'سقف اعتبار',
    creditUsedLabel: 'مصرف‌شده',
    creditRemainingLabel: 'باقیمانده',
    invoicesHeading: 'فاکتورها',
    invoicesEmpty: 'فاکتوری صادر نشده است.',
    colInvoiceNo: 'شماره فاکتور',
    colDueDate: 'سررسید',
    colAmount: 'مبلغ',
    colStatus: 'وضعیت',
    payBtn: 'پرداخت از اعتبار',
    payingBtn: 'در حال پرداخت…',
    creditRequestsHeading: 'درخواست‌های افزایش اعتبار',
    ledgerHeading: 'گردش حساب اخیر',
    ledgerEmpty: 'تراکنشی ثبت نشده است.',
    modalTitle: 'درخواست افزایش اعتبار',
    modalDesc: 'درخواست شما برای بررسی به واحد بازرگانی/مالی ارسال می‌شود و تنها پس از تأیید، سقف اعتبار تغییر می‌کند.',
    requestedLimitLabel: 'سقف درخواستی (تومان)',
    noteLabel: 'یادداشت (اختیاری)',
    requestedLimitRequired: 'سقف درخواستی را وارد کنید.',
    requestSubmitFallback: 'خطا در ثبت درخواست.',
    submitBtn: 'ارسال درخواست',
    submittingBtn: 'در حال ارسال…',
  },
  en: {
    heading: 'Credit & Balance',
    subtitle: "Your agency's credit status, invoices, and account activity",
    addCreditBtn: 'Add Credit',
    loading: 'Loading…',
    errorFallback: 'Error loading credit information.',
    payErrorFallback: 'Error paying the invoice.',
    toman: 'Toman',
    creditLimitLabel: 'Credit Limit',
    creditUsedLabel: 'Used',
    creditRemainingLabel: 'Remaining',
    invoicesHeading: 'Invoices',
    invoicesEmpty: 'No invoices issued yet.',
    colInvoiceNo: 'Invoice Number',
    colDueDate: 'Due Date',
    colAmount: 'Amount',
    colStatus: 'Status',
    payBtn: 'Pay from Credit',
    payingBtn: 'Paying…',
    creditRequestsHeading: 'Credit Increase Requests',
    ledgerHeading: 'Recent Account Activity',
    ledgerEmpty: 'No transactions recorded yet.',
    modalTitle: 'Credit Increase Request',
    modalDesc: 'Your request is sent to the commercial/finance team for review; the credit limit only changes once approved.',
    requestedLimitLabel: 'Requested Limit (Toman)',
    noteLabel: 'Note (optional)',
    requestedLimitRequired: 'Enter the requested limit.',
    requestSubmitFallback: 'Error submitting the request.',
    submitBtn: 'Submit Request',
    submittingBtn: 'Sending…',
  },
  ar: {
    heading: 'الرصيد والائتمان',
    subtitle: 'حالة رصيد وكالتك وفواتيرها ونشاط حسابها',
    addCreditBtn: 'إضافة رصيد',
    loading: 'جارٍ التحميل…',
    errorFallback: 'خطأ في تحميل معلومات الرصيد.',
    payErrorFallback: 'خطأ في دفع الفاتورة.',
    toman: 'تومان',
    creditLimitLabel: 'سقف الائتمان',
    creditUsedLabel: 'المستخدم',
    creditRemainingLabel: 'المتبقي',
    invoicesHeading: 'الفواتير',
    invoicesEmpty: 'لم تصدر أي فاتورة بعد.',
    colInvoiceNo: 'رقم الفاتورة',
    colDueDate: 'تاريخ الاستحقاق',
    colAmount: 'المبلغ',
    colStatus: 'الحالة',
    payBtn: 'الدفع من الرصيد',
    payingBtn: 'جارٍ الدفع…',
    creditRequestsHeading: 'طلبات زيادة الرصيد',
    ledgerHeading: 'نشاط الحساب الأخير',
    ledgerEmpty: 'لا توجد معاملات مسجّلة بعد.',
    modalTitle: 'طلب زيادة الرصيد',
    modalDesc: 'يُرسل طلبك إلى فريق المبيعات/المالية للمراجعة؛ لا يتغيّر سقف الرصيد إلا بعد الموافقة عليه.',
    requestedLimitLabel: 'الحد المطلوب (تومان)',
    noteLabel: 'ملاحظة (اختياري)',
    requestedLimitRequired: 'أدخل الحد المطلوب.',
    requestSubmitFallback: 'خطأ في إرسال الطلب.',
    submitBtn: 'إرسال الطلب',
    submittingBtn: 'جارٍ الإرسال…',
  },
};

export default function AgencyCreditPage() {
  const { locale } = useLocale();
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, []);

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

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!credit) return <p className="p-8 text-sm text-muted">{t.loading}</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-end">
        <button
          onClick={() => setRequestOpen(true)}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
        >
          {t.addCreditBtn}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">{t.creditLimitLabel}</div>
          <div className="font-num mt-1 text-lg font-black text-ink">{faMoney(credit.limitIrr)} {t.toman}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">{t.creditUsedLabel}</div>
          <div className="font-num mt-1 text-lg font-black text-ink">{faMoney(credit.usedIrr)} {t.toman}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">{t.creditRemainingLabel}</div>
          <div className="font-num mt-1 text-lg font-black text-accent">{faMoney(credit.remainingIrr)} {t.toman}</div>
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
                        <span className="ltr font-num">{inv.invoiceNo}</span>
                      </td>
                      <td className="font-num py-2.5">{formatJalaliDate(inv.dueAt)}</td>
                      <td className="font-num py-2.5 font-bold">{faMoney(inv.amountIrr)} {t.toman}</td>
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
        )}
      </div>

      {creditRequests.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-white p-5">
          <div className="mb-4 text-sm font-bold text-ink">{t.creditRequestsHeading}</div>
          <div className="flex flex-col gap-2">
            {creditRequests.map((r) => {
              const st = CREDIT_REQUEST_STATUS[r.status];
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <span className="font-num font-bold">{faMoney(r.requestedLimitIrr)} {t.toman}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label[locale]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                <span className={`font-num font-bold ${Number(entry.signedAmountIrr) < 0 ? 'text-[#059669]' : 'text-danger'}`}>
                  {Number(entry.signedAmountIrr) < 0 ? '+' : '−'}
                  {faMoney(Math.abs(Number(entry.signedAmountIrr)))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {requestOpen && (
        <Modal title={t.modalTitle} onClose={() => setRequestOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted">{t.modalDesc}</p>
            <div>
              <label htmlFor="requestedLimit" className="mb-1.5 block text-[11.5px] text-muted">
                {t.requestedLimitLabel}
              </label>
              <input
                id="requestedLimit"
                className="font-num w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div>
              <label htmlFor="requestNote" className="mb-1.5 block text-[11.5px] text-muted">
                {t.noteLabel}
              </label>
              <textarea
                id="requestNote"
                className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={2}
              />
            </div>
            {requestError && (
              <p role="alert" className="text-xs text-danger">
                {requestError}
              </p>
            )}
            <button
              disabled={submittingRequest}
              onClick={() => void onSubmitRequest()}
              className="rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {submittingRequest ? t.submittingBtn : t.submitBtn}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
