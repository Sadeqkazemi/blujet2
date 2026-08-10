import { useMemo, useState } from 'react';
import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits, normalizeIranMobile } from '../../../lib/fa-format';
import type { SavedPassenger } from '../../../types/public-site';
import { CHECKOUT_COPY } from './checkout-copy';
import {
  resolveCheckoutSavedPassengers,
  savedOptionToPassengerPatch,
  type CheckoutSavedPaxOption,
} from './checkout-saved-pax';
import { emptyPassenger, type PassengerFormDraft } from './checkout-types';

const inputCls =
  'h-[46px] w-full rounded-[10px] border-[1.5px] border-[#e2e7ee] bg-white px-3.5 text-sm outline-none focus:border-[#1668c4]';

function latinOnly(value: string): string {
  return value.replace(/[^A-Za-z\s'-]/g, '').toUpperCase();
}

function DocRadio({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#3b4554]"
    >
      <span
        className={`flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 ${
          active ? 'border-[#1668c4]' : 'border-[#ccd3dd]'
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-[#1668c4]" />}
      </span>
      {label}
    </button>
  );
}

function UserIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  );
}

function JalaliDobSelects({
  locale,
  day,
  month,
  year,
  onDay,
  onMonth,
  onYear,
}: {
  locale: StoredLocale;
  day: string;
  month: string;
  year: string;
  onDay: (v: string) => void;
  onMonth: (v: string) => void;
  onYear: (v: string) => void;
}) {
  const t = CHECKOUT_COPY[locale];
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  // fa: Jalali years; en/ar: Gregorian — matches تکمیل خرید.dc.html
  const years =
    locale === 'fa'
      ? Array.from({ length: 80 }, (_, i) => String(1405 - i))
      : Array.from({ length: 60 }, (_, i) => String(1946 + i));
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1fr] overflow-hidden rounded-[10px] border-[1.5px] border-[#e2e7ee] bg-white">
      <select
        value={day}
        onChange={(e) => onDay(e.target.value)}
        className="h-[43px] border-none bg-transparent px-2.5 text-[12.5px] text-[#5a6678] outline-none"
      >
        <option value="">{t.day}</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {locale === 'en' ? d : faDigits(d)}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onMonth(e.target.value)}
        className="h-[43px] border-x-[1.5px] border-x-[#eef1f5] border-y-0 bg-transparent px-2.5 text-[12.5px] text-[#5a6678] outline-none"
      >
        <option value="">{t.month}</option>
        {t.months.map((m, mi) => (
          <option key={m} value={String(mi + 1)}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onYear(e.target.value)}
        className="h-[43px] border-none bg-transparent px-2.5 text-[12.5px] text-[#5a6678] outline-none"
      >
        <option value="">{t.year}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {locale === 'en' ? y : faDigits(y)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PassengerStep({
  locale,
  passengers,
  onChange,
  savedPassengers,
}: {
  locale: StoredLocale;
  passengers: PassengerFormDraft[];
  onChange: (next: PassengerFormDraft[]) => void;
  savedPassengers: SavedPassenger[];
}) {
  const t = CHECKOUT_COPY[locale];
  const passengerLabel = (passenger: PassengerFormDraft, index: number) => {
    if (passenger.passengerType === 'CHILD') {
      return locale === 'en'
        ? `Child ${index + 1}`
        : locale === 'ar'
          ? `طفل ${index + 1}`
          : `کودک ${index + 1}`;
    }
    if (passenger.passengerType === 'INFANT') {
      return locale === 'en'
        ? `Infant ${index + 1}`
        : locale === 'ar'
          ? `رضيع ${index + 1}`
          : `نوزاد ${index + 1}`;
    }
    return t.adultLabel(index + 1);
  };
  const [openSavedFor, setOpenSavedFor] = useState<number | null>(null);
  const savedOptions = useMemo(
    () => resolveCheckoutSavedPassengers(savedPassengers, locale),
    [savedPassengers, locale],
  );

  function update(i: number, patch: Partial<PassengerFormDraft>) {
    onChange(passengers.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function applySaved(i: number, opt: CheckoutSavedPaxOption) {
    update(i, savedOptionToPassengerPatch(opt));
    setOpenSavedFor(null);
  }

  return (
    <section
      className="rounded-[15px] border border-[#eef1f5] bg-white px-[17px] py-4"
      data-testid="checkout-pax-step"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#eef4fb] text-[#1668c4]">
          👤
        </span>
        <h2 className="m-0 text-[15.5px] font-extrabold text-[#0d2640]">
          {t.enterPax}
        </h2>
      </div>

      {passengers.map((p, i) => (
        <div
          key={i}
          className="mb-3 rounded-[13px] border border-[#eef1f5] p-[15px]"
          data-testid={`checkout-pax-card-${i}`}
        >
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-3.5">
              <span
                className="text-[13px] font-extrabold text-[#0d2640]"
                data-testid={`checkout-pax-type-${i}`}
              >
                {passengerLabel(p, i)}
              </span>
              <DocRadio
                active={p.docType === 'NATIONAL_ID'}
                label={t.nationalId}
                onClick={() => update(i, { docType: 'NATIONAL_ID' })}
              />
              <DocRadio
                active={p.docType === 'PASSPORT'}
                label={t.passport}
                onClick={() => update(i, { docType: 'PASSPORT' })}
              />
            </div>
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                className="flex items-center gap-1 text-[11.5px] font-bold text-[#1668c4]"
                data-testid={`checkout-scan-doc-${i}`}
                onClick={() => undefined}
              >
                {t.scanDocument}
              </button>
              <button
                type="button"
                onClick={() => setOpenSavedFor(openSavedFor === i ? null : i)}
                className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#1668c4]"
                data-testid={`checkout-from-saved-${i}`}
                aria-expanded={openSavedFor === i}
              >
                <UserIcon />
                {t.fromSaved}
              </button>
              {passengers.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(passengers.filter((_, j) => j !== i))}
                  className="text-[11px] font-bold text-[#e5484d]"
                >
                  {t.remove}
                </button>
              )}
            </div>
          </div>

          {openSavedFor === i && (
            <div
              className="mb-3 rounded-[11px] border border-[#dce8f7] bg-[#f6faff] px-3 py-2.5"
              data-testid={`checkout-saved-panel-${i}`}
            >
              <div className="mb-2 text-[11px] font-bold text-[#0d2640]">
                {t.selectSaved}
              </div>
              {savedOptions.length === 0 ? (
                <p className="m-0 text-[11.5px] text-[#5a6678]">
                  {t.savedEmpty}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {savedOptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applySaved(i, s)}
                      data-testid={`checkout-saved-chip-${s.id}`}
                      className="cursor-pointer rounded-[18px] border-[1.5px] border-[#cfe0f2] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#0d2640] hover:border-[#1668c4] hover:text-[#1668c4]"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-[11px] sm:grid-cols-3">
            <input
              data-testid={`checkout-pax-first-${i}`}
              dir="ltr"
              value={p.firstNameLatin}
              onChange={(e) =>
                update(i, { firstNameLatin: latinOnly(e.target.value) })
              }
              placeholder={t.firstNameLatin}
              className={inputCls}
            />
            <input
              data-testid={`checkout-pax-last-${i}`}
              dir="ltr"
              value={p.lastNameLatin}
              onChange={(e) =>
                update(i, { lastNameLatin: latinOnly(e.target.value) })
              }
              placeholder={t.lastNameLatin}
              className={inputCls}
            />
            <select
              data-testid={`checkout-pax-gender-${i}`}
              value={p.gender}
              onChange={(e) =>
                update(i, {
                  gender: e.target.value as PassengerFormDraft['gender'],
                })
              }
              className={`${inputCls} text-[#5a6678]`}
            >
              <option value="">{t.gender}</option>
              <option value="female">{t.female}</option>
              <option value="male">{t.male}</option>
            </select>
          </div>

          {p.docType === 'NATIONAL_ID' ? (
            <div className="mt-3.5 grid grid-cols-1 gap-[11px] sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold text-[#8a96a6]">
                  {t.nationalId}
                </div>
                <input
                  data-testid={`checkout-pax-nid-${i}`}
                  dir="ltr"
                  value={p.nationalId}
                  onChange={(e) =>
                    update(i, {
                      nationalId: normalizeIranMobile(e.target.value).slice(
                        0,
                        10,
                      ),
                    })
                  }
                  placeholder="0012345678"
                  className={`${inputCls} font-mono text-[13px]`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold text-[#8a96a6]">
                  {t.dateOfBirth}
                </div>
                <JalaliDobSelects
                  locale={locale}
                  day={p.birthDay}
                  month={p.birthMonth}
                  year={p.birthYear}
                  onDay={(v) => update(i, { birthDay: v })}
                  onMonth={(v) => update(i, { birthMonth: v })}
                  onYear={(v) => update(i, { birthYear: v })}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3.5 grid grid-cols-1 gap-[11px] sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold text-[#8a96a6]">
                  {t.passportNo}
                </div>
                <input
                  data-testid={`checkout-pax-passport-${i}`}
                  dir="ltr"
                  value={p.passportNo}
                  onChange={(e) =>
                    update(i, { passportNo: e.target.value.toUpperCase() })
                  }
                  placeholder="K12345678"
                  className={`${inputCls} font-mono text-[13px]`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold text-[#8a96a6]">
                  {t.dateOfBirth}
                </div>
                <JalaliDobSelects
                  locale={locale}
                  day={p.birthDay}
                  month={p.birthMonth}
                  year={p.birthYear}
                  onDay={(v) => update(i, { birthDay: v })}
                  onMonth={(v) => update(i, { birthMonth: v })}
                  onYear={(v) => update(i, { birthYear: v })}
                />
              </div>
            </div>
          )}

          {p.seatCode ? (
            <div className="mt-2 text-[11px] text-[#8a96a6]">
              {t.seat}:{' '}
              <span className="font-bold text-[#1668c4]" dir="ltr">
                {p.seatCode}
              </span>
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...passengers, emptyPassenger('', 'ADULT')])}
        data-testid="checkout-add-pax"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[11px] border-[1.5px] border-[#1668c4] px-[18px] py-[11px] text-[12.5px] font-bold text-[#1668c4]"
      >
        <span className="text-base leading-none">+</span>
        {t.addPax}
      </button>
    </section>
  );
}
