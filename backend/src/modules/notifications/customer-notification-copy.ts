import type { NotifyInput } from './notifications.service';

/**
 * Pure helpers for customer-facing notification copy — kept free of Nest
 * DI so unit tests can assert wording without a DB.
 */
export function ticketedNotificationInput(input: {
  recipientId: string;
  bookingId: string;
  pnr: string;
  routeLabel?: string;
}): NotifyInput {
  return {
    recipientId: input.recipientId,
    category: 'SYSTEM',
    action: 'TICKETED',
    title: 'صدور بلیط',
    body: input.routeLabel
      ? `بلیط رزرو ${input.pnr} برای مسیر ${input.routeLabel} صادر شد.`
      : `بلیط رزرو ${input.pnr} صادر شد.`,
    entityType: 'BOOKING',
    entityId: input.bookingId,
    dedupeKey: `booking:${input.bookingId}:TICKETED`,
  };
}

export function refundSubmittedNotificationInput(input: {
  recipientId: string;
  refundId: string;
  pnr: string;
}): NotifyInput {
  return {
    recipientId: input.recipientId,
    category: 'SYSTEM',
    action: 'REFUND_SUBMITTED',
    title: 'درخواست استرداد ثبت شد',
    body: `درخواست استرداد رزرو ${input.pnr} ثبت شد و در صف بررسی قرار گرفت.`,
    entityType: 'REFUND',
    entityId: input.refundId,
    dedupeKey: `refund:${input.refundId}:SUBMITTED`,
  };
}
