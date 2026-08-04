import type { StoredLocale } from '../../../hooks/useLocale';
import { faDigits } from '../../../lib/fa-format';

export function formatFlightClock(iso: string, locale: StoredLocale): string {
  const d = new Date(iso);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const clock = `${h}:${m}`;
  return locale === 'en' ? clock : faDigits(clock);
}

export function formatHoldCountdown(secondsLeft: number, locale: StoredLocale): string {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const clock = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return locale === 'en' ? clock : faDigits(clock);
}
