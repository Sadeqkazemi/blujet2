import { useState } from 'react';

// وب‌سرویس (B2B API) — mock-only tab matching the design's webservice
// purchase flow (پنل آژانس.dc.html): plan picker → request pending → active
// connection with API key. No backend workflow exists yet, so state is local.

const WS_TYPES = [
  { key: 'search', label: 'جستجو و رزرو' },
  { key: 'full', label: 'فروش کامل (صدور بلیط)' },
];

const WS_PLANS = [
  { key: 'm1', label: '۱ ماهه', priceLabel: '۴٬۵۰۰٬۰۰۰' },
  { key: 'm3', label: '۳ ماهه', priceLabel: '۱۲٬۰۰۰٬۰۰۰' },
  { key: 'm12', label: '۱۲ ماهه', priceLabel: '۴۲٬۰۰۰٬۰۰۰' },
];

export default function AgencyWebservicePage() {
  const [wsType, setWsType] = useState('search');
  const [plan, setPlan] = useState('m1');
  const [requested, setRequested] = useState(false);
  const [keyShown, setKeyShown] = useState(false);

  const selPlan = WS_PLANS.find((p) => p.key === plan)!;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[#d6e4f8] bg-[#f2f7fd] p-4 text-xs leading-6 text-[#3f546b]">
        برای استفاده از وب‌سرویس ابتدا باید یک پلن را خریداری کنید؛ درخواست شما برای ادمین ارسال و پس از بررسی و تأیید، کلید دسترسی و مستندات API فعال و نمایش داده می‌شود.
      </div>

      {/* pending state after mock purchase */}
      {requested ? (
        <div data-testid="ws-pending" className="rounded-2xl border border-[#fde3c4] bg-[#fff7ed] p-6 text-center">
          <div className="mb-2 text-2xl">⏳</div>
          <div className="mb-1 text-sm font-black text-[#0d2640]">درخواست خرید شما در حال بررسی است</div>
          <p className="text-xs leading-6 text-[#8a6a3a]">
            پس از تأیید توسط ادمین و مدیران مربوطه، وب‌سرویس فعال و کلید دسترسی نمایش داده می‌شود.
          </p>
          <span className="mt-3 inline-block rounded-full bg-[#fde3c4] px-3 py-1 text-[10.5px] font-extrabold text-[#9a5b16]">در انتظار تأیید</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm">
          <div className="mb-1 text-sm font-black text-[#0d2640]">خرید وب‌سرویس جدید</div>
          <p className="mb-4 text-[11.5px] text-[#8a96a6]">پلن مورد نظر را انتخاب و خریداری کنید تا درخواست برای ادمین ارسال شود.</p>

          <div className="mb-2 text-xs font-bold text-[#5a6678]">نوع وب‌سرویس</div>
          <div className="mb-4 flex gap-2">
            {WS_TYPES.map((t) => (
              <span
                key={t.key}
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
              onClick={() => setRequested(true)}
              className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-xs font-bold text-white"
            >
              خرید و ثبت درخواست
            </button>
          </div>
        </div>
      )}

      {/* sample active connection (design's active state, shown as demo) */}
      <div className="rounded-2xl border border-[#e8eef6] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-black text-[#0d2640]">اتصال فعال وب‌سرویس</div>
          <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-[10.5px] font-extrabold text-[#1f8a5b]">● فعال</span>
        </div>
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-[#fafbfd] p-3">
            <div className="mb-1 text-[10.5px] text-[#8a96a6]">آدرس پایه (Base URL)</div>
            <div className="font-num text-xs font-bold text-[#0d2640]" dir="ltr">
              https://api.blujet.ir/agency/v1
            </div>
          </div>
          <div className="rounded-xl bg-[#fafbfd] p-3">
            <div className="mb-1 flex items-center justify-between text-[10.5px] text-[#8a96a6]">
              <span>کلید دسترسی (API Key)</span>
              <span data-testid="ws-key-toggle" onClick={() => setKeyShown((v) => !v)} className="cursor-pointer font-bold text-[#1668c4]">
                {keyShown ? 'پنهان' : 'نمایش'}
              </span>
            </div>
            <div className="font-num text-xs font-bold text-[#0d2640]" dir="ltr" data-testid="ws-key">
              {keyShown ? 'bj_live_4f8a2c91d7e3b5a6' : '•••• •••• •••• ••••'}
            </div>
          </div>
        </div>
        <button className="rounded-lg border border-[#d5e1f0] px-4 py-2 text-xs font-bold text-[#1668c4]">مشاهده مستندات API</button>
      </div>
    </div>
  );
}
