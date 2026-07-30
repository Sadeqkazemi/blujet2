import type { PrismaService } from '../../prisma/prisma.service';
import type { SmsService } from '../sms/sms.service';
import { materializeFlownBookings } from '../flights/flight-lifecycle.util';

/**
 * Lazily creates a SurveyInvite (+ sends the SMS) for every booking that
 * has reached FLOWN but has none yet — no cron job, same "materialize on
 * read" principle as materializeDepartedInstances/materializeFlownBookings.
 * Called from SurveyService's own read endpoints (config stats + exec
 * results), which are the natural, frequently-polled places this data is
 * consumed — rather than reaching into the three unrelated existing
 * services that already call materializeFlownBookings for their own
 * purposes. See docs/DB_SCHEMA.md's Phase 66 section.
 */
export async function materializeSurveyInvites(
  prisma: PrismaService,
  sms: SmsService,
): Promise<void> {
  await materializeFlownBookings(prisma);

  const settings = await prisma.surveySettings.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!settings || !settings.enabled) return;

  const pending = await prisma.booking.findMany({
    where: { status: 'FLOWN', surveyInvite: null },
    select: { id: true, flightInstanceId: true, contactPhone: true },
  });

  for (const booking of pending) {
    // One booking at a time, each in its own try/catch — a single SMS or
    // DB hiccup must never block the rest (same best-effort posture as
    // every other lazy-materialization step in this codebase).
    try {
      const invite = await prisma.surveyInvite.create({
        data: {
          bookingId: booking.id,
          flightInstanceId: booking.flightInstanceId,
        },
      });
      const link = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/survey/${invite.token}`;
      const result = await sms.send(
        booking.contactPhone,
        `سفر خوبی داشتید؟ لطفاً نظر خود را با ما در میان بگذارید: ${link}`,
        'SURVEY_INVITE',
      );
      if (result.success) {
        await prisma.surveyInvite.update({
          where: { id: invite.id },
          data: { smsSentAt: new Date() },
        });
      }
    } catch {
      // best-effort — the next materialize() call (next read) retries any
      // booking that still has no SurveyInvite row.
    }
  }
}
