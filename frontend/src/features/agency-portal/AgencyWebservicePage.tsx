import { useEffect, useState } from 'react';
import { fetchApiKeys, fetchMyWebserviceRequests, requestWebservice } from '../../api/agency-portal';
import { ApiRequestError } from '../../api/envelope';
import { formatJalaliDate } from '../../lib/jalali';
import type { AgencyApiKeySummary, AgencyApiScope, AgencyWebserviceRequest } from '../../types/agency-portal';

// وب‌سرویس (B2B API) — پلن انتخاب می‌شود، درخواست برای ادمین/مدیران ارسال
// می‌شود، و پس از تأیید کلید API واقعی صادر و از طریق مکاتبه (کارتابل) یک‌بار
// برای آژانس ارسال می‌شود (AgencyApiKey فقط هش کلید را نگه می‌دارد، هرگز کلید
// خام را — نمی‌توان آن را دوباره در این صفحه نمایش داد).

const WS_TYPES: { key: AgencyApiScope; label: string }[] = [
  { key: 'SEARCH_BOOK', label: 'جستجو و رزرو' },
  { key: 'FULL', label: 'فروش کامل (صدور بلیط)' },
];

const WS_PLANS: { key: 1 | 3 | 12; label: string; priceLabel: string }[] = [
  { key: 1, label: '۱ ماهه', priceLabel: '۴٬۵۰۰٬۰۰۰' },
  { key: 3, label: '۳ ماهه', priceLabel: '۱۲٬۰۰۰٬۰۰۰' },
  { key: 12, label: '۱۲ ماهه', priceLabel: '۴۲٬۰۰۰٬۰۰۰' },
];

const SCOPE_LABEL: Record<string, string> = {
  FULL: 'فروش کامل (صدور بلیط)',
  SEARCH_BOOK: 'جستجو و رزرو',
  SEARCH_ONLY: 'فقط جستجو',
};

export default function AgencyWebservicePage() {
  const [wsType, setWsType] = useState<AgencyApiScope>('SEARCH_BOOK');
  const [plan, setPlan] = useState<1 | 3 | 12>(1);
  const [requests, setRequests] = useState<AgencyWebserviceRequest[]>([]);
  const [apiKeys, setApiKeys] = useState<AgencyApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selPlan = WS_PLANS.find((p) => p.key === plan)!;

  function reload() {
    setLoading(true);
    Promise.all([fetchMyWebserviceRequests(), fetchApiKeys()])
      .then(([r, k]) => {
        setRequests(r);
        setApiKeys(k);
        setError(null);
      })
      .catch(() => setError('خطا در دریافت اطلاعات وب‌سرویس.'))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function onBuy() {
    setSubmitting(true);
    setError(null);
    try {
      await requestWebservice(wsType, plan);
      reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ثبت درخواست.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-8 text-sm text-muted">در حال بارگذاری…</p>;

  const activeKey = apiKeys.find((k) => k.status === 'ACTIVE');
  const pendingRequest = requests.find((r) => r.status === 'PENDING');
  const lastDecided = requests.find((r) => r.status !== 'PENDING');

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-4 text-xs leading-6 text-[#3f546b]">
        برای استفاده از وب‌سرویس ابتدا باید یک پلن را خریداری کنید؛ درخواست شما برای ادمین ارسال و پس از بررسی و
        تأیید، کلید دسترسی از طریق مکاتبه با آژانس ارسال می‌شود.
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {pendingRequest ? (
        <div data-testid="ws-pending" className="rounded-2xl border border-[#fde3c4] bg-[#fff7ed] p-6 text-center">
          <div className="mb-2 text-2xl">⏳</div>
          <div className="mb-1 text-sm font-black text-[#0d2640]">درخواست خرید شما در حال بررسی است</div>
          <p className="text-xs leading-6 text-[#8a6a3a]">
            پس از تأیید توسط ادمین و مدیران مربوطه، وب‌سرویس فعال و کلید دسترسی از طریق مکاتبه ارسال می‌شود.
          </p>
          <span className="mt-3 inline-block rounded-full bg-[#fde3c4] px-3 py-1 text-[10.5px] font-extrabold text-[#9a5b16]">
            در انتظار تأیید
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm">
          <div className="mb-1 text-sm font-black text-[#0d2640]">خرید وب‌سرویس جدید</div>
          <p className="mb-4 text-[11.5px] text-[#8a96a6]">
            پلن مورد نظر را انتخاب و خریداری کنید تا درخواست برای ادمین ارسال شود.
          </p>

          {lastDecided?.status === 'REJECTED' && (
            <div className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-[11px] text-danger">
              آخرین درخواست شما رد شد. می‌توانید درخواست جدیدی ثبت کنید.
            </div>
          )}

          <div className="mb-2 text-xs font-bold text-[#5a6678]">نوع وب‌سرویس</div>
          <div className="mb-4 flex gap-2">
            {WS_TYPES.map((t) => (
              <span
                key={t.key}
                data-testid={`ws-type-${t.key}`}
                onClick={() => setWsType(t.key)}
                className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-bold ${wsType === t.key ? 'bg-[#1668c4] text-white' : 'bg-[#f1f4f8] text-[#5a6678]'}`}
              >
                {t.label}
              </span>
            ))}
          </div>

          <div className="mb-2 text-xs font-bold text-[#5a6678]">مدت اشتراک</div>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {WS_PLANS.map((p) => (
              <div
                key={p.key}
                data-testid={`ws-plan-${p.key}`}
                onClick={() => setPlan(p.key)}
                className={`cursor-pointer rounded-xl border p-3 text-center ${plan === p.key ? 'border-[#1668c4] bg-[#f2f7fd]' : 'border-[#e8eef6]'}`}
              >
                <div className="text-xs font-extrabold text-[#0d2640]">{p.label}</div>
                <div className="font-num mt-1 text-[11px] font-bold text-[#1668c4]">{p.priceLabel} تومان</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#fafbfd] p-4">
            <div>
              <div className="text-[10.5px] text-[#8a96a6]">مبلغ قابل پرداخت</div>
              <div className="font-num text-base font-black text-[#0d2640]">
                {selPlan.priceLabel} <span className="text-[10px] font-normal text-[#8a96a6]">تومان</span>
              </div>
            </div>
            <button
              data-testid="ws-buy"
              disabled={submitting}
              onClick={() => void onBuy()}
              className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {submitting ? 'در حال ارسال…' : 'خرید و ثبت درخواست'}
            </button>
          </div>
        </div>
      )}

      {activeKey && (
        <div className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-black text-[#0d2640]">اتصال فعال وب‌سرویس</div>
            <span
              data-testid="ws-active-status"
              className="rounded-full bg-[#e8f5ee] px-3 py-1 text-[10.5px] font-extrabold text-[#1f8a5b]"
            >
              ● فعال
            </span>
          </div>
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-[#fafbfd] p-3">
              <div className="mb-1 text-[10.5px] text-[#8a96a6]">آدرس پایه (Base URL)</div>
              <div className="font-num text-xs font-bold text-[#0d2640]" dir="ltr">
                https://api.blujet.ir/agency/v1
              </div>
            </div>
            <div className="rounded-xl bg-[#fafbfd] p-3">
              <div className="mb-1 text-[10.5px] text-[#8a96a6]">دامنه دسترسی</div>
              <div data-testid="ws-active-scope" className="text-xs font-bold text-[#0d2640]">
                {SCOPE_LABEL[activeKey.scope]}
              </div>
            </div>
          </div>
          <div className="mb-3 rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-3 text-[11px] leading-6 text-[#3f546b]">
            کلید دسترسی API به دلیل امنیت فقط یک‌بار — هنگام تأیید درخواست — از طریق مکاتبه (کارتابل) برای شما
            ارسال شده است. در صورت گم‌شدن کلید، درخواست صدور مجدد را با پشتیبانی مطرح کنید.
          </div>
          <div data-testid="ws-key-activated-at" className="text-[10.5px] text-[#8a96a6]">
            فعال‌سازی: <span className="font-num">{formatJalaliDate(activeKey.activatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
