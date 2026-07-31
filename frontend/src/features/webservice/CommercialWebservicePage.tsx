import { useEffect, useState } from 'react';
import { fetchWebservicePricing, updateWebservicePricing } from '../../api/webservice-pricing';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney, latinDigits, parseTomanToRial } from '../../lib/fa-format';

const PLAN_LABELS: Record<1 | 3 | 12, string> = {
  1: '۱ ماهه',
  3: '۳ ماهه',
  12: '۱۲ ماهه',
};

/** Commercial Manager — B2B webservice plan pricing (design: webservice tab). */
export default function CommercialWebservicePage() {
  const [month1, setMonth1] = useState('');
  const [month3, setMonth3] = useState('');
  const [month12, setMonth12] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWebservicePricing()
      .then((data) => {
        setMonth1(String(Math.floor(data.prices[1] / 10)));
        setMonth3(String(Math.floor(data.prices[3] / 10)));
        setMonth12(String(Math.floor(data.prices[12] / 10)));
      })
      .catch(() => setError('خطا در دریافت قیمت‌گذاری وب‌سرویس.'));
  }, []);

  async function onSave() {
    setError(null);
    setNotice(null);
    try {
      const month1PriceIrr = parseTomanToRial(month1);
      const month3PriceIrr = parseTomanToRial(month3);
      const month12PriceIrr = parseTomanToRial(month12);
      if (month1PriceIrr <= 0 || month3PriceIrr <= 0 || month12PriceIrr <= 0) {
        setError('همهٔ قیمت‌ها باید عددی و بزرگ‌تر از صفر باشند.');
        return;
      }
      setSaving(true);
      await updateWebservicePricing({ month1PriceIrr, month3PriceIrr, month12PriceIrr });
      setNotice('قیمت‌گذاری وب‌سرویس‌ها ذخیره شد ✓');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ذخیره قیمت‌گذاری.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-ink">وب سرویس</h1>
      <p className="mb-6 text-sm text-muted">قیمت‌گذاری وب‌سرویس‌های قابل خرید توسط آژانس‌ها</p>

      <div className="mb-4 rounded-lg bg-[#1668c414] p-3 text-xs leading-6 text-muted">
        قیمت هر پلن، مبلغی است که آژانس‌ها هنگام خرید وب‌سرویس از پنل خود پرداخت می‌کنند؛ تغییر
        این قیمت‌ها بلافاصله در درخواست‌های خرید جدید اعمال می‌شود.
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</p>}
      {notice && (
        <p className="mb-4 rounded-lg bg-[#10b98118] p-3 text-xs font-bold text-[#059669]">{notice}</p>
      )}

      <div className="max-w-3xl rounded-xl border border-border bg-white p-5">
        <div className="mb-1 text-sm font-bold text-ink">پلن‌های اشتراک B2B</div>
        <p className="mb-4 text-[11px] text-muted">برای هر دو نوع وب‌سرویس (جستجو و رزرو / فروش کامل)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {([1, 3, 12] as const).map((months) => {
            const value = months === 1 ? month1 : months === 3 ? month3 : month12;
            const setValue = months === 1 ? setMonth1 : months === 3 ? setMonth3 : setMonth12;
            return (
              <div key={months}>
                <label htmlFor={`ws-${months}`} className="mb-1.5 block text-[11.5px] text-muted">
                  {PLAN_LABELS[months]} (تومان)
                </label>
                <input
                  id={`ws-${months}`}
                  dir="ltr"
                  inputMode="numeric"
                  value={faDigits(value)}
                  onChange={(e) => setValue(latinDigits(e.target.value))}
                  className="font-num w-full rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
                {value && (
                  <p className="mt-1 text-[10px] text-muted">
                    ≈ {faMoney(parseTomanToRial(value))} تومان
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <button
          disabled={saving}
          onClick={() => void onSave()}
          className="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره قیمت‌گذاری'}
        </button>
      </div>
    </div>
  );
}
