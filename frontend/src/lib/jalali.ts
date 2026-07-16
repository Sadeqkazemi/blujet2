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
