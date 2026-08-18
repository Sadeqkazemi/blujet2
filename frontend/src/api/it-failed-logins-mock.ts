/**
 * ⚠️ TEMP / DEV ONLY — no backend audit category for failed logins exists
 * yet. Standing in for a future `GET /it/security/failed-logins` (see
 * docs/features/it-api-access-management.md). Usernames are pre-masked
 * here exactly like they must be server-side — never log/display a full
 * username or any password material for a failed attempt.
 */
import type { FailedLoginEvent } from '../types/it-failed-logins';

function isoMinutesAgo(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

export async function fetchFailedLoginEvents(): Promise<FailedLoginEvent[]> {
  return [
    { id: 'fl_1', usernameMasked: 're**.ka*emi', ip: '185.143.xx.44', reasonFa: 'رمز عبور نادرست', createdAt: isoMinutesAgo(20) },
    { id: 'fl_2', usernameMasked: 'ad**n', ip: '5.253.xx.12', reasonFa: 'نام کاربری یافت نشد', createdAt: isoMinutesAgo(95) },
    { id: 'fl_3', usernameMasked: 'sa**.ah*adi', ip: '46.100.xx.7', reasonFa: 'کد دومرحله‌ای نامعتبر', createdAt: isoMinutesAgo(240) },
  ];
}
