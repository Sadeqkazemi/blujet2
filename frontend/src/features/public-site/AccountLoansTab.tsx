import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  createLoanApplication,
  fetchMyLoanApplications,
  syncMyLoanApplication,
} from '../../api/loans';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { localeMoney, parseTomanToRialString } from '../../lib/fa-format';
import { tomanAmountInWords } from '../../lib/amount-in-words';
import { formatLocaleDateTime } from '../../lib/locale-format';
import type { LoanApplication, LoanDisplayStatus } from '../../types/loans';
import MoneyInput from '../../components/MoneyInput';

const COPY: Record<StoredLocale, {
  title: string; subtitle: string; amount: string; submit: string; history: string;
  empty: string; sync: string; reference: string; toman: string; validation: string;
  loadError: string; createError: string;
}> = {
  fa: {
    title: 'وام و اعتبارات',
    subtitle: 'درخواست مستقیماً برای بانک ارسال می‌شود و وضعیت فقط از API بانک دریافت خواهد شد.',
    amount: 'مبلغ درخواستی (تومان)', submit: 'ارسال درخواست به بانک', history: 'سوابق درخواست‌ها',
    empty: 'هنوز درخواست وامی ثبت نشده است.', sync: 'استعلام وضعیت', reference: 'شناسه بانک', toman: 'تومان',
    validation: 'مبلغ معتبر و بیشتر از صفر وارد کنید.', loadError: 'دریافت درخواست‌های وام انجام نشد.',
    createError: 'ارسال درخواست به بانک انجام نشد.',
  },
  en: {
    title: 'Loans & Credit', subtitle: 'Applications are sent directly to the bank and statuses come only from its API.',
    amount: 'Requested amount (Toman)', submit: 'Send to bank', history: 'Applications', empty: 'No loan application yet.',
    sync: 'Refresh status', reference: 'Bank reference', toman: 'Toman', validation: 'Enter a valid amount greater than zero.',
    loadError: 'Could not load loan applications.', createError: 'Could not send the application to the bank.',
  },
  ar: {
    title: 'القروض والائتمان', subtitle: 'يُرسل الطلب مباشرة إلى البنك وتُجلب الحالة فقط من واجهة البنك.',
    amount: 'المبلغ المطلوب (تومان)', submit: 'إرسال إلى البنك', history: 'الطلبات السابقة', empty: 'لا يوجد طلب قرض بعد.',
    sync: 'تحديث الحالة', reference: 'مرجع البنك', toman: 'تومان', validation: 'أدخل مبلغاً صحيحاً أكبر من صفر.',
    loadError: 'تعذر تحميل طلبات القرض.', createError: 'تعذر إرسال الطلب إلى البنك.',
  },
};

const STATUS: Record<LoanDisplayStatus, Record<StoredLocale, string>> = {
  processing: { fa: 'در حال ارسال', en: 'Processing', ar: 'قيد الإرسال' },
  awaiting_bank: { fa: 'در انتظار بانک', en: 'Awaiting bank', ar: 'بانتظار البنك' },
  under_review: { fa: 'در حال بررسی بانک', en: 'Under review', ar: 'قيد المراجعة' },
  approved: { fa: 'تأیید بانک', en: 'Approved', ar: 'مقبول' },
  rejected: { fa: 'رد بانک', en: 'Rejected', ar: 'مرفوض' },
  disbursed: { fa: 'پرداخت‌شده', en: 'Disbursed', ar: 'تم الصرف' },
  cancelled: { fa: 'لغوشده', en: 'Cancelled', ar: 'ملغي' },
  failed: { fa: 'ناموفق', en: 'Failed', ar: 'فشل' },
  unknown: { fa: 'نامشخص', en: 'Unknown', ar: 'غير معروف' },
};

export default function AccountLoansTab() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [items, setItems] = useState<LoanApplication[] | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await fetchMyLoanApplications()).items);
    } catch {
      setError(t.loadError);
    }
  }, [t.loadError]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let requestedAmountIrr: string | null;
    try {
      requestedAmountIrr = parseTomanToRialString(amount);
      if (!requestedAmountIrr || BigInt(requestedAmountIrr) <= 0n) throw new Error('invalid');
    } catch {
      setError(t.validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createLoanApplication(requestedAmountIrr, crypto.randomUUID());
      setAmount('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.createError);
    } finally {
      setBusy(false);
    }
  }

  async function sync(row: LoanApplication) {
    setSyncingId(row.id);
    setError(null);
    try {
      const updated = await syncMyLoanApplication(row.id);
      setItems((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.loadError);
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="account-loans-tab">
      <section className="rounded-2xl border border-[#e8eef6] bg-white p-5">
        <h2 className="text-base font-black text-[#0d2640]">{t.title}</h2>
        <p className="mt-2 text-xs leading-6 text-[#6b7787]">{t.subtitle}</p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-bold text-[#3f546b]">
            {t.amount}
            <MoneyInput
              id="loan-amount-input"
              testId="loan-amount-input"
              theme="light"
              locale={locale}
              valueToman={amount}
              onChangeToman={setAmount}
              placeholder={locale === 'fa' ? '۰' : '0'}
              className="mt-2"
            />
            {tomanAmountInWords(amount, locale) && (
              <div
                data-testid="loan-amount-words"
                className="mt-2 text-[11.5px] font-semibold leading-6 text-[#8a96a6]"
              >
                {tomanAmountInWords(amount, locale)}
              </div>
            )}
          </label>
          <button disabled={busy} className="h-12 rounded-xl bg-[#1668c4] px-6 text-xs font-black text-white disabled:opacity-60">
            {busy ? '…' : t.submit}
          </button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
      </section>

      <section className="rounded-2xl border border-[#e8eef6] bg-white p-5">
        <h3 className="mb-4 text-sm font-black text-[#0d2640]">{t.history}</h3>
        {items === null ? <p className="text-center text-xs text-[#8a96a6]">…</p> : items.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#8a96a6]">{t.empty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((row) => (
              <article key={row.id} className="rounded-xl border border-[#edf1f6] bg-[#fafbfd] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-num text-base font-black text-[#1668c4]">{localeMoney(row.requestedAmountIrr, locale)} <small>{t.toman}</small></div>
                    <div className="mt-1 text-[11px] text-[#8a96a6]">{formatLocaleDateTime(row.createdAt, locale)}</div>
                    {row.bankReferenceId && <div className="mt-1 text-[11px] text-[#6b7787]">{t.reference}: <span dir="ltr" className="font-num">{row.bankReferenceId}</span></div>}
                  </div>
                  <span className="rounded-full bg-[#eaf2fc] px-3 py-1 text-[11px] font-black text-[#1668c4]">{STATUS[row.displayStatus]?.[locale] ?? row.displayStatus}</span>
                </div>
                {row.bankReferenceId && !['disbursed', 'rejected', 'cancelled'].includes(row.displayStatus) && (
                  <button type="button" onClick={() => void sync(row)} disabled={syncingId === row.id} className="mt-3 text-xs font-black text-[#1668c4] disabled:opacity-50">
                    {syncingId === row.id ? '…' : t.sync}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
