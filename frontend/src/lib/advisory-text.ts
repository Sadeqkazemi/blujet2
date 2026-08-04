import type { StoredLocale } from '../hooks/useLocale';
import type { PriceAdvisoryResult } from '../types/public-site';

/** fa/ar use ML Persian text; en gets a locale-aware summary until ML returns en. */
export function formatAdvisoryExplanation(
  advisory: Extract<PriceAdvisoryResult, { available: true }>,
  locale: StoredLocale,
): string {
  if (locale === 'en') {
    return advisory.recommendation === 'BUY_NOW'
      ? 'Based on recent fare trends for this route, prices may rise soon.'
      : 'Based on recent fare trends for this route, waiting may lower the price.';
  }
  return advisory.explanationFa;
}
