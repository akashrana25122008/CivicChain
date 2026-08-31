'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ThemeValue = 'LIGHT' | 'DARK' | 'SYSTEM';

const SYSTEM_LIGHT_QUERY = '(prefers-color-scheme: light)';

const THEME_COOKIE = 'cc-theme';

/** Resolve a preference (+ optional reporter) into the concrete .light/.dark. */
function applyThemeClass(preference: ThemeValue): 'light' | 'dark' {
  const resolved =
    preference === 'SYSTEM'
      ? window.matchMedia(SYSTEM_LIGHT_QUERY).matches
        ? 'light'
        : 'dark'
      : preference === 'DARK'
        ? 'dark'
        : 'light';

  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  return resolved;
}

function setThemeCookie(preference: ThemeValue) {
  // Persist the user's chosen preference (not the resolved concrete value) so
  // SYSTEM keeps following the OS on the next full page load too.
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`;
}

export interface ThemeContextValue {
  theme: ThemeValue;
  setTheme: (preference: ThemeValue) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface PreferencesResponse {
  preferences?: { theme?: ThemeValue };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with SYSTEM; the inline head script already applied a concrete class
  // from the cookie before first paint, so we never flash the wrong theme.
  const [theme, setThemeState] = useState<ThemeValue>('SYSTEM');

  // 1) Hydrate the persisted preference from the API once (authenticated).
  useEffect(() => {
    let cancelled = false;
    fetcher('/api/me/preferences')
      .then((data: PreferencesResponse) => {
        const pref = data?.preferences?.theme;
        if (!cancelled && pref) {
          setThemeState(pref);
          setThemeCookie(pref);
        }
      })
      .catch(() => {
        /* not authenticated / network — keep the cookie value */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Apply the class whenever theme changes; watch the OS when SYSTEM.
  useEffect(() => {
    applyThemeClass(theme);

    if (theme !== 'SYSTEM') return;

    const media = window.matchMedia(SYSTEM_LIGHT_QUERY);
    const onChange = () => applyThemeClass('SYSTEM');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((preference: ThemeValue) => {
    setThemeState(preference);
    setThemeCookie(preference);
    applyThemeClass(preference);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
