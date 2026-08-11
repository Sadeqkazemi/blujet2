import { Link } from 'react-router-dom';
import type { StoredLocale } from '../../../hooks/useLocale';
import { localeMoney } from '../../../lib/fa-format';
import { localeDigits } from '../../../lib/locale-format';
import { CHECKOUT_COPY } from './checkout-copy';
import {
  extraTitle,
  extraTotalIrr,
  type ExtraServiceState,
} from './checkout-types';

export default function PricingSidebar({
  locale,
  priceIrr,
  paxCount,
  extras,
  nextLabel,
  onNext,
  onBack,
  canBack,
  busy,
  error,
  /** When true, omit primary CTA (mobile sticky bar owns it). */
  hideActions = false,
}: {
  locale: StoredLocale;
  priceIrr: string;
  paxCount: number;
  extras: ExtraServiceState[];
  nextLabel: string;
  onNext: () => void;
  onBack?: () => void;
  canBack: boolean;
  busy?: boolean;
  error?: string | null;
  hideActions?: boolean;
}) {
  const t = CHECKOUT_COPY[locale];
  const ticketIrr = BigInt(priceIrr || '0');
  const extrasIrr = extras
    .filter((e) => e.selected)
    .reduce((sum, extra) => sum + extraTotalIrr(extra, paxCount), 0n);
  const grandIrr = ticketIrr + extrasIrr;
  return (
    <aside
      className="flex flex-col rounded-[18px] border border-[#eef1f5] bg-white p-[22px] lg:sticky lg:top-[90px]"
      data-testid="checkout-pricing-sidebar"
    >
      <div className="mb-4 text-[16.5px] font-extrabold text-[#0d2640]">
        {t.paymentDetails}
      </div>

      <div className="mb-4 overflow-hidden rounded-[13px] border border-[#eef1f5]">
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#eef1f5] bg-[#f8fafc] px-3.5 py-2 text-[10.5px] font-bold text-[#8a96a6]">
          <span>{t.description}</span>
          <span>{t.amountToman}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3.5 py-2.5 text-[13px] text-[#5a6678]">
          <span>
            {locale === 'en'
              ? t.ticketPrice(paxCount)
              : t
                  .ticketPrice(paxCount)
                  .replace(String(paxCount), localeDigits(paxCount, locale))}
          </span>
          <span className="font-bold text-[#16202e]">
            {localeMoney(ticketIrr.toString(), locale)}
          </span>
        </div>
        {extras
          .filter((e) => e.selected)
          .map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-[#eef1f5] px-3.5 py-2.5 text-[13px] text-[#5a6678]"
            >
              <span className="truncate">{extraTitle(e, locale)}</span>
              <span className="font-bold text-[#16202e]">
                {localeMoney(extraTotalIrr(e, paxCount).toString(), locale)}
              </span>
            </div>
          ))}
      </div>

      <div className="mb-3.5 flex items-center justify-between rounded-[13px] bg-[#eef4fb] px-4 py-3.5">
        <span className="text-[14.5px] font-extrabold text-[#0d2640]">
          {t.total}
        </span>
        <span className="text-[19px] font-black text-[#1668c4]">
          {localeMoney(grandIrr.toString(), locale)}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-1.5 text-[11.5px] text-[#8a96a6]">
        🔒 {t.securePayment}
      </div>

      {!hideActions && (
        <>
          <p className="mb-4 text-xs leading-relaxed text-[#9aa4b2]">
            {t.agreeTerms}{' '}
            <Link to="/terms" className="text-[#1668c4] no-underline">
              {t.termsLink}
            </Link>
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={onNext}
            data-testid="checkout-next"
            className="flex h-14 items-center justify-center rounded-[14px] bg-[#1668c4] text-[15px] font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(22,104,196,.55)] disabled:opacity-60"
          >
            {busy ? t.loading : nextLabel}
          </button>

          {canBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              data-testid="checkout-back-step"
              className="mt-2.5 flex h-12 items-center justify-center rounded-[14px] border border-[#e6eaf0] bg-[#f2f5f9] text-[13.5px] font-bold text-[#0d2640]"
            >
              {t.backStep}
            </button>
          )}
        </>
      )}

      {error && (
        <div
          className="mt-2.5 rounded-[10px] border border-[#f5c6c6] bg-[#fdecec] px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-[#c0343a]"
          data-testid="checkout-error"
        >
          {error}
        </div>
      )}
    </aside>
  );
}
