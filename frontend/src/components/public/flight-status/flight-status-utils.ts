import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';
import { dayjs } from '../../../lib/jalali';
import type { FlightStatusResult } from '../../../types/flight-status';

export function flightDurationLabel(departureAt: string, arrivalAt: string, locale: StoredLocale): string {
  const dep = new Date(departureAt).getTime();
  const arr = new Date(arrivalAt).getTime();
  const mins = Math.max(0, Math.round((arr - dep) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (locale === 'en') {
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }
  if (locale === 'ar') {
    if (h && m) return `${faDigits(h)} ساعة و ${faDigits(m)} دقيقة`;
    if (h) return `${faDigits(h)} ساعة`;
    return `${faDigits(m)} دقيقة`;
  }
  if (h && m) return `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه`;
  if (h) return `${faDigits(h)} ساعت`;
  return `${faDigits(m)} دقیقه`;
}

export function formatFlightClock(iso: string, locale: StoredLocale): string {
  const raw = dayjs(iso).calendar('jalali').format('HH:mm');
  if (locale === 'en') return raw;
  return faDigits(raw);
}

/** Progress along route timeline (0–100) for the visual plane indicator. */
export function flightProgressPct(result: FlightStatusResult, now = Date.now()): number {
  if (result.status === 'CANCELLED') return 0;
  if (result.statusLabelFa === 'فرود آمد') return 100;
  const dep = new Date(result.departureAt).getTime();
  const arr = new Date(result.arrivalAt).getTime();
  if (now < dep) return 0;
  if (now >= arr) return 100;
  if (result.status === 'SCHEDULED') return 0;
  return Math.min(100, Math.max(0, Math.round(((now - dep) / (arr - dep)) * 100)));
}

export const STATUS_PILL: Record<
  FlightStatusResult['status'],
  { color: string; bg: string }
> = {
  SCHEDULED: { color: '#1f8a5b', bg: 'rgba(16,185,129,.18)' },
  DEPARTED: { color: '#1668c4', bg: 'rgba(22,104,196,.15)' },
  CANCELLED: { color: '#d64545', bg: 'rgba(214,69,69,.12)' },
};
