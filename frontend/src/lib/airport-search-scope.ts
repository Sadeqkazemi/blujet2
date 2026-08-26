import type { Airport } from '../types/public-site';

export type FlightSearchScope = 'domestic' | 'intl';

const IRAN_INTERNATIONAL_IATA = new Set([
  'IKA', 'MHD', 'SYZ', 'IFN', 'TBZ', 'KIH', 'GSM', 'BND', 'AWZ', 'RAS',
  'SRY', 'GBT', 'KER', 'KSH', 'OMH', 'ADU', 'ZAH', 'BUZ', 'AZD', 'PGU',
  'ABD', 'XBJ', 'LRR', 'LFM', 'AJK', 'JAR', 'IMQ',
]);

export function isIranianInternationalAirport(airport: Airport): boolean {
  if (airport.isInternational) return false;
  return IRAN_INTERNATIONAL_IATA.has(airport.code.toUpperCase());
}

/** `isInternational` in the persisted catalog means outside Iran. */
export function airportsForSearchScope(
  airports: Airport[],
  scope: FlightSearchScope,
): Airport[] {
  if (scope === 'domestic') return airports.filter((airport) => !airport.isInternational);
  return airports.filter(
    (airport) => airport.isInternational || isIranianInternationalAirport(airport),
  );
}
