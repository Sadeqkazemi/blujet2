import type { ApiEnvelope } from './envelope';
import { ApiRequestError } from './envelope';
import { getAccessToken, setAccessToken } from './token-store';
import {
  ACCESS_REVOKED_MESSAGE,
  emitAccessRevoked,
  isAccessRevokedError,
} from '../lib/access-revoked';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const REQUEST_TIMEOUT_MS = 15_000;

let refreshInFlight: Promise<boolean> | null = null;

async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError(
        'TIMEOUT',
        'سرور پاسخ نداد. لطفاً چند لحظه بعد دوباره تلاش کنید.',
        408,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Exported so the auth bootstrap effect (useAuth.tsx) can share this same
// in-flight request instead of firing its own — two concurrent /auth/refresh
// calls both racing to consume the same not-yet-rotated refresh-token cookie
// trip the server's reuse-detection and revoke the whole session.
export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetchWithTimeout('/auth/refresh', { method: 'POST', credentials: 'include' });
        const body = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
        if (body.success && body.data) {
          setAccessToken(body.data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function doFetch(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // FormData sets its own multipart boundary — never override it.
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetchWithTimeout(path, { ...init, headers, credentials: 'include' });
}

function throwApiError(status: number, code: string, message: string): never {
  const err = new ApiRequestError(code, message, status);
  const hadSession = Boolean(getAccessToken());
  // Only revoke the whole session for explicit disable / failed refresh /
  // access-revoked codes — not every ordinary 403 on a single resource.
  if (
    hadSession &&
    (code === 'ACCESS_REVOKED' ||
      isAccessRevokedError({ status, code, message }) ||
      message.includes('غیرفعال شده') ||
      message.includes('موقتاً غیرفعال'))
  ) {
    emitAccessRevoked({
      message: ACCESS_REVOKED_MESSAGE,
      status,
      code,
      source: 'http',
    });
  }
  throw err;
}

/** All frontend HTTP calls go through here — components never call fetch directly. */
export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await doFetch(path, init);

  if (res.status === 401 && retry && getAccessToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest<T>(path, init, false);
    setAccessToken(null);
    throwApiError(401, 'ACCESS_REVOKED', ACCESS_REVOKED_MESSAGE);
  }

  const raw = await res.text();
  let body: ApiEnvelope<T>;
  try {
    body = JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    throwApiError(
      res.status,
      'BAD_GATEWAY',
      res.status === 502
        ? 'سرور در دسترس نیست. لطفاً چند لحظه بعد دوباره تلاش کنید.'
        : 'خطا در ارتباط با سرور',
    );
  }
  if (!body.success || body.data == null) {
    const rawMessage = body.error?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(' ')
      : (rawMessage ?? 'خطای ناشناخته');
    throwApiError(res.status, body.error?.code ?? 'UNKNOWN', message);
  }
  return body.data;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

/** For endpoints that return a raw file body (not the {success,data} JSON
 * envelope) on success — errors still come back as the JSON envelope. */
export async function apiGetBlob(path: string, retry = true): Promise<Blob> {
  const res = await doFetch(path, { method: 'GET' });

  if (res.status === 401 && retry && getAccessToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiGetBlob(path, false);
    setAccessToken(null);
    throwApiError(401, 'ACCESS_REVOKED', ACCESS_REVOKED_MESSAGE);
  }

  if (!res.ok) {
    const body = (await res.json()) as ApiEnvelope<never>;
    throwApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'خطای ناشناخته',
    );
  }
  return res.blob();
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' });
}

/** Multipart uploads — omits the JSON Content-Type header so the browser
 * sets its own multipart boundary. */
export function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: form });
}
