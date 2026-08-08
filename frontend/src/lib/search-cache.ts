/** Search-results invalidation + publishStatus filter (PR #126 contract). */

export const SEARCH_RESULTS_INVALIDATE_EVENT = 'blujet:search-results-invalidate';

export function invalidateSearchResultsCache(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SEARCH_RESULTS_INVALIDATE_EVENT));
}

export function onSearchResultsInvalidate(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = () => handler();
  window.addEventListener(SEARCH_RESULTS_INVALIDATE_EVENT, listener);
  return () => window.removeEventListener(SEARCH_RESULTS_INVALIDATE_EVENT, listener);
}

/**
 * Backend search only returns sellable rows, but if publishStatus is present
 * keep only PUBLISHED. Rows without status pass through (legacy payloads).
 */
export function filterSellableSearchFlights<
  T extends { definitionStatus?: string; publishStatus?: string },
>(rows: T[]): T[] {
  return rows.filter((row) => {
    const status = row.publishStatus ?? row.definitionStatus;
    if (!status) return true;
    const upper = String(status).toUpperCase();
    return upper === 'PUBLISHED' || upper === 'APPROVED';
  });
}
