import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, useLocale } from './useLocale';
import * as authApi from '../api/auth';
import * as useAuthModule from './useAuth';

function mockAuth(overrides: Partial<ReturnType<typeof useAuthModule.useAuth>>) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
}

describe('useLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to fa when localStorage has nothing set', () => {
    mockAuth({});
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider });
    expect(result.current.locale).toBe('fa');
  });

  it('reads an existing localStorage value on mount', () => {
    localStorage.setItem('blujet_lang', 'en');
    mockAuth({});
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider });
    expect(result.current.locale).toBe('en');
  });

  it('setLocale writes localStorage and updates state; no API call when anonymous', async () => {
    mockAuth({});
    const update = vi.spyOn(authApi, 'updateMyLocale');
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider });

    act(() => result.current.setLocale('en'));

    expect(result.current.locale).toBe('en');
    expect(localStorage.getItem('blujet_lang')).toBe('en');
    expect(update).not.toHaveBeenCalled();
  });

  it('setLocale syncs to the backend when authenticated', async () => {
    mockAuth({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'کاربر تست', role: 'USER', preferredLocale: 'FA' },
    });
    const update = vi.spyOn(authApi, 'updateMyLocale').mockResolvedValue({ preferredLocale: 'AR' });
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider });

    act(() => result.current.setLocale('ar'));

    await waitFor(() => expect(update).toHaveBeenCalledWith('AR'));
    expect(localStorage.getItem('blujet_lang')).toBe('ar');
  });

  it('adopts the DB preferredLocale on login when it differs from the current localStorage value', async () => {
    localStorage.setItem('blujet_lang', 'fa');
    mockAuth({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'کاربر تست', role: 'USER', preferredLocale: 'EN' },
    });
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider });

    await waitFor(() => expect(result.current.locale).toBe('en'));
    expect(localStorage.getItem('blujet_lang')).toBe('en');
  });

  it('falls back to fa with a no-op setter when used outside a LocaleProvider', () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe('fa');
    expect(() => result.current.setLocale('en')).not.toThrow();
  });
});
