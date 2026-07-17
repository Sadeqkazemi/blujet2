import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchAgencyApiKeys,
  fetchAgencyDetail,
  fetchAgencyInvoices,
  fetchAgencyMessages,
  issueAgencyApiKey,
  issueAgencyInvoice,
  payAgencyInvoice,
  postAgencyMessage,
  reactivateAgency,
  remindAgencyInvoice,
  settleAgency,
  suspendAgency,
  updateAgencyApiKey,
  updateAgencyCredit,
} from '../../api/agencies';
import { faDigits, faMoney, parseTomanToRial } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime, parseJalaliDateToIso } from '../../lib/jalali';
import Modal from '../../components/Modal';
import { INVOICE_STATUS, TIER_LABELS, statusBadge } from './agency-labels';
import type {
  AgencyApiKey,
  AgencyApiScope,
  AgencyDetail,
  AgencyInvoice,
  AgencyMessage,
} from '../../types/agencies';

type CommercialTab = 'overview' | 'finance' | 'messages';

const API_SCOPE_OPTIONS: { value: AgencyApiScope; label: string }[] = [
  { value: 'FULL', label: 'کامل (جستجو + رزرو + صدور)' },
  { value: 'SEARCH_BOOK', label: 'جستجو + رزرو' },
  { value: 'SEARCH_ONLY', label: 'فقط جستجو (آزمایشی)' },
];

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-num mt-1 text-lg font-black text-ink">{value}</div>
    </div>
  );
}

export default function AgencyDetailPage() {
  const { agencyId = '' } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const isSenior = role === 'SENIOR_MANAGER';
  const isFinance = role === 'FINANCE_MANAGER';
  const isCommercial = role === 'COMMERCIAL_MANAGER';

  const [detail, setDetail] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<CommercialTab>('overview');

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendError, setSuspendError] = useState<string | null>(null);

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditInput, setCreditInput] = useState('');
  const [creditError, setCreditError] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<AgencyApiKey[]>([]);
  const [apiScope, setApiScope] = useState<AgencyApiScope>('FULL');
  const [freshRawKey, setFreshRawKey] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<AgencyInvoice[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDue, setInvoiceDue] = useState('');
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [messages, setMessages] = useState<AgencyMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchAgencyDetail(agencyId);
      setDetail(d);
      if (role === 'SENIOR_MANAGER') setApiKeys(await fetchAgencyApiKeys(agencyId));
      if (role === 'COMMERCIAL_MANAGER') {
        const [inv, msgs] = await Promise.all([fetchAgencyInvoices(agencyId), fetchAgencyMessages(agencyId)]);
        setInvoices(inv);
        setMessages(msgs);
      }
    } catch {
      setError('خطا در دریافت اطلاعات آژانس.');
    } finally {
      setLoading(false);
    }
  }, [agencyId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleSuspend() {
    if (!detail) return;
    if (detail.isActive) {
      setSuspendReason('');
      setSuspendError(null);
      setSuspendOpen(true);
      return;
    }
    try {
      await reactivateAgency(agencyId);
      setNotice('حساب آژانس مجدداً فعال شد ✓');
      await load();
    } catch {
      setError('خطا در فعال‌سازی مجدد.');
    }
  }

  async function onConfirmSuspend() {
    if (!suspendReason.trim()) {
      setSuspendError('برای تعلیق حساب، درج دلیل الزامی است.');
      return;
    }
    try {
      await suspendAgency(agencyId, suspendReason.trim());
      setSuspendOpen(false);
      setNotice('حساب آژانس تعلیق شد.');
      await load();
    } catch {
      setSuspendError('خطا در ثبت تعلیق.');
    }
  }

  async function onConfirmCredit() {
    const rial = parseTomanToRial(creditInput);
    if (rial === null) {
      setCreditError('مبلغ واردشده معتبر نیست.');
      return;
    }
    try {
      await updateAgencyCredit(agencyId, rial);
      setCreditOpen(false);
      setNotice('سقف اعتبار جدید ثبت شد ✓');
      await load();
    } catch {
      setCreditError('خطا در ثبت اعتبار.');
    }
  }

  async function onSettle() {
    try {
      const { settledIrr } = await settleAgency(agencyId);
      setNotice(`تسویه به مبلغ ${faMoney(settledIrr)} تومان ثبت شد ✓`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت تسویه.');
    }
  }

  async function onIssueApiKey() {
    try {
      const created = await issueAgencyApiKey(agencyId, apiScope);
      setFreshRawKey(created.rawKey ?? null);
      setApiKeys(await fetchAgencyApiKeys(agencyId));
    } catch {
      setError('خطا در تولید کلید API.');
    }
  }

  async function onApiKeyAction(key: AgencyApiKey, action: 'toggle' | 'regenerate') {
    try {
      if (action === 'regenerate') {
        const updated = await updateAgencyApiKey(agencyId, key.id, { regenerate: true });
        setFreshRawKey(updated.rawKey ?? null);
      } else {
        await updateAgencyApiKey(agencyId, key.id, {
          status: key.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
        });
      }
      setApiKeys(await fetchAgencyApiKeys(agencyId));
    } catch {
      setError('خطا در به‌روزرسانی کلید API.');
    }
  }

  async function onIssueInvoice() {
    const rial = parseTomanToRial(invoiceAmount);
    if (rial === null) {
      setInvoiceError('مبلغ واردشده معتبر نیست.');
      return;
    }
    const dueIso = parseJalaliDateToIso(invoiceDue);
    if (!dueIso) {
      setInvoiceError('تاریخ سررسید را به شکل ۱۴۰۵/۰۴/۳۰ وارد کنید.');
      return;
    }
    try {
      await issueAgencyInvoice(agencyId, rial, dueIso);
      setInvoiceOpen(false);
      setInvoiceAmount('');
      setInvoiceDue('');
      setNotice('فاکتور صادر شد ✓');
      setInvoices(await fetchAgencyInvoices(agencyId));
      await load();
    } catch {
      setInvoiceError('خطا در صدور فاکتور.');
    }
  }

  async function onPayInvoice(invoice: AgencyInvoice) {
    try {
      await payAgencyInvoice(agencyId, invoice.id);
      setNotice(`فاکتور ${invoice.invoiceNo} تسویه شد ✓`);
      setInvoices(await fetchAgencyInvoices(agencyId));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت پرداخت.');
    }
  }

  async function onRemindInvoice(invoice: AgencyInvoice) {
    try {
      await remindAgencyInvoice(agencyId, invoice.id);
      setNotice(`یادآوری فاکتور ${invoice.invoiceNo} ارسال شد ✓`);
    } catch {
      setError('خطا در ارسال یادآوری.');
    }
  }

  async function onSendMessage() {
    const body = messageDraft.trim();
    if (!body) return;
    try {
      await postAgencyMessage(agencyId, body);
      setMessageDraft('');
      setMessages(await fetchAgencyMessages(agencyId));
    } catch {
      setError('خطا در ارسال پیام.');
    }
  }

  if (loading) return <p className="p-10 text-center text-sm text-muted">در حال بارگذاری…</p>;
  if (!detail)
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-danger">{error ?? 'آژانس یافت نشد.'}</p>
        <Link to="/panel/agencies" className="mt-3 inline-block text-xs font-bold text-accent">
          بازگشت به فهرست آژانس‌ها
        </Link>
      </div>
    );

  const badge = statusBadge(detail.isActive);
  const activeKey = apiKeys.find((k) => k.status === 'ACTIVE') ?? apiKeys[0];

  const creditCard = (
    <SectionCard
      title="اعتبار آژانس"
      action={
        <div className="flex gap-2">
          {(isSenior || isFinance) && detail.credit.usedIrr > 0 && (
            <button
              onClick={() => void onSettle()}
              className="rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#047857]"
            >
              ثبت تسویه
            </button>
          )}
          <button
            onClick={() => {
              setCreditInput('');
              setCreditError(null);
              setCreditOpen(true);
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            تعیین اعتبار
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-surface p-3">
          <div className="text-[10px] text-muted">سقف اعتبار</div>
          <div className="font-num mt-1 text-sm font-black text-ink">{faMoney(detail.credit.limitIrr)} تومان</div>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <div className="text-[10px] text-muted">مصرف‌شده</div>
          <div className="font-num mt-1 text-sm font-black text-danger">
            {faMoney(Math.max(detail.credit.usedIrr, 0))} تومان
          </div>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <div className="text-[10px] text-muted">مانده اعتبار</div>
          <div className="font-num mt-1 text-sm font-black text-[#059669]">
            {faMoney(Math.max(detail.credit.remainingIrr, 0))} تومان
          </div>
        </div>
      </div>
    </SectionCard>
  );

  const statsRow = (
    <div className="grid grid-cols-3 gap-4">
      <StatBox label="فروش کل" value={`${faMoney(detail.stats.totalSalesIrr)} تومان`} />
      <StatBox label="بلیط صادرشده" value={faDigits(detail.stats.ticketsIssued)} />
      <StatBox label="مسافران" value={faDigits(detail.stats.passengers)} />
    </div>
  );

  const scoreCard = detail.activityScore && (
    <SectionCard title="امتیاز فعالیت آژانس">
      <div className="flex items-center gap-4">
        <div className="font-num text-3xl font-black text-ink">{faDigits(detail.activityScore.score)}</div>
        <span className="rounded-full bg-[#f59e0b1f] px-3 py-1 text-xs font-bold text-[#b45309]">
          سطح {detail.activityScore.badge === 'GOLD' ? 'گلد' : detail.activityScore.badge === 'SILVER' ? 'نقره‌ای' : 'برنز'}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        امتیاز بر اساس صندلی‌های فروخته‌شده، فاکتورهای پرداخت‌شده و وضعیت فعالیت محاسبه می‌شود.
      </p>
    </SectionCard>
  );

  const infoAndActivity = (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="اطلاعات آژانس">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <dt className="text-muted">مدیر مسئول</dt>
            <dd className="mt-0.5 font-bold text-ink">{detail.managerName}</dd>
          </div>
          <div>
            <dt className="text-muted">شماره مجوز بند ب</dt>
            <dd className="mt-0.5 font-bold text-ink">
              <span className="ltr font-num">{detail.licenseNo}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">شهر</dt>
            <dd className="mt-0.5 font-bold text-ink">{detail.city}</dd>
          </div>
          <div>
            <dt className="text-muted">سطح همکاری</dt>
            <dd className="mt-0.5 font-bold text-[#b45309]">{TIER_LABELS[detail.tier]}</dd>
          </div>
          <div>
            <dt className="text-muted">تلفن</dt>
            <dd className="mt-0.5 font-bold text-ink">
              <span className="ltr font-num">{detail.phone}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">ایمیل</dt>
            <dd className="mt-0.5 font-bold text-ink">
              <span className="ltr">{detail.email}</span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted">آدرس</dt>
            <dd className="mt-0.5 font-bold text-ink">{detail.address || '—'}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard title="فعالیت‌های اخیر">
        {detail.recentActivity.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">فعالیتی ثبت نشده است.</p>
        ) : (
          <ul className="space-y-3">
            {detail.recentActivity.map((a) => (
              <li key={a.id} className="border-r-2 border-accent/40 pr-3">
                <div className="text-xs font-bold text-ink">{a.action}</div>
                <div className="mt-0.5 text-[11px] text-muted">{a.detail}</div>
                <div className="font-num mt-0.5 text-[10px] text-muted-2">{formatJalaliDateTime(a.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );

  const apiKeyCard = isSenior && (
    <SectionCard
      title="دسترسی API رزرواسیون"
      action={
        activeKey && (
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              activeKey.status === 'ACTIVE' ? 'bg-[#10b98124] text-[#059669]' : 'bg-[#f59e0b24] text-[#b45309]'
            }`}
          >
            {activeKey.status === 'ACTIVE' ? 'فعال' : 'معلق'}
          </span>
        )
      }
    >
      <p className="mb-4 text-[11px] leading-relaxed text-muted">
        صدور کلید API برای اتصال این آژانس به سامانه رزرواسیون — پس از تولید، نام آژانس در بخش «دسترسی
        آژانس‌ها»ی سامانه رزرواسیون نمایش داده می‌شود.
      </p>

      {freshRawKey && (
        <div className="mb-4 rounded-lg border border-[#f59e0b40] bg-[#f59e0b0d] p-3">
          <div className="text-[11px] font-bold text-[#92400e]">
            کلید جدید — فقط همین یک‌بار نمایش داده می‌شود؛ آن را کپی کنید:
          </div>
          <code className="ltr font-num mt-1 block break-all text-xs text-ink">{freshRawKey}</code>
        </div>
      )}

      {apiKeys.length === 0 ? (
        <div>
          <div className="mb-2 text-xs font-bold text-ink">سطح دسترسی API:</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {API_SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setApiScope(opt.value)}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  apiScope === opt.value ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void onIssueApiKey()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            تولید API
          </button>
        </div>
      ) : (
        activeKey && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface p-3">
              <span className="text-[10px] text-muted">API Key</span>
              <code className="ltr font-num text-xs text-ink">{activeKey.keyHash.slice(0, 11)}••••••</code>
              <span className="mr-auto text-[10px] font-bold text-text-2">
                {API_SCOPE_OPTIONS.find((o) => o.value === activeKey.scope)?.label}
              </span>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#10b98110] p-3">
                <div className="text-[10px] text-muted">زمان فعال‌سازی</div>
                <div className="font-num mt-0.5 text-xs font-bold text-[#059669]">
                  {formatJalaliDate(activeKey.activatedAt)}
                </div>
              </div>
              <div className="rounded-lg bg-[#f59e0b10] p-3">
                <div className="text-[10px] text-muted">زمان اتمام</div>
                <div className="font-num mt-0.5 text-xs font-bold text-[#b45309]">
                  {activeKey.expiresAt ? formatJalaliDate(activeKey.expiresAt) : 'نامحدود'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void onApiKeyAction(activeKey, 'toggle')}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                  activeKey.status === 'ACTIVE'
                    ? 'bg-danger/10 text-danger hover:bg-danger/20'
                    : 'bg-[#10b98115] text-[#059669] hover:bg-[#10b98125]'
                }`}
              >
                {activeKey.status === 'ACTIVE' ? 'تعلیق دسترسی' : 'فعال‌سازی دسترسی'}
              </button>
              <button
                onClick={() => void onApiKeyAction(activeKey, 'regenerate')}
                className="rounded-lg border border-accent/40 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/5"
              >
                تولید کلید جدید
              </button>
            </div>
          </div>
        )
      )}
    </SectionCard>
  );

  const invoicesSection = isCommercial && (
    <SectionCard
      title="فاکتورهای صادرشده"
      action={
        <button
          onClick={() => {
            setInvoiceError(null);
            setInvoiceOpen(true);
          }}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent/90"
        >
          صدور فاکتور
        </button>
      }
    >
      {invoices.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">فاکتوری صادر نشده است.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted">
                <th className="py-2 font-bold">شماره فاکتور</th>
                <th className="py-2 font-bold">تاریخ صدور</th>
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
                    <td className="font-num py-2.5">{formatJalaliDate(inv.issuedAt)}</td>
                    <td className="font-num py-2.5">{formatJalaliDate(inv.dueAt)}</td>
                    <td className="font-num py-2.5 font-bold">{faMoney(inv.amountIrr)} تومان</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                    </td>
                    <td className="py-2.5">
                      {inv.status !== 'PAID' && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => void onRemindInvoice(inv)}
                            className="rounded-md bg-[#f59e0b1a] px-2.5 py-1 text-[10px] font-bold text-[#b45309] transition hover:bg-[#f59e0b2c]"
                          >
                            یادآوری
                          </button>
                          <button
                            onClick={() => void onPayInvoice(inv)}
                            className="rounded-md bg-[#10b98118] px-2.5 py-1 text-[10px] font-bold text-[#059669] transition hover:bg-[#10b98130]"
                          >
                            ثبت پرداخت این فاکتور
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );

  const messagesSection = isCommercial && (
    <section className="flex h-[540px] flex-col rounded-xl border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <div className="text-sm font-bold text-ink">مکاتبهٔ ایرلاین blujet با {detail.fullName}</div>
        <div className="mt-0.5 text-[11px] text-muted">گفتگوی اختصاصی این آژانس</div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">هنوز پیامی با این آژانس رد و بدل نشده است.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.senderIsAgency ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.senderIsAgency ? 'bg-surface text-ink' : 'bg-accent text-white'
                }`}
              >
                <p>{m.body}</p>
                <div className={`font-num mt-1 text-[10px] ${m.senderIsAgency ? 'text-muted' : 'text-white/70'}`}>
                  {m.senderIsAgency ? detail.fullName : 'ایرلاین blujet'} · {formatJalaliDateTime(m.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 border-t border-border p-4">
        <input
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onSendMessage();
          }}
          placeholder="پیام خود را به این آژانس بنویسید…"
          className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-xs outline-none transition focus:border-accent"
        />
        <button
          onClick={() => void onSendMessage()}
          className="rounded-lg bg-accent px-4 text-xs font-bold text-white transition hover:bg-accent/90"
        >
          ارسال
        </button>
      </div>
    </section>
  );

  const overviewContent = (
    <div className="space-y-4">
      {statsRow}
      {creditCard}
      {scoreCard}
      {apiKeyCard}
      {infoAndActivity}
    </div>
  );

  return (
    <div className="space-y-4 p-8">
      <Link to="/panel/agencies" className="inline-block text-xs font-bold text-accent">
        بازگشت به فهرست آژانس‌ها
      </Link>

      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {notice && <p className="rounded-lg bg-[#10b98115] p-3 text-sm text-[#059669]">{notice}</p>}

      <header className="rounded-2xl bg-gradient-to-l from-navy to-navy-2 p-6 text-white">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black">
            {detail.fullName.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black">{detail.fullName}</h1>
            <p className="mt-1 text-xs text-white/70">
              مجوز بند ب: <span className="ltr font-num">{detail.licenseNo}</span> · عضویت از{' '}
              <span className="font-num">{formatJalaliDate(detail.joinedAt)}</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
          <button
            onClick={() => void onToggleSuspend()}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              detail.isActive ? 'bg-danger text-white hover:bg-danger/90' : 'bg-[#059669] text-white hover:bg-[#047857]'
            }`}
          >
            {detail.isActive ? 'تعلیق حساب' : 'فعال‌سازی مجدد'}
          </button>
        </div>
        {!detail.isActive && (
          <div className="mt-4 rounded-lg bg-danger/20 p-3 text-xs">
            <div className="font-bold">حساب این آژانس تعلیق شده است</div>
            {detail.suspendReason && <div className="mt-1 text-white/80">دلیل تعلیق: {detail.suspendReason}</div>}
          </div>
        )}
      </header>

      {isCommercial ? (
        <>
          <div className="flex gap-1.5">
            {(
              [
                { key: 'overview', label: 'نمای کلی' },
                { key: 'finance', label: 'مالی' },
                { key: 'messages', label: 'مکاتبه‌ها' },
              ] as { key: CommercialTab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  tab === t.key ? 'bg-accent text-white' : 'bg-surface text-text-2 hover:bg-surface-2'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              {statsRow}
              {scoreCard}
              {infoAndActivity}
            </div>
          )}
          {tab === 'finance' && (
            <div className="space-y-4">
              {creditCard}
              {invoicesSection}
            </div>
          )}
          {tab === 'messages' && messagesSection}
        </>
      ) : (
        overviewContent
      )}

      {suspendOpen && (
        <Modal title="تعلیق حساب آژانس" onClose={() => setSuspendOpen(false)}>
          <p className="mb-3 text-xs text-muted">
            دلیل تعلیق حساب را وارد کنید. این متن در پروفایل آژانس ثبت و نمایش داده می‌شود.
          </p>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="suspend-reason">
            دلیل تعلیق *
          </label>
          <textarea
            id="suspend-reason"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="مثلاً: بدهی معوق و عدم تسویه در موعد مقرر…"
            rows={3}
            className="w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          {suspendError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {suspendError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setSuspendOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button
              onClick={() => void onConfirmSuspend()}
              className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
            >
              تعلیق و ثبت دلیل
            </button>
          </div>
        </Modal>
      )}

      {creditOpen && (
        <Modal title="تعیین سقف اعتبار" onClose={() => setCreditOpen(false)}>
          <div className="mb-3 inline-block rounded-full bg-surface px-3 py-1 text-[11px] text-text-2">
            سقف فعلی: <span className="font-num font-bold">{faMoney(detail.credit.limitIrr)} تومان</span>
          </div>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="credit-input">
            سقف اعتبار جدید (تومان)
          </label>
          <input
            id="credit-input"
            dir="ltr"
            value={creditInput}
            onChange={(e) => setCreditInput(e.target.value)}
            placeholder="مثلاً 100000000"
            className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          {creditError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {creditError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCreditOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button
              onClick={() => void onConfirmCredit()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              ثبت اعتبار
            </button>
          </div>
        </Modal>
      )}

      {invoiceOpen && (
        <Modal title="صدور فاکتور جدید" onClose={() => setInvoiceOpen(false)}>
          <label className="mb-1 block text-xs font-bold text-ink" htmlFor="invoice-amount">
            مبلغ فاکتور (تومان)
          </label>
          <input
            id="invoice-amount"
            dir="ltr"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            placeholder="مثلاً ۱۵۰۰۰۰۰۰۰"
            className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          {parseTomanToRial(invoiceAmount) !== null && (
            <p className="mt-1 text-[11px] text-muted">
              مبلغ واردشده: <span className="font-num">{faMoney(parseTomanToRial(invoiceAmount)!)} تومان</span>
            </p>
          )}
          <label className="mb-1 mt-3 block text-xs font-bold text-ink" htmlFor="invoice-due">
            تاریخ سررسید
          </label>
          <input
            id="invoice-due"
            value={invoiceDue}
            onChange={(e) => setInvoiceDue(e.target.value)}
            placeholder="مثلاً ۱۴۰۵/۰۴/۳۰"
            className="font-num w-full rounded-lg border border-border p-3 text-xs outline-none transition focus:border-accent"
          />
          {invoiceError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {invoiceError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setInvoiceOpen(false)} className="rounded-lg bg-surface px-4 py-2 text-xs font-bold text-text-2">
              انصراف
            </button>
            <button
              onClick={() => void onIssueInvoice()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            >
              صدور و ثبت فاکتور
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
