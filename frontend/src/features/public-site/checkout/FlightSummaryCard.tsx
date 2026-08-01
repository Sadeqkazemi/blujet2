import type { StoredLocale } from '../../../hooks/useLocale';
import { airportCityName } from '../../../lib/airport-cities';
import { formatJalaliDateTime } from '../../../lib/jalali';
import type { FlightSnapshot } from './checkout-types';

const CABIN_LABEL: Record<string, Record<StoredLocale, string>> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

export default function FlightSummaryCard({
  flight,
  cabin,
  locale,
}: {
  flight: FlightSnapshot;
  cabin: string;
  locale: StoredLocale;
}) {
  const origin = airportCityName(flight.originCode, locale);
  const dest = airportCityName(flight.destCode, locale);
  const meta = [
    'blujet',
    flight.aircraftType ?? flight.flightNo,
    formatJalaliDateTime(flight.departureAt).split(' ')[0],
  ].join(' · ');

  return (
    <section
      className="flex min-h-[130px] flex-wrap items-center justify-between gap-3.5 rounded-[15px] border border-[#eef1f5] bg-white px-[18px] py-8"
      data-testid="checkout-flight-summary"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#1668c4] text-base text-white">
          ✈
        </span>
        <div className="leading-relaxed">
          <div className="text-base font-extrabold text-[#0d2640]">
            {origin} {locale === 'en' ? 'to' : locale === 'ar' ? 'إلى' : 'به'} {dest}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#8a96a6]" dir="ltr">
            {meta}
          </div>
        </div>
      </div>
      <span className="flex-none rounded-2xl border border-[#cdeadb] bg-[#e9f6ef] px-3 py-1.5 text-[11px] font-bold text-[#1f8a5b]">
        {CABIN_LABEL[cabin]?.[locale] ?? cabin}
      </span>
    </section>
  );
}
