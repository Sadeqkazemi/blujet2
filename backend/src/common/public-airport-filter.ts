/** Persian labels used by e2e/dev fixtures — must not appear in public search pickers. */
export const TEST_AIRPORT_CITY_PREFIXES = ['شهر آزمایش', 'شهر تست'] as const;

export function isTestAirportCity(cityFa: string): boolean {
  return TEST_AIRPORT_CITY_PREFIXES.some((prefix) => cityFa.startsWith(prefix));
}

export function filterPublicSearchAirports<T extends { cityFa: string }>(
  airports: T[],
): T[] {
  return airports.filter((a) => !isTestAirportCity(a.cityFa));
}
