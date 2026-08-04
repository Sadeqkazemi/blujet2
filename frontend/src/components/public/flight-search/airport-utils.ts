import type { StoredLocale } from '../../../hooks/useLocale';
import type { Airport } from '../../../types/public-site';

/** International hub codes from CLAUDE.md seed catalog — used for domestic/intl tabs. */
export const INTL_AIRPORT_CODES = new Set(['DXB', 'IST', 'NJF', 'TBS']);

export function isInternationalAirport(code: string): boolean {
  return INTL_AIRPORT_CODES.has(code.toUpperCase());
}

export function filterAirportsByService(airports: Airport[], service: 'domestic' | 'intl'): Airport[] {
  return airports.filter((a) =>
    service === 'intl' ? isInternationalAirport(a.code) : !isInternationalAirport(a.code),
  );
}

const CITY_NAMES: Record<string, Record<StoredLocale, string>> = {
  THR: { fa: 'تهران', en: 'Tehran', ar: 'طهران' },
  MHD: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' },
  IST: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' },
  DXB: { fa: 'دبی', en: 'Dubai', ar: 'دبي' },
  KIH: { fa: 'کیش', en: 'Kish', ar: 'كيش' },
  SYZ: { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' },
  IFN: { fa: 'اصفهان', en: 'Isfahan', ar: 'أصفهان' },
  TBZ: { fa: 'تبریز', en: 'Tabriz', ar: 'تبريز' },
  NJF: { fa: 'نجف', en: 'Najaf', ar: 'النجف' },
};

export function airportCityLabel(airport: Airport, locale: StoredLocale): string {
  return CITY_NAMES[airport.code]?.[locale] ?? airport.cityFa;
}

export function airportDisplayName(airport: Airport | undefined, locale: StoredLocale): string {
  if (!airport) return '';
  return airportCityLabel(airport, locale);
}
