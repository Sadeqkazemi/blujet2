import { NotFoundException } from '@nestjs/common';
import { FlightDefinitionStatus } from '../../database/enums';
import {
  assertSellableForSale,
  isSellableDefinitionStatus,
} from './definition-sellability';

describe('definition-sellability', () => {
  it('requires an approved snapshot for PENDING_REVISION', () => {
    expect(isSellableDefinitionStatus(FlightDefinitionStatus.APPROVED)).toBe(
      true,
    );
    expect(
      isSellableDefinitionStatus(FlightDefinitionStatus.PENDING_REVISION),
    ).toBe(false);
    expect(
      isSellableDefinitionStatus(FlightDefinitionStatus.PENDING_REVISION, true),
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
        approvedSnapshot: null,
      }),
    ).toThrow(NotFoundException);
  });

  it('assertSellableForSale accepts approved scheduled instances', () => {
    expect(() =>
      assertSellableForSale({
        status: 'SCHEDULED',
        definitionStatus: FlightDefinitionStatus.APPROVED,
        approvedSnapshot: null,
      }),
    ).not.toThrow();
  });

  it('rejects a pending revision without a live approved snapshot', () => {
    expect(() =>
      assertSellableForSale({
        status: 'SCHEDULED',
        definitionStatus: FlightDefinitionStatus.PENDING_REVISION,
        approvedSnapshot: null,
      }),
    ).toThrow(NotFoundException);
  });
});
