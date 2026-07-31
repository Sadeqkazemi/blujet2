import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchClubPoints,
  fetchMyBooking,
  fetchWallet,
  payBooking,
  topupWallet,
} from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import {
  canPayWithMethod,
  canPayWithPoints,
  canPayWithWallet,
  pickDefaultPaymentMethod,
  pointsNeededForPrice,
  type CheckoutPaymentMethod,
} from '../../lib/checkout-payment';
import { faDigits, faMoney, parseTomanToRial } from '../../lib/fa-format';
import { GATEWAY_CHECKOUT_ENABLED } from '../../lib/payment-config';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';

export default function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [walletBalanceIrr, setWalletBalanceIrr] = useState<number | null>(null);
  const [clubPoints, setClubPoints] = useState<{ isMember: boolean; balance: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<{ previousPriceIrr: number; currentPriceIrr: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('WALLET');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const methodInitialized = useRef(false);

  useEffect(() => {
    if (!bookingId) return;
    fetchMyBooking(bookingId)
      .then(setBooking)
      .catch(() => setLoadError('رزرو یافت نشد.'));
    fetchWallet()
      .then((w) => setWalletBalanceIrr(w.balanceIrr))
      .catch(() => setWalletBalanceIrr(0));
    fetchClubPoints()
      .then((p) => setClubPoints({ isMember: p.isMember, balance: p.balance }))
      .catch(() => setClubPoints({ isMember: false, balance: 0 }));
  }, [bookingId]);

  const amountDue = priceChange?.currentPriceIrr ?? booking?.priceIrr ?? 0;

  useEffect(() => {
    if (!booking || methodInitialized.current) return;
    if (walletBalanceIrr === null || clubPoints === null) return;

    setPaymentMethod(
      pickDefaultPaymentMethod({
        gatewayEnabled: GATEWAY_CHECKOUT_ENABLED,
        walletBalanceIrr,
        isClubMember: clubPoints.isMember,
        clubPointsBalance: clubPoints.balance,
        priceIrr: amountDue,
      }),
    );
    methodInitialized.current = true;
  }, [booking, walletBalanceIrr, clubPoints, amountDue]);

  const payOpts = {
    gatewayEnabled: GATEWAY_CHECKOUT_ENABLED,
    walletBalanceIrr,
    isClubMember: clubPoints?.isMember ?? false,
    clubPointsBalance: clubPoints?.balance ?? 0,
    priceIrr: amountDue,
  };

  const canPay = canPayWithMethod(paymentMethod, payOpts);
  const walletShortfallIrr =
    walletBalanceIrr !== null && walletBalanceIrr < amountDue ? amountDue - walletBalanceIrr : 0;
  const showTopup =
    paymentMethod === 'WALLET' &&
    walletBalanceIrr !== null &&
    walletShortfallIrr > 0 &&
    !GATEWAY_CHECKOUT_ENABLED;

  async function onTopup() {
    const amountRial = parseTomanToRial(topupAmount);
    if (amountRial === null || amountRial <= 0) {
      setPayError('مبلغ شارژ معتبر وارد کنید.');
      return;
    }
    setPayError(null);
    setTopupBusy(true);
    try {
      const result = await topupWallet(amountRial);
      setWalletBalanceIrr(result.balanceIrr);
      setTopupAmount('');
    } catch (err) {
      setPayError(err instanceof ApiRequestError ? err.message : 'خطا در شارژ کیف پول.');
    } finally {
      setTopupBusy(false);
    }
  }

  async function onPay(confirmedPriceIrr?: number) {
    if (!bookingId || !canPay) return;
    setPayError(null);
    setPaying(true);
    try {
      const result = await payBooking(bookingId, {
        confirmedPriceIrr,
        promoCode: promoCode.trim() || undefined,
        paymentMethod,
      });
      if (result.priceChanged) {
        setPriceChange(result);
        methodInitialized.current = false;
        return;
      }
      navigate(`/ticket/${result.booking.pnr}`);
    } catch (err) {
      setPayError(err instanceof ApiRequestError ? err.message : 'خطا در پرداخت.');
    } finally {
      setPaying(false);
    }
  }

  if (loadError) {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-red-600">{loadError}</p>
      </PublicPageShell>
    );
  }
  if (!booking) {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>
      </PublicPageShell>
    );
  }

  if (booking.status === 'EXPIRED') {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-md p-8 text-center">
          <p className="mb-4 text-sm text-red-600">مهلت نگهداری این رزرو به پایان رسیده است.</p>
          <button onClick={() => navigate('/')} className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white">
            جستجوی مجدد
          </button>
        </div>
      </PublicPageShell>
    );
  }

  const walletDisabled =
    walletBalanceIrr !== null && !canPayWithWallet(walletBalanceIrr, amountDue);
  const pointsDisabled =
    !clubPoints?.isMember ||
    !canPayWithPoints(clubPoints?.isMember ?? false, clubPoints?.balance ?? 0, amountDue);

  const methods: { key: CheckoutPaymentMethod; label: string; disabled?: boolean; hint?: string }[] = [
    {
      key: 'GATEWAY',
      label: GATEWAY_CHECKOUT_ENABLED ? 'درگاه پرداخت' : 'درگاه پرداخت (به‌زودی)',
      disabled: !GATEWAY_CHECKOUT_ENABLED,
    },
    {
      key: 'WALLET',
      label: `کیف پول${walletBalanceIrr !== null ? ` (${faMoney(walletBalanceIrr)} تومان)` : ''}`,
      disabled: walletDisabled,
      hint: walletDisabled ? 'موجودی کافی نیست — کیف پول را شارژ کنید' : undefined,
    },
    {
      key: 'POINTS',
      label: `امتیاز باشگاه مشتریان${
        clubPoints?.isMember ? ` (${faDigits(String(clubPoints.balance))} امتیاز)` : ''
      }`,
      disabled: pointsDisabled,
      hint: clubPoints?.isMember && pointsDisabled
        ? `حداقل ${faDigits(String(pointsNeededForPrice(amountDue)))} امتیاز لازم است`
        : !clubPoints?.isMember
          ? 'فقط برای اعضای باشگاه'
          : undefined,
    },
  ];

  return (
    <PublicPageShell>
    <FlowStepper current="checkout" onBack={() => navigate(-1)} />
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-lg font-extrabold text-[#0d2640]">تکمیل خرید</h1>
      <div className="mb-4 rounded-2xl border border-[#e5e9f0] bg-white p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-[#0d2640]">{booking.flightNo}</span>
          <span className="text-[#6b7b94]">
            {booking.originCode} ← {booking.destCode}
          </span>
        </div>
        <div className="mb-3 text-xs text-[#6b7b94]">{formatJalaliDateTime(booking.departureAt)}</div>
        <div className="flex flex-col gap-1">
          {booking.passengers.map((p) => (
            <div key={p.seatCode} className="flex justify-between text-xs text-[#6b7b94]">
              <span>{p.fullName}</span>
              <span className="font-num">{p.seatCode}</span>
            </div>
          ))}
        </div>
      </div>

      {priceChange ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <p className="mb-2 text-xs text-amber-800">قیمت این پرواز تغییر کرده است.</p>
          <p className="font-num mb-4 text-sm font-extrabold text-amber-900">
            قیمت جدید: {faMoney(priceChange.currentPriceIrr)} تومان
          </p>
          <button
            disabled={paying || !canPay}
            onClick={() => onPay(priceChange.currentPriceIrr)}
            data-testid="confirm-new-price"
            className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            تأیید قیمت جدید و پرداخت
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e5e9f0] bg-white p-5">
          <div className="mb-4">
            <label htmlFor="promo-code" className="mb-1.5 block text-xs text-[#6b7b94]">
              کد تخفیف
            </label>
            <input
              id="promo-code"
              data-testid="promo-code-input"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="مثال: BLUE20"
              className="w-full rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
            />
          </div>

          <div className="mb-4">
            <div className="mb-1.5 text-xs text-[#6b7b94]">روش پرداخت</div>
            <div className="flex flex-col gap-2">
              {methods.map((m) => (
                <label
                  key={m.key}
                  className={`flex flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 text-xs ${
                    m.disabled ? 'cursor-not-allowed border-[#e5e9f0] text-[#9fb0c7]' : 'cursor-pointer border-[#e5e9f0]'
                  } ${paymentMethod === m.key && !m.disabled ? 'border-[#1668c4]' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="payment-method"
                      disabled={m.disabled}
                      checked={paymentMethod === m.key}
                      onChange={() => setPaymentMethod(m.key)}
                      data-testid={`payment-method-${m.key}`}
                    />
                    {m.label}
                  </span>
                  {m.hint && <span className="pr-6 text-[10px] leading-5 text-[#9fb0c7]">{m.hint}</span>}
                </label>
              ))}
            </div>
          </div>

          {showTopup && (
            <div
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
              data-testid="checkout-wallet-topup"
            >
              <p className="mb-2 text-xs text-amber-900">
                برای پرداخت این رزرو حداقل {faMoney(walletShortfallIrr)} تومان دیگر شارژ کنید.
              </p>
              <label htmlFor="checkout-topup-amount" className="mb-1.5 block text-xs text-[#6b7b94]">
                مبلغ شارژ (تومان)
              </label>
              <div className="flex gap-2">
                <input
                  id="checkout-topup-amount"
                  data-testid="checkout-topup-amount"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder={faMoney(walletShortfallIrr)}
                  className="min-w-0 flex-1 rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
                />
                <button
                  type="button"
                  disabled={topupBusy}
                  onClick={onTopup}
                  data-testid="checkout-topup-submit"
                  className="shrink-0 rounded-lg bg-[#0d2640] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {topupBusy ? '…' : 'شارژ'}
                </button>
              </div>
            </div>
          )}

          {payError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{payError}</p>}

          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-[#6b7b94]">مبلغ قابل پرداخت</span>
            <span className="font-num text-lg font-black text-[#1668c4]">{faMoney(booking.priceIrr)} تومان</span>
          </div>
          <button
            disabled={paying || !canPay}
            onClick={() => onPay()}
            data-testid="pay-submit"
            className="w-full rounded-lg bg-[#1668c4] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {paying ? 'در حال پرداخت…' : 'پرداخت و صدور بلیط'}
          </button>
          {!canPay && (
            <p className="mt-2 text-center text-[10px] text-[#9fb0c7]" data-testid="pay-blocked-hint">
              {showTopup
                ? 'پس از شارژ کافی کیف پول، دکمه پرداخت فعال می‌شود.'
                : 'روش پرداخت انتخاب‌شده برای این مبلغ در دسترس نیست.'}
            </p>
          )}
        </div>
      )}
    </div>
    </PublicPageShell>
  );
}
