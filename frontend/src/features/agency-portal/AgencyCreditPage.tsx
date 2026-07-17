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
import { INVOICE_STATUS } from '../agencies/agency-labels';
import type {
  AgencyCredit,
  AgencyCreditRequest,
  AgencyInvoice,
  AgencyLedgerEntry,
} from '../../types/agency-portal';

const LEDGER_LABEL: Record<AgencyLedgerEntry['type'], string> = {
  SALE: 'فروش بلیط',
  REFUND: 'استرداد',
  SETTLEMENT: 'تسویه',
  COMMISSION: 'کمیسیون',
};

const CREDIT_REQUEST_STATUS: Record<AgencyCreditRequest['status'], { label: string; className: string }> = {
  PENDING: { label: 'در انتظار بررسی', className: 'bg-[#f59e0b24] text-[#b45309]' },
  APPROVED: { label: 'تأیید شد', className: 'bg-[#10b98124] text-[#059669]' },
  REJECTED: { label: 'رد شد', className: 'bg-danger/15 text-danger' },
};

export default function AgencyCreditPage() {
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
      .catch(() => setError('خطا در دریافت اطلاعات اعتبار.'));
  }

  useEffect(reload, []);

  async function onPay(invoiceId: string) {
    setPayingId(invoiceId);
    try {
      await payInvoice(invoiceId);
      reload();
    } catch {
      setError('خطا در پرداخت فاکتور.');
    } finally {
      setPayingId(null);
    }
  }

  async function onSubmitRequest() {
    const limitIrr = parseTomanToRial(requestedLimit);
    if (!limitIrr || limitIrr <= 0) {
      setRequestError('سقف درخواستی را وارد کنید.');
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
      setRequestError(err instanceof ApiRequestError ? err.message : 'خطا در ثبت درخواست.');
    } finally {
      setSubmittingRequest(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!credit) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-xl font-black text-ink">اعتبار و مانده</h1>
          <p className="text-sm text-muted">وضعیت اعتبار، فاکتورها و گردش حساب آژانس شما</p>
        </div>
        <button
          onClick={() => setRequestOpen(true)}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
        >
          افزایش اعتبار
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">سقف اعتبار</div>
          <div className="font-num mt-1 text-lg font-black text-ink">{faMoney(credit.limitIrr)} تومان</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">مصرف‌شده</div>
          <div className="font-num mt-1 text-lg font-black text-ink">{faMoney(credit.usedIrr)} تومان</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] text-muted">باقیمانده</div>
          <div className="font-num mt-1 text-lg font-black text-accent">{faMoney(credit.remainingIrr)} تومان</div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">فاکتورها</div>
        {invoices.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">فاکتوری صادر نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted">
                  <th className="py-2 font-bold">شماره فاکتور</th>
                  <th className="py-2 font-bold">سررسید</th>
                  <th className="py-2 font-bold">مبلغ</th>
                  <th className="py-2 font-bold">وضعیت</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status];
                  return (
                    <tr key={inv.id} className="border-b border-border/60">
                      <td className="py-2.5">
                        <span className="ltr font-num">{inv.invoiceNo}</span>
                      </td>
                      <td className="font-num py-2.5">{formatJalaliDate(inv.dueAt)}</td>
                      <td className="font-num py-2.5 font-bold">{faMoney(inv.amountIrr)} تومان</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {inv.status !== 'PAID' && (
                          <button
                            disabled={payingId === inv.id}
                            onClick={() => void onPay(inv.id)}
                            className="rounded-md bg-[#10b98118] px-2.5 py-1 text-[10px] font-bold text-[#059669] transition hover:bg-[#10b98130] disabled:opacity-60"
                          >
                            {payingId === inv.id ? 'در حال پرداخت…' : 'پرداخت از اعتبار'}
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
          <div className="mb-4 text-sm font-bold text-ink">درخواست‌های افزایش اعتبار</div>
          <div className="flex flex-col gap-2">
            {creditRequests.map((r) => {
              const st = CREDIT_REQUEST_STATUS[r.status];
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <span className="font-num font-bold">{faMoney(r.requestedLimitIrr)} تومان</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 text-sm font-bold text-ink">گردش حساب اخیر</div>
        {ledger.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">تراکنشی ثبت نشده است.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div>
                  <div className="font-bold">{LEDGER_LABEL[entry.type]}</div>
                  <div className="text-[10px] text-muted">{formatJalaliDateTime(entry.occurredAt)}</div>
                </div>
                <span className={`font-num font-bold ${entry.signedAmountIrr < 0 ? 'text-[#059669]' : 'text-danger'}`}>
                  {entry.signedAmountIrr < 0 ? '+' : '−'}
                  {faMoney(Math.abs(entry.signedAmountIrr))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {requestOpen && (
        <Modal title="درخواست افزایش اعتبار" onClose={() => setRequestOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted">
              درخواست شما برای بررسی به واحد بازرگانی/مالی ارسال می‌شود و تنها پس از تأیید، سقف اعتبار تغییر
              می‌کند.
            </p>
            <div>
              <label htmlFor="requestedLimit" className="mb-1.5 block text-[11.5px] text-muted">
                سقف درخواستی (تومان)
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
                یادداشت (اختیاری)
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
              {submittingRequest ? 'در حال ارسال…' : 'ارسال درخواست'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
