import { ConflictException, NotFoundException } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import {
  FlightDefinitionStatus,
  type FlightDefinitionStatus as FlightDefinitionStatusT,
} from '../../database/enums';
import type { FlightInstance } from '../../database/entities/flight-instance.entity';
import { ErrorCode } from '../../common/errors';

/** Customer-facing sellable definition states (live approved inventory). */
export const SELLABLE_DEFINITION_STATUSES: FlightDefinitionStatusT[] = [
  FlightDefinitionStatus.APPROVED,
  FlightDefinitionStatus.PENDING_REVISION,
];

export function isSellableDefinitionStatus(
  status: FlightDefinitionStatusT | null | undefined,
  hasApprovedSnapshot = false,
): boolean {
  return (
    status === FlightDefinitionStatus.APPROVED ||
    (status === FlightDefinitionStatus.PENDING_REVISION && hasApprovedSnapshot)
  );
}

/** Restrict a FlightInstance query to sellable definition statuses. */
export function applySellableDefinitionFilter<T extends FlightInstance>(
  qb: SelectQueryBuilder<T>,
  alias = 'fi',
): SelectQueryBuilder<T> {
  return qb.andWhere(
    `(${alias}.definitionStatus = :approvedDefinition OR (` +
      `${alias}.definitionStatus = :pendingRevisionDefinition AND ` +
      `${alias}.approvedSnapshot IS NOT NULL))`,
    {
      approvedDefinition: FlightDefinitionStatus.APPROVED,
      pendingRevisionDefinition: FlightDefinitionStatus.PENDING_REVISION,
    },
  );
}

/**
 * Throws NotFound (same message as missing flight) when the instance is not
 * customer-sellable — avoids leaking draft/pending/rejected inventory.
 */
export function assertSellableForSale(
  instance: Pick<
    FlightInstance,
    'definitionStatus' | 'status' | 'approvedSnapshot'
  > | null,
): asserts instance is NonNullable<typeof instance> {
  if (!instance || instance.status !== 'SCHEDULED') {
    throw new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
    });
  }
  if (
    !isSellableDefinitionStatus(
      instance.definitionStatus,
      instance.approvedSnapshot != null,
    )
  ) {
    throw new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
    });
  }
}

export function assertSellableOrConflict(
  instance: Pick<FlightInstance, 'definitionStatus' | 'approvedSnapshot'>,
): void {
  if (
    !isSellableDefinitionStatus(
      instance.definitionStatus,
      instance.approvedSnapshot != null,
    )
  ) {
    throw new ConflictException({
      code: ErrorCode.CONFLICT,
      message: 'این پرواز هنوز برای فروش تأیید نشده است.',
    });
  }
}
