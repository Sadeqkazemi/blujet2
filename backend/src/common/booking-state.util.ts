import { ConflictException } from '@nestjs/common';
import { ErrorCode } from './errors';
import type { BookingStatus } from '../../generated/typeorm/enums';

/** Legal booking state transitions (CLAUDE.md booking FSM). */
const LEGAL_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  DRAFT: ['HELD', 'CANCELLED'],
  HELD: ['PAID', 'EXPIRED', 'CANCELLED'],
  PAID: ['TICKETED', 'REFUNDED'],
  TICKETED: ['REFUNDED', 'FLOWN', 'NO_SHOW'],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
  FLOWN: [],
  NO_SHOW: [],
};

type BookingUpdateMany = {
  updateMany(args: {
    where: { id: string; status: BookingStatus };
    data: { status: BookingStatus; [key: string]: unknown };
  }): Promise<{ count: number }>;
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Guarded status flip — returns false when a concurrent writer won the race. */
export async function transitionBookingStatus(
  tx: BookingUpdateMany,
  id: string,
  from: BookingStatus,
  to: BookingStatus,
  extraData: Record<string, unknown> = {},
): Promise<boolean> {
  if (!canTransition(from, to)) {
    throw new ConflictException({
      code: ErrorCode.CONFLICT,
      message: `انتقال وضعیت ${from} → ${to} مجاز نیست.`,
    });
  }
  const result = await tx.updateMany({
    where: { id, status: from },
    data: { status: to, ...extraData },
  });
  return result.count > 0;
}

/** Customer/agency payment capture: HELD → PAID → TICKETED atomically. */
export async function captureAndTicket(
  tx: { booking: BookingUpdateMany },
  id: string,
  extraOnPaid: Record<string, unknown> = {},
): Promise<void> {
  const captured = await transitionBookingStatus(
    tx.booking,
    id,
    'HELD',
    'PAID',
    extraOnPaid,
  );
  if (!captured) {
    throw new ConflictException({
      code: ErrorCode.CONFLICT,
      message: 'این رزرو قبلاً پرداخت شده است.',
    });
  }
  const issued = await transitionBookingStatus(tx.booking, id, 'PAID', 'TICKETED');
  if (!issued) {
    throw new ConflictException({
      code: ErrorCode.CONFLICT,
      message: 'صدور بلیط ناموفق بود.',
    });
  }
}
