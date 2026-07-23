import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { AuthUser } from '../types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  requestLogin: (username: string, password: string) => Promise<string>;
  confirmTwoFactor: (challengeId: string, code: string) => Promise<AuthUser>;
  agencyLogin: (phone: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  // Public purchase engine (customer phone+OTP login) — optional so every
  // existing staff/agency test's mocked AuthContextValue literal (which
  // predates the customer track) keeps type-checking without change.
  requestOtp?: (phone: string) => Promise<string>;
  verifyOtp?: (challengeId: string, code: string) => Promise<AuthUser>;
  // Phase 21 — optional customer email/phone+password login, alongside OTP.
  passwordLogin?: (phone: string, password: string) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await authApi.refreshSession();
        const me = await authApi.fetchMe();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestLogin = useCallback(async (username: string, password: string) => {
    const { challengeId } = await authApi.staffLogin(username, password);
    return challengeId;
  }, []);

  const confirmTwoFactor = useCallback(async (challengeId: string, code: string) => {
    const { user: loggedInUser } = await authApi.verifyTwoFactor(challengeId, code);
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  const agencyLogin = useCallback(async (phone: string, password: string) => {
    const { user: loggedInUser } = await authApi.agencyLogin(phone, password);
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const { challengeId } = await authApi.requestOtp(phone);
    return challengeId;
  }, []);

  const verifyOtp = useCallback(async (challengeId: string, code: string) => {
    const { user: loggedInUser } = await authApi.verifyOtp(challengeId, code);
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  const passwordLogin = useCallback(async (phone: string, password: string) => {
    const { user: loggedInUser } = await authApi.customerPasswordLogin(phone, password);
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  const signOut = useCallback(async () => {
    // Best-effort server-side revoke — a failed/rate-limited call must never
    // trap the user in a session they clicked "sign out" on.
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      requestLogin,
      confirmTwoFactor,
      agencyLogin,
      signOut,
      requestOtp,
      verifyOtp,
      passwordLogin,
    }),
    [
      status,
      user,
      requestLogin,
      confirmTwoFactor,
      agencyLogin,
      signOut,
      requestOtp,
      verifyOtp,
      passwordLogin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
