import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import jalaliday from 'jalaliday';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(jalaliday);

export type JalaliDayjs = typeof dayjs;

/** Configured dayjs instance — always use this, never import dayjs directly. */
export { dayjs };

export function toJalali(date: string | number | Date) {
  return dayjs(date).calendar('jalali');
}

/** Renders a UTC timestamp as Jalali date + HH:mm in the given IANA timezone. */
export function formatJalaliDateTime(date: string | number | Date, timeZone?: string) {
  const d = timeZone ? dayjs(date).tz(timeZone) : dayjs(date);
  return d.calendar('jalali').format('YYYY/MM/DD HH:mm');
}

export function formatJalaliDate(date: string | number | Date) {
  return dayjs(date).calendar('jalali').format('YYYY/MM/DD');
}

/**
 * Parses a user-typed Jalali date (`YYYY/MM/DD`, Persian or Latin digits)
 * into an ISO 8601 UTC string via the jalaliday plugin — never hand-rolled
 * conversion. Returns null when the input isn't a valid Jalali date.
 */
export function parseJalaliDateToIso(input: string): string | null {
  const latin = input
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(latin);
  if (!match) return null;

  const jalaliCapable = dayjs as unknown as (
    date: string,
    options: { jalali: boolean },
  ) => ReturnType<typeof dayjs>;
  const parsed = jalaliCapable(
    `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`,
    { jalali: true },
  );
  if (!parsed.isValid()) return null;
  return parsed.toDate().toISOString();
}
