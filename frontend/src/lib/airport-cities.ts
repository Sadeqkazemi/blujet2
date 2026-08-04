import type { StoredLocale } from '../hooks/useLocale';
import type { Airport } from '../types/public-site';

/** Known airport cities — matches design-reference-v2 CITY_NAMES. */
export const AIRPORT_CITY_NAMES: Record<string, Record<StoredLocale, string>> = {
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

/** Static fallback when /search/airports has not loaded yet or fails — matches the design bundle city list. */
export const FALLBACK_AIRPORTS: Airport[] = Object.entries(AIRPORT_CITY_NAMES).map(
  ([code, names]) => ({
    id: `fallback-${code}`,
    code,
    cityFa: names.fa,
    tz: code === 'IST' ? 'Europe/Istanbul' : code === 'DXB' ? 'Asia/Dubai' : 'Asia/Tehran',
  }),
);

export function airportCityName(
  code: string,
  locale: StoredLocale,
  cityFa?: string,
): string {
  const normalized = code.toUpperCase();
  return AIRPORT_CITY_NAMES[normalized]?.[locale] ?? cityFa ?? normalized;
}

/** Design bundle pattern: «تهران (THR)» in search summaries and edit modal fields. */
export function airportCityLabel(
  code: string,
  locale: StoredLocale,
  cityFa?: string,
): string {
  const city = airportCityName(code, locale, cityFa);
  const normalized = code.toUpperCase();
  if (city === normalized) return normalized;
  return `${city} (${normalized})`;
}
