export const FLIGHTOPS_AUTO_CLOSE_HOURS = 5;

/** Pure derivation of the design's "sale closes 5h before departure" rule
 * — distinct from, and independent of, the existing per-instance
 * saleStartsAt/saleEndsAt window (Phase 13). See docs/API.md's Phase 24
 * section for why this is not wired into booking creation. */
export function isSaleAutoClosed(
  departureAt: Date,
  now: Date = new Date(),
): boolean {
  return (
    departureAt.getTime() - now.getTime() <=
    FLIGHTOPS_AUTO_CLOSE_HOURS * 3_600_000
  );
}
