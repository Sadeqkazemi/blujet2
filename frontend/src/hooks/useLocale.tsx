import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { updateMyLocale } from '../api/auth';
import { useAuth } from './useAuth';
import type { Locale } from '../types/auth';

const STORAGE_KEY = 'blujet_lang';

export type StoredLocale = 'fa' | 'en' | 'ar';

function readStored(): StoredLocale {
  if (typeof localStorage === 'undefined') return 'fa';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'en' || v === 'ar' ? v : 'fa';
}

function toBackend(l: StoredLocale): Locale {
  return l.toUpperCase() as Locale;
}

function toStored(l: Locale): StoredLocale {
  return l.toLowerCase() as StoredLocale;
}

interface LocaleContextValue {
  locale: StoredLocale;
  setLocale: (next: StoredLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** An anonymous visitor's choice lives only in localStorage — there's no
 * User row to attach it to yet. `preferredLocale` in the DB is purely the
 * cross-device sync point for a logged-in USER/AGENCY. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<StoredLocale>(() => readStored());
  const { status, user } = useAuth();

  // The moment we know who's logged in is the moment "this device now
  // represents this account" — DB naturally wins over whatever an
  // anonymous session had going before login.
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const dbLocale = toStored(user.preferredLocale);
    if (dbLocale !== readStored()) {
      localStorage.setItem(STORAGE_KEY, dbLocale);
      setLocaleState(dbLocale);
    }
  }, [status, user]);

  const setLocale = useCallback(
    (next: StoredLocale) => {
      localStorage.setItem(STORAGE_KEY, next);
      setLocaleState(next);
      if (status === 'authenticated') {
        // Fire-and-forget: the UI already reflects the choice; a failed
        // sync isn't user-visible and simply retries on the next change.
        void updateMyLocale(toBackend(next)).catch(() => {});
      }
    },
    [status],
  );

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
