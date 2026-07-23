/** Matches an anonymous "last name" input against the last
 * whitespace-separated token of a passenger's stored full name — the
 * credential standard airline "manage my booking" self-service uses
 * alongside the PNR. */
export function matchesLastName(fullName: string, lastName: string): boolean {
  const parts = fullName.trim().split(/\s+/);
  const familyName = parts[parts.length - 1] ?? '';
  return familyName === lastName.trim();
}
