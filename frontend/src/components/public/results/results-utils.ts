import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';

export function flightAirlineLabel(flightNo: string): string {
  return flightNo.split('-')[0] ?? flightNo;
}

export function formatFlightClock(iso: string, locale: StoredLocale): string {
  const d = new Date(iso);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const clock = `${h}:${m}`;
  return locale === 'en' ? clock : faDigits(clock);
}

export function formatFlightDuration(departureAt: string, arrivalAt: string, locale: StoredLocale): string {
  const ms = new Date(arrivalAt).getTime() - new Date(departureAt).getTime();
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (locale === 'en') {
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }
  if (hours === 0) return `${faDigits(mins)} دقیقه`;
  if (mins === 0) return `${faDigits(hours)} ساعت`;
  return `${faDigits(hours)} ساعت ${faDigits(mins)} دقیقه`;
}

export function flightDurationMs(departureAt: string, arrivalAt: string): number {
  return Math.max(0, new Date(arrivalAt).getTime() - new Date(departureAt).getTime());
}

export function depHourBucket(iso: string): 'morning' | 'noon' | 'evening' {
  const h = new Date(iso).getUTCHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'noon';
  return 'evening';
}
