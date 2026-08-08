/** Shared access-revoked signal for staff / agency / customer sessions. */

export const ACCESS_REVOKED_MESSAGE = 'دسترسی شما به این پنل غیرفعال شده است.';
export const ACCESS_REVOKED_EVENT = 'blujet:access-revoked';

export type AccessRevokedDetail = {
  message: string;
  status?: number;
  code?: string;
  source?: 'http' | 'event' | 'manual';
};

const ACCESS_REVOKED_CODES = new Set([
  'ACCESS_REVOKED',
  'PANEL_DISABLED',
  'TEMPORARY_ACCESS_EXPIRED',
]);

export function isAccessRevokedError(err: {
  status?: number;
  code?: string;
  message?: string;
}): boolean {
  if (err.code && ACCESS_REVOKED_CODES.has(err.code)) return true;
  if (err.message?.includes('غیرفعال شده')) return true;
  if (err.message?.includes('موقتاً غیرفعال')) return true;
  return false;
}

export function emitAccessRevoked(detail: AccessRevokedDetail = { message: ACCESS_REVOKED_MESSAGE }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AccessRevokedDetail>(ACCESS_REVOKED_EVENT, {
      detail: { ...detail, message: ACCESS_REVOKED_MESSAGE },
    }),
  );
}

export function onAccessRevoked(handler: (detail: AccessRevokedDetail) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (e: Event) => {
    const ce = e as CustomEvent<AccessRevokedDetail>;
    handler(ce.detail ?? { message: ACCESS_REVOKED_MESSAGE });
  };
  window.addEventListener(ACCESS_REVOKED_EVENT, listener);
  return () => window.removeEventListener(ACCESS_REVOKED_EVENT, listener);
}
