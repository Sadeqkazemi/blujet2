import type { ApiEnvelope } from './envelope';
import { ApiRequestError } from './envelope';
import { getAccessToken, setAccessToken } from './token-store';

const BASE_URL = import.meta.env.VITE_API_URL;

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
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

  return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
}

/** All frontend HTTP calls go through here — components never call fetch directly. */
export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await doFetch(path, init);

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest<T>(path, init, false);
  }

  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body.success || !body.data) {
    throw new ApiRequestError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'خطای ناشناخته', res.status);
  }
  return body.data;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
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
