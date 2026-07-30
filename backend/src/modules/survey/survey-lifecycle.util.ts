import type { TypeORMService } from '../../typeorm/typeorm.service';
import type { SmsService } from '../sms/sms.service';
import { materializeFlownBookings } from '../flights/flight-lifecycle.util';

function surveyInviteLink(token: string): string {
  return `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/survey/${token}`;
}

async function sendInviteSms(
  typeorm: TypeORMService,
  sms: SmsService,
  inviteId: string,
  contactPhone: string | null,
  token: string,
): Promise<void> {
  const result = await sms.send(
    contactPhone,
    `سفر خوبی داشتید؟ لطفاً نظر خود را با ما در میان بگذارید: ${surveyInviteLink(token)}`,
    'SURVEY_INVITE',
  );
  if (result.success) {
    await typeorm.surveyInvite.update({
      where: { id: inviteId },
      data: { smsSentAt: new Date() },
    });
  }
}

/**
 * Lazily creates a SurveyInvite for every booking that has reached FLOWN
 * but has none yet, and retries the SMS for any existing invite whose
 * first send attempt failed (`smsSentAt` still null) — no cron job, same
 * "materialize on read" principle as
 * materializeDepartedInstances/materializeFlownBookings. Called from
 * SurveyService's own read endpoints (config stats + exec results),
 * which are the natural, frequently-polled places this data is consumed
 * — rather than reaching into the three unrelated existing services that
 * already call materializeFlownBookings for their own purposes. See
 * docs/DB_SCHEMA.md's Phase 66 section.
 */
export async function materializeSurveyInvites(
  typeorm: TypeORMService,
  sms: SmsService,
): Promise<void> {
  await materializeFlownBookings(typeorm);

  const settings = await typeorm.surveySettings.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!settings || !settings.enabled) return;

  const pending = await typeorm.booking.findMany({
    where: { status: 'FLOWN', surveyInvite: null },
    select: { id: true, flightInstanceId: true, contactPhone: true },
  });

  for (const booking of pending) {
    // One booking at a time, each in its own try/catch — a single SMS or
    // DB hiccup must never block the rest (same best-effort posture as
    // every other lazy-materialization step in this codebase).
    try {
      const invite = await typeorm.surveyInvite.create({
        data: {
          bookingId: booking.id,
          flightInstanceId: booking.flightInstanceId,
        },
      });
      await sendInviteSms(
        typeorm,
        sms,
        invite.id,
        booking.contactPhone,
        invite.token,
      );
    } catch {
      // best-effort — the next materialize() call (next read) retries any
      // booking that still has no SurveyInvite row.
    }
  }

  // Invites whose row exists but whose first SMS attempt failed (or was
  // never confirmed) — the `pending` query above can never find these
  // again since the booking now has a SurveyInvite, so without this pass
  // a transient SMS failure would silently strand the passenger forever.
  // Scoped to bookings that actually have a phone — a booking with none
  // is permanently undeliverable (see `sendInviteSms`/`SmsService.send`),
  // so retrying it every materialize() call would just pile up FAILED
  // SmsLog rows for a case that can never succeed.
  const unsent = await typeorm.surveyInvite.findMany({
    where: { smsSentAt: null, booking: { contactPhone: { not: null } } },
    select: {
      id: true,
      token: true,
      booking: { select: { contactPhone: true } },
    },
  });
  for (const invite of unsent) {
    try {
      await sendInviteSms(
        typeorm,
        sms,
        invite.id,
        invite.booking.contactPhone,
        invite.token,
      );
    } catch {
      // best-effort — retried again on the next materialize() call.
    }
  }
}
