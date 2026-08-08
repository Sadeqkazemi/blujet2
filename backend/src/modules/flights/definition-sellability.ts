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

/** Canonical publish-state names for the API contract (frontend PR #126
 * expects "PUBLISHED" as the customer-visible/sellable state). The DB's
 * `FlightDefinitionStatus` column keeps its existing values (APPROVED /
 * PENDING_REVISION / etc.) unchanged — renaming that enum would ripple
 * through the whole CEO-approval workflow built and tested in an earlier
 * phase, for no behavioral gain. This is a pure display/contract mapping,
 * always derived from `definitionStatus` (+ approvedSnapshot presence),
 * never stored independently — there is exactly one source of truth. */
export type PublishStatus =
  'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED';

export function toPublishStatus(
  status: FlightDefinitionStatusT | null | undefined,
  hasApprovedSnapshot = false,
): PublishStatus {
  if (isSellableDefinitionStatus(status, hasApprovedSnapshot)) {
    return 'PUBLISHED';
  }
  switch (status) {
    case FlightDefinitionStatus.REJECTED:
      return 'REJECTED';
    case FlightDefinitionStatus.PENDING_CEO:
    case FlightDefinitionStatus.PENDING_REVISION:
      return 'PENDING_APPROVAL';
    case FlightDefinitionStatus.DRAFT:
    default:
      return 'DRAFT';
  }
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
