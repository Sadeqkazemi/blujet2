import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { faDigits } from '../../lib/fa-format';

// مدیریت رزرو (PNR lookup + refund) — mock-only page mirroring
// design-reference/مدیریت رزرو.dc.html's own client-side behavior: any
// plausible PNR + last name resolves to the design's sample booking, and
// the refund flow computes the same mock 30% penalty. No backend calls.

interface MockPassenger {
  name: string;
  seat: string;
  fareIrr: number;
  farePersian: string;
}

const MOCK_PASSENGERS: MockPassenger[] = [
  { name: 'نگار رضایی', seat: '12A', fareIrr: 16000000, farePersian: '۱٬۶۰۰٬۰۰۰' },
  { name: 'آرش رضایی', seat: '12B', fareIrr: 16000000, farePersian: '۱٬۶۰۰٬۰۰۰' },
];

const PENALTY_PCT = 30;

const fa = (n: number) => faDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

export default function ManageBookingPage() {
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [selected, setSelected] = useState<boolean[]>(MOCK_PASSENGERS.map(() => false));
  const [refundDone, setRefundDone] = useState(false);

  const pnrShow = pnr.trim().toUpperCase();

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pnr.trim().length < 4 || !lastName.trim()) {
      setError('کد رزرو و نام خانوادگی مسافر را وارد کنید.');
      return;
    }
    setFound(true);
    setRefundDone(false);
    setRefundOpen(false);
    setSelected(MOCK_PASSENGERS.map(() => false));
  }

  const chosen = MOCK_PASSENGERS.filter((_, i) => selected[i]);
  const fareSum = chosen.reduce((s, p) => s + p.fareIrr, 0) / 10; // toman
  const penalty = Math.round((fareSum * PENALTY_PCT) / 100);
  const refundable = fareSum - penalty;

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '41px 22px 65px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>مدیریت رزرو</h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>با کد رزرو و نام خانوادگی، بلیط خود را ببینید؛ تغییر صندلی یا استرداد را همین‌جا انجام دهید.</p>
      </section>

      <div style={{ maxWidth: 720, margin: '-34px auto 0', padding: '0 22px 60px', position: 'relative' }}>
        {/* LOOKUP CARD */}
        <form
          onSubmit={lookup}
          style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: 20, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="mb-pnr" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
              کد رزرو
            </label>
            <input
              id="mb-pnr"
              data-testid="mb-pnr"
              dir="ltr"
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="مثلاً BJ4X2K"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="mb-lastname" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
              نام خانوادگی مسافر
            </label>
            <input
              id="mb-lastname"
              data-testid="mb-lastname"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="مثلاً رضایی"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
            />
          </div>
          <button
            type="submit"
            data-testid="mb-lookup"
            style={{ flex: 'none', border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 26px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            مشاهده رزرو
          </button>
          <div style={{ flexBasis: '100%', fontSize: 11, color: '#8a96a6' }}>کد رزرو در ایمیل/پیامک تأیید خرید برای شما ارسال شده است.</div>
          {error && <div style={{ flexBasis: '100%', borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</div>}
        </form>

        {/* BOOKING CARD */}
        {found && (
          <div style={{ marginTop: 22 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.3)' }}>
              <div style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                  <span>✈</span> blujet
                </span>
                <span style={{ fontSize: 12 }}>
                  کد رزرو{' '}
                  <b dir="ltr" data-testid="mb-pnr-show" style={{ fontSize: 14, letterSpacing: 1 }}>
                    {pnrShow}
                  </b>
                </span>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    THR
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7585' }}>تهران</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{faDigits('07:30')}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: '#8a96a6', fontSize: 11 }}>
                  <div>{faDigits(1)} ساعت {faDigits(25)} دقیقه</div>
                  <div style={{ borderTop: '2px dashed #d5e1f0', margin: '8px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -10, right: '50%', transform: 'translateX(50%)', background: '#fff', padding: '0 8px', color: '#1668c4' }}>✈</span>
                  </div>
                  <div dir="ltr">BJ-{faDigits(102)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    MHD
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7585' }}>مشهد</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{faDigits('08:55')}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid #f2f4f7' }}>
                {[
                  ['تاریخ', '۲۵ تیر ۱۴۰۵'],
                  ['ترمینال', faDigits(2)],
                  ['گیت', faDigits(14)],
                  ['کلاس', 'اکونومی'],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '11px 14px', textAlign: 'center', borderLeft: '1px solid #f2f4f7' }}>
                    <div style={{ fontSize: 10.5, color: '#8a96a6', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #f2f4f7', padding: '15px 20px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640', marginBottom: 11 }}>مسافران</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {MOCK_PASSENGERS.map((p) => (
                    <div key={p.seat} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#f7faff', border: '1px solid #e6eefb', borderRadius: 12, padding: '10px 13px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1668c4,#0d3b66)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>
                        {p.name.split(/\s+/).map((w) => w[0]).join('')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#8a96a6' }}>
                          صندلی <span dir="ltr">{p.seat}</span> · چک‌این نشده
                        </div>
                      </div>
                      <span style={{ background: '#e8f5ee', color: '#1f8a5b', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 14 }}>تأیید شده</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f2f4f7', padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setRefundOpen(true)}
                  data-testid="mb-open-refund"
                  disabled={refundDone}
                  style={{ border: '1.5px solid #f3d1d3', background: refundDone ? '#f6f8fb' : '#fff', color: refundDone ? '#aab8c8' : '#d64545', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: refundDone ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  استرداد بلیط
                </button>
                <button
                  type="button"
                  style={{ border: '1.5px solid #d5e1f0', background: '#fff', color: '#0d2640', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  تغییر صندلی
                </button>
                <button
                  type="button"
                  style={{ marginRight: 'auto', border: 'none', background: '#1668c4', color: '#fff', padding: '10px 20px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  دانلود بلیط
                </button>
              </div>
            </div>

            {/* REFUND DONE */}
            {refundDone && (
              <div style={{ marginTop: 16, background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1f8a5b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#0d2640' }}>درخواست استرداد ثبت شد</span>
                </div>
                <p style={{ fontSize: 12, color: '#3b5548', margin: '0 0 12px', lineHeight: 1.9 }}>
                  مبلغ قابل استرداد پس از کسر جریمه، طی ۳ تا ۷ روز کاری به کارت پرداخت‌کننده بازگردانده می‌شود. کد پیگیری:{' '}
                  <b dir="ltr">RF-{pnrShow}</b>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    ['مبلغ بلیط', fa(fareSum)],
                    ['جریمه', `−${fa(penalty)}`],
                    ['بازگشتی', fa(refundable)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#fff', border: '1px solid #d9eee0', borderRadius: 12, padding: '10px 13px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10.5, color: '#7a8696', marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2640' }}>
                        {v} <span style={{ fontSize: 9, fontWeight: 400 }}>تومان</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setFound(false);
                setPnr('');
                setLastName('');
              }}
              style={{ marginTop: 16, background: 'none', border: 'none', color: '#1668c4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ‹ جستجوی رزرو دیگر
            </button>
          </div>
        )}
      </div>

      {/* REFUND MODAL */}
      {refundOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,38,64,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setRefundOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, padding: '22px 22px 18px', boxShadow: '0 30px 70px -20px rgba(0,0,0,.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: 0 }}>استرداد بلیط</h2>
              <span style={{ background: '#fbf0ef', color: '#d64545', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 14 }}>
                مشمول جریمه {faDigits(PENALTY_PCT)}٪
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: '#6b7585', margin: '0 0 14px', lineHeight: 1.8 }}>
              مسافرانی که می‌خواهید بلیط‌شان مسترد شود را انتخاب کنید. جریمه بر اساس قوانین نرخی بلیط و فاصله تا زمان پرواز محاسبه می‌شود.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {MOCK_PASSENGERS.map((p, i) => (
                <label
                  key={p.seat}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${selected[i] ? '#1668c4' : '#e3e9f1'}`, background: selected[i] ? '#eef4fb' : '#fff', borderRadius: 12, padding: '10px 13px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    data-testid={`mb-refund-pax-${i}`}
                    checked={selected[i]}
                    onChange={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
                  />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: '#8a96a6' }}>
                      صندلی <span dir="ltr">{p.seat}</span>
                    </span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0d2640' }}>
                    {p.farePersian} <span style={{ fontSize: 9, fontWeight: 400, color: '#8a96a6' }}>تومان</span>
                  </span>
                </label>
              ))}
            </div>

            <div style={{ background: '#f7faff', border: '1px solid #e6eefb', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#5a6678' }}>
                <span>جمع مبلغ بلیط انتخابی</span>
                <span style={{ fontWeight: 800, color: '#0d2640' }}>{fa(fareSum)} تومان</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#5a6678' }}>
                <span>جریمه استرداد ({faDigits(PENALTY_PCT)}٪)</span>
                <span style={{ fontWeight: 800, color: '#d64545' }}>−{fa(penalty)} تومان</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #d5e1f0', paddingTop: 8, color: '#0d2640', fontWeight: 900 }}>
                <span>مبلغ قابل بازگشت</span>
                <span data-testid="mb-refundable">{fa(refundable)} تومان</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                data-testid="mb-refund-confirm"
                disabled={chosen.length === 0}
                onClick={() => {
                  setRefundOpen(false);
                  setRefundDone(true);
                }}
                style={{ flex: 1, border: 'none', borderRadius: 11, background: chosen.length ? '#d64545' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13, fontWeight: 800, cursor: chosen.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                تأیید و ثبت استرداد
              </button>
              <button
                type="button"
                onClick={() => setRefundOpen(false)}
                style={{ flex: 'none', border: '1.5px solid #d5e1f0', borderRadius: 11, background: '#fff', color: '#5a6678', padding: '12px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicPageShell>
  );
}
