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
): boolean {
  return (
    status === FlightDefinitionStatus.APPROVED ||
    status === FlightDefinitionStatus.PENDING_REVISION
  );
}

/** Restrict a FlightInstance query to sellable definition statuses. */
export function applySellableDefinitionFilter<T extends FlightInstance>(
  qb: SelectQueryBuilder<T>,
  alias = 'fi',
): SelectQueryBuilder<T> {
  return qb.andWhere(`${alias}.definitionStatus IN (:...sellableDefs)`, {
    sellableDefs: SELLABLE_DEFINITION_STATUSES,
  });
}

/**
 * Throws NotFound (same message as missing flight) when the instance is not
 * customer-sellable — avoids leaking draft/pending/rejected inventory.
 */
export function assertSellableForSale(
  instance: Pick<FlightInstance, 'definitionStatus' | 'status'> | null,
): asserts instance is NonNullable<typeof instance> {
  if (!instance || instance.status !== 'SCHEDULED') {
    throw new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
    });
  }
  if (!isSellableDefinitionStatus(instance.definitionStatus)) {
    throw new NotFoundException({
      code: ErrorCode.NOT_FOUND,
      message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
    });
  }
}

export function assertSellableOrConflict(
  instance: Pick<FlightInstance, 'definitionStatus'>,
): void {
  if (!isSellableDefinitionStatus(instance.definitionStatus)) {
    throw new ConflictException({
      code: ErrorCode.CONFLICT,
      message: 'این پرواز هنوز برای فروش تأیید نشده است.',
    });
  }
}
