import { describe, expect, it } from 'vitest';
import { filterSellableSearchFlights } from './search-cache';

describe('filterSellableSearchFlights', () => {
  it('keeps PUBLISHED/APPROVED rows and drops pending CEO drafts', () => {
    const rows = [
      { id: '1', publishStatus: 'PUBLISHED' },
      { id: '2', definitionStatus: 'APPROVED' },
      { id: '3', definitionStatus: 'PENDING_CEO' },
      { id: '4', publishStatus: 'DRAFT' },
      { id: '5' },
    ];
    expect(filterSellableSearchFlights(rows).map((r) => r.id)).toEqual(['1', '2', '5']);
  });
});
