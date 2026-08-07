import { NotFoundException } from '@nestjs/common';
import { FlightDefinitionStatus } from '../../database/enums';
import {
  assertSellableForSale,
  isSellableDefinitionStatus,
} from './definition-sellability';

describe('definition-sellability', () => {
  it('treats APPROVED and PENDING_REVISION as sellable', () => {
    expect(isSellableDefinitionStatus(FlightDefinitionStatus.APPROVED)).toBe(
      true,
    );
    expect(
      isSellableDefinitionStatus(FlightDefinitionStatus.PENDING_REVISION),
    ).toBe(true);
    expect(isSellableDefinitionStatus(FlightDefinitionStatus.DRAFT)).toBe(
      false,
    );
  });

  it('assertSellableForSale rejects draft definitions', () => {
    expect(() =>
      assertSellableForSale({
        status: 'SCHEDULED',
        definitionStatus: FlightDefinitionStatus.DRAFT,
      }),
    ).toThrow(NotFoundException);
  });

  it('assertSellableForSale accepts approved scheduled instances', () => {
    expect(() =>
      assertSellableForSale({
        status: 'SCHEDULED',
        definitionStatus: FlightDefinitionStatus.APPROVED,
      }),
    ).not.toThrow();
  });
});
