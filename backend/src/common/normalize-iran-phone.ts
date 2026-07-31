/** Normalize Iranian mobile numbers to E.164 (+98…) for DB lookup. */
export function normalizeIranPhone(phone: string): string {
  const p = phone.trim().replace(/\s/g, '');
  if (p.startsWith('+98')) return p;
  if (p.startsWith('0098')) return `+${p.slice(2)}`;
  if (p.startsWith('09')) return `+98${p.slice(1)}`;
  return p;
}
