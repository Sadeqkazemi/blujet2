import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAccessToken } from './http';
import { setAccessToken } from './token-store';

// Regression test for the auth-bootstrap race: two callers invoking
// refreshAccessToken() around the same time (e.g. useAuth's session-restore
// effect firing twice under React StrictMode, or simply two components that
// both want a fresh token) must share one in-flight /auth/refresh request.
// Firing two independent requests races the same not-yet-rotated
// refresh-token cookie and trips the backend's reuse-detection, which
// revokes the whole session and bounces the user back to the login page.
describe('refreshAccessToken', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dedupes concurrent callers into a single network request', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ success: true, data: { accessToken: 'new-token' } }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(calls).toBe(1);
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('allows a later, independent refresh after the first completes', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ success: true, data: { accessToken: 'token-' + calls } }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await refreshAccessToken();
    await refreshAccessToken();

    expect(calls).toBe(2);
  });
});
