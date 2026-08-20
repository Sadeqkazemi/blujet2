import { latinDigits } from '../../../lib/fa-format';
import type { PassengerFormDraft } from './checkout-types';

export const MAX_SEATS_PER_NATIONAL_ID = 2;

function normalizeNationalIdInput(value: string): string {
  return latinDigits(value).replace(/\D/g, '');
}

/**
 * Returns national IDs (normalized) that would occupy more than
 * {@link MAX_SEATS_PER_NATIONAL_ID} seats in this checkout party.
 * Infants without seats are ignored.
 */
export function nationalIdsExceedingSeatLimit(
  passengers: ReadonlyArray<
    Pick<PassengerFormDraft, 'nationalId' | 'docType' | 'passengerType'>
  >,
  max = MAX_SEATS_PER_NATIONAL_ID,
): string[] {
  const counts = new Map<string, number>();
  for (const passenger of passengers) {
    if (passenger.passengerType === 'INFANT') continue;
    if (passenger.docType !== 'NATIONAL_ID') continue;
    const nid = normalizeNationalIdInput(passenger.nationalId);
    if (nid.length < 10) continue;
    counts.set(nid, (counts.get(nid) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > max)
    .map(([nid]) => nid);
}
