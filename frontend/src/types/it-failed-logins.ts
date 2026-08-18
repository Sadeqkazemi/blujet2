/**
 * Failed-login events for the IT Manager's Security page. No backend audit
 * category for login failures exists yet (see
 * frontend/src/api/it-failed-logins-mock.ts, TEMP/DEV ONLY).
 */
export interface FailedLoginEvent {
  id: string;
  usernameMasked: string;
  ip: string | null;
  reasonFa: string;
  createdAt: string;
}
