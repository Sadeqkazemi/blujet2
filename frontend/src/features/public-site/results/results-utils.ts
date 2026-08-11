import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { StoredLocale } from '../../../hooks/useLocale';
import { formatToman } from '../../../lib/fa-format';
import { localeDigits } from '../../../lib/locale-format';
import type { CabinClass, SearchCabinOption, SearchFlightResult } from '../../../types/public-site';

dayjs.extend(utc);
dayjs.extend(timezone);

const TAX_TOMAN = 320_000;

export function flightAirlineLabel(flightNo: string): string {
  const prefix = flightNo.split('-')[0] ?? flightNo;
  if (prefix === 'BJ' || prefix === 'EP') return 'blujet';
  return prefix;
}

export function depHourBucket(iso: string): 'morning' | 'noon' | 'evening' {
  const h = new Date(iso).getUTCHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'noon';
  return 'evening';
}

export function formatFlightClock(iso: string, locale: StoredLocale, timeZone?: string): string {
  const d = timeZone ? dayjs(iso).tz(timeZone) : dayjs(iso);
  const raw = d.format('HH:mm');
  return localeDigits(raw, locale);
}

export function flightDurationMinutes(departureAt: string, arrivalAt: string): number {
  return Math.max(0, Math.round((new Date(arrivalAt).getTime() - new Date(departureAt).getTime()) / 60_000));
}

export function formatDuration(minutes: number, locale: StoredLocale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'en') return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (locale === 'ar') return m > 0 ? `${formatToman(h, 'ar')} س ${formatToman(m, 'ar')} د` : `${formatToman(h, 'ar')} س`;
  return m > 0 ? `${formatToman(h, 'fa')} ساعت ${formatToman(m, 'fa')} دقیقه` : `${formatToman(h, 'fa')} ساعت`;
}

export function stopLabel(hasConnection: boolean, locale: StoredLocale): string {
  if (hasConnection) {
    return locale === 'en' ? '1 stop' : locale === 'ar' ? 'توقف واحد' : '۱ توقف';
  }
  return locale === 'en' ? 'Nonstop' : locale === 'ar' ? 'مباشر' : 'بدون توقف';
}

export function primaryCabin(flight: SearchFlightResult): SearchCabinOption | undefined {
  return flight.cabins.find((c) => c.cabin === 'ECONOMY') ?? flight.cabins[0];
}

export function priceBreakdown(priceIrr: bigint): { baseIrr: bigint; taxIrr: bigint } {
  const taxIrr = BigInt(TAX_TOMAN * 10);
  if (priceIrr <= taxIrr) return { baseIrr: priceIrr, taxIrr: 0n };
  return { baseIrr: priceIrr - taxIrr, taxIrr };
}

export function sortFlights(
  list: SearchFlightResult[],
  sort: 'cheap' | 'fast' | 'early',
): SearchFlightResult[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sort === 'early') return a.departureAt.localeCompare(b.departureAt);
    if (sort === 'fast') {
      return flightDurationMinutes(a.departureAt, a.arrivalAt) - flightDurationMinutes(b.departureAt, b.arrivalAt);
    }
    const pa = BigInt(primaryCabin(a)?.priceIrr ?? '0');
    const pb = BigInt(primaryCabin(b)?.priceIrr ?? '0');
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });
  return copy;
}

export function cabinKey(flightInstanceId: string, cabin: CabinClass): string {
  return `${flightInstanceId}:${cabin}`;
}
