import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { lookupBookingByPnrAndLastName, submitAnonymousRefund } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';

// مدیریت رزرو — real PNR + last-name self-service (no login), matching
// مدیریت رزرو.dc.html's anonymous lookup UX. تغییر صندلی/دانلود بلیط stay
// disabled this phase (see docs/API.md's Phase 19 for the deferral
// reasoning); refund uses the same real IBAN-then-submit flow as
// TicketPage.tsx's authenticated refund form, not a pre-submission
// per-passenger preview.

export default function ManageBookingPage() {
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [iban, setIban] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<{ penaltyPct: number; refundableIrr: number; penaltyAmountIrr: number } | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    if (pnr.trim().length < 4 || !lastName.trim()) {
      setLookupError('کد رزرو و نام خانوادگی مسافر را وارد کنید.');
      return;
    }
    setLoading(true);
    try {
      const data = await lookupBookingByPnrAndLastName(pnr.trim(), lastName.trim());
      setBooking(data);
      setRefundResult(null);
      setRefundOpen(false);
    } catch (err) {
      setBooking(null);
      setLookupError(err instanceof ApiRequestError ? err.message : 'رزرو یافت نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setRefundError(null);
    try {
      const r = await submitAnonymousRefund(booking.pnr, lastName.trim(), iban);
      setRefundResult({
        penaltyPct: r.penaltyPct,
        penaltyAmountIrr: r.penaltyAmountIrr,
        refundableIrr: r.refundableIrr,
      });
      setRefundOpen(false);
    } catch (err) {
      setRefundError(err instanceof ApiRequestError ? err.message : 'خطا در ثبت درخواست استرداد.');
    }
  }

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '41px 22px 65px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>مدیریت رزرو</h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>با کد رزرو و نام خانوادگی، بلیط خود را ببینید و در صورت نیاز استرداد کنید.</p>
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
            disabled={loading}
            style={{ flex: 'none', border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 26px', fontSize: 13.5, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'در حال جستجو…' : 'مشاهده رزرو'}
          </button>
          <div style={{ flexBasis: '100%', fontSize: 11, color: '#8a96a6' }}>کد رزرو در ایمیل/پیامک تأیید خرید برای شما ارسال شده است.</div>
          {lookupError && (
            <div data-testid="mb-lookup-error" style={{ flexBasis: '100%', borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>
              {lookupError}
            </div>
          )}
        </form>

        {/* BOOKING CARD */}
        {booking && (
          <div style={{ marginTop: 22 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.3)' }}>
              <div style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                  <span>✈</span> blujet
                </span>
                <span style={{ fontSize: 12 }}>
                  کد رزرو{' '}
                  <b dir="ltr" data-testid="mb-pnr-show" style={{ fontSize: 14, letterSpacing: 1 }}>
                    {booking.pnr}
                  </b>
                </span>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {booking.originCode}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{formatJalaliDateTime(booking.departureAt)}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: '#8a96a6', fontSize: 11 }}>
                  <div style={{ borderTop: '2px dashed #d5e1f0', margin: '8px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -10, right: '50%', transform: 'translateX(50%)', background: '#fff', padding: '0 8px', color: '#1668c4' }}>✈</span>
                  </div>
                  <div dir="ltr">{booking.flightNo}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {booking.destCode}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{formatJalaliDateTime(booking.arrivalAt)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '1px solid #f2f4f7' }}>
                {[
                  ['کلاس', booking.cabin === 'BUSINESS' ? 'بیزینس' : 'اکونومی'],
                  ['وضعیت', booking.status],
                  ['قیمت', `${faMoney(booking.priceIrr)} تومان`],
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
                  {booking.passengers.map((p) => (
                    <div key={p.seatCode ?? p.fullName} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#f7faff', border: '1px solid #e6eefb', borderRadius: 12, padding: '10px 13px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1668c4,#0d3b66)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>
                        {p.fullName.split(/\s+/).map((w) => w[0]).join('')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>{p.fullName}</div>
                        {p.seatCode && (
                          <div style={{ fontSize: 11, color: '#8a96a6' }}>
                            صندلی <span dir="ltr">{p.seatCode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f2f4f7', padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setRefundOpen(true)}
                  data-testid="mb-open-refund"
                  disabled={!!refundResult || booking.status !== 'TICKETED'}
                  style={{ border: '1.5px solid #f3d1d3', background: refundResult ? '#f6f8fb' : '#fff', color: refundResult ? '#aab8c8' : '#d64545', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: refundResult ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  استرداد بلیط
                </button>
                <button
                  type="button"
                  disabled
                  title="این قابلیت به‌زودی اضافه می‌شود."
                  style={{ border: '1.5px solid #e3e9f1', background: '#f6f8fb', color: '#aab8c8', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' }}
                >
                  تغییر صندلی <span style={{ fontSize: 10 }}>(به‌زودی)</span>
                </button>
                <button
                  type="button"
                  disabled
                  title="این قابلیت به‌زودی اضافه می‌شود."
                  style={{ marginRight: 'auto', border: 'none', background: '#e3e9f1', color: '#8a96a6', padding: '10px 20px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' }}
                >
                  دانلود بلیط <span style={{ fontSize: 10 }}>(به‌زودی)</span>
                </button>
              </div>
            </div>

            {/* REFUND DONE */}
            {refundResult && (
              <div style={{ marginTop: 16, background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1f8a5b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#0d2640' }}>درخواست استرداد ثبت شد</span>
                </div>
                <p style={{ fontSize: 12, color: '#3b5548', margin: '0 0 12px', lineHeight: 1.9 }}>
                  مبلغ قابل استرداد پس از کسر جریمه، طی ۳ تا ۷ روز کاری به کارت پرداخت‌کننده بازگردانده می‌شود.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  <div style={{ background: '#fff', border: '1px solid #d9eee0', borderRadius: 12, padding: '10px 13px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#7a8696', marginBottom: 3 }}>جریمه ({faDigits(refundResult.penaltyPct)}٪)</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2640' }}>
                      −{faMoney(refundResult.penaltyAmountIrr)} <span style={{ fontSize: 9, fontWeight: 400 }}>تومان</span>
                    </div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #d9eee0', borderRadius: 12, padding: '10px 13px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#7a8696', marginBottom: 3 }}>بازگشتی</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2640' }} data-testid="mb-refundable-result">
                      {faMoney(refundResult.refundableIrr)} <span style={{ fontSize: 9, fontWeight: 400 }}>تومان</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setBooking(null);
                setPnr('');
                setLastName('');
                setRefundResult(null);
              }}
              style={{ marginTop: 16, background: 'none', border: 'none', color: '#1668c4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ‹ جستجوی رزرو دیگر
            </button>
          </div>
        )}
      </div>

      {/* REFUND MODAL */}
      {refundOpen && booking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,38,64,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setRefundOpen(false)}>
          <form
            onSubmit={onSubmitRefund}
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 420, padding: '22px 22px 18px', boxShadow: '0 30px 70px -20px rgba(0,0,0,.45)' }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>استرداد بلیط</h2>
            <p style={{ fontSize: 11.5, color: '#6b7585', margin: '0 0 14px', lineHeight: 1.8 }}>
              شماره شبا حساب خود را وارد کنید. جریمه بر اساس قوانین نرخی بلیط و فاصله تا زمان پرواز محاسبه و نمایش داده می‌شود.
            </p>
            <label htmlFor="mb-iban" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
              شماره شبا
            </label>
            <input
              id="mb-iban"
              data-testid="mb-iban"
              dir="ltr"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="IR820170000000332211009900"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13, outline: 'none', marginBottom: 14 }}
            />
            {refundError && (
              <div data-testid="mb-refund-error" style={{ borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d', marginBottom: 14 }}>
                {refundError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                data-testid="mb-refund-confirm"
                disabled={iban.trim().length !== 26}
                style={{ flex: 1, border: 'none', borderRadius: 11, background: iban.trim().length === 26 ? '#d64545' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13, fontWeight: 800, cursor: iban.trim().length === 26 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
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
          </form>
        </div>
      )}
    </PublicPageShell>
  );
}
