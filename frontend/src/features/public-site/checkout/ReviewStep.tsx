import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';
import { CHECKOUT_COPY } from './checkout-copy';
import { extraTitle, passengerFullName, type ExtraServiceState, type PassengerFormDraft } from './checkout-types';

export default function ReviewStep({
  locale,
  passengers,
  extras,
  selectedSeats,
}: {
  locale: StoredLocale;
  passengers: PassengerFormDraft[];
  extras: ExtraServiceState[];
  selectedSeats: string[];
}) {
  const t = CHECKOUT_COPY[locale];
  const picked = extras.filter((e) => e.selected).map((e) => extraTitle(e, locale));
  const genderLabel = (g: PassengerFormDraft['gender']) =>
    g === 'female' ? t.female : g === 'male' ? t.male : t.noneSelected;

  return (
    <section
      className="rounded-[15px] border border-[#eef1f5] bg-white px-[17px] py-4"
      data-testid="checkout-review-step"
    >
      <div className="mb-[15px] flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#eef4fb] text-[#1668c4]">
          ✓
        </span>
        <h2 className="m-0 text-[15.5px] font-extrabold text-[#0d2640]">{t.confirmDetails}</h2>
      </div>

      <div className="mb-3 overflow-hidden rounded-[13px] border border-[#eef1f5]">
        <div className="grid grid-cols-2 gap-0 bg-[#f8fafc] px-3.5 py-2.5 text-[10.5px] font-bold text-[#8a96a6] md:grid-cols-4">
          <span>{t.passenger}</span>
          <span>{t.document}</span>
          <span className="hidden md:inline">{t.dateOfBirth}</span>
          <span className="hidden md:inline">{t.gender}</span>
        </div>
        {passengers.map((p, i) => {
          const doc = p.docType === 'PASSPORT' ? p.passportNo || t.passport : p.nationalId || t.nationalId;
          const birth =
            p.birthDay && p.birthMonth && p.birthYear
              ? `${locale === 'en' ? p.birthYear : faDigits(p.birthYear)}/${
                  locale === 'en' ? p.birthMonth : faDigits(p.birthMonth)
                }/${locale === 'en' ? p.birthDay : faDigits(p.birthDay)}`
              : t.noneSelected;
          return (
            <div
              key={i}
              className="grid grid-cols-2 items-center border-t border-[#f0f2f6] px-3.5 py-3 text-xs md:grid-cols-4"
            >
              <span className="font-bold text-[#0d2640]">{passengerFullName(p)}</span>
              <span className="font-mono text-[11.5px] text-[#3b4554]" dir="ltr">
                {doc}
              </span>
              <span className="hidden text-[#3b4554] md:inline">{birth}</span>
              <span className="hidden text-[#3b4554] md:inline">{genderLabel(p.gender)}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-[#eef1f5] bg-[#f8fafc] px-3.5 py-3">
          <div className="mb-1 text-[10.5px] text-[#8a96a6]">{t.selectedExtras}</div>
          <div className="text-xs font-bold leading-relaxed text-[#0d2640]">
            {picked.length ? picked.join(' · ') : t.noneSelected}
          </div>
        </div>
        <div className="rounded-xl border border-[#eef1f5] bg-[#f8fafc] px-3.5 py-3">
          <div className="mb-1 text-[10.5px] text-[#8a96a6]">{t.seat}</div>
          <div className="text-xs font-bold text-[#0d2640]" dir="ltr">
            {selectedSeats.join(', ') || t.noneSelected}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[11px] border border-[#f0dcae] bg-[#fff9ee] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#96701a]">
        {t.nameChangeWarning}
      </div>
    </section>
  );
}
