/** Lightweight search-results invalidation signal (no parallel cache layer). */

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

const SELLABLE = new Set(['PUBLISHED', 'APPROVED', 'PENDING_REVISION', 'SCHEDULED']);

/** Drop unpublished / CEO-pending rows if the API includes a status field. */
export function filterSellableSearchFlights<
  T extends { definitionStatus?: string; publishStatus?: string },
>(rows: T[]): T[] {
  return rows.filter((row) => {
    const status = row.publishStatus ?? row.definitionStatus;
    if (!status) return true;
    return SELLABLE.has(String(status).toUpperCase());
  });
}
