import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'studify_theme';
const OVERRIDE_TS_KEY = 'studify_theme_updated_at';

const resolveSystemTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const ThemeProvider = ({ children }) => {
  const { user, setUser } = useAuth();
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return ['light', 'dark', 'system'].includes(stored) ? stored : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState(() =>
    theme === 'system' ? resolveSystemTheme() : theme
  );

  // Apply data-theme attribute immediately
  useEffect(() => {
    const nextResolved = theme === 'system' ? resolveSystemTheme() : theme;
    setResolvedTheme(nextResolved);
    document.documentElement.setAttribute('data-theme', nextResolved);
    document.documentElement.style.colorScheme = nextResolved;
  }, [theme]);

  // Listen to OS color scheme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      const next = e.matches ? 'light' : 'dark';
      setResolvedTheme(next);
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Reconcile server preference when user logs in / loads (local override wins if newer than user.updatedAt)
  useEffect(() => {
    if (!user?.themePreference) return;
    if (!['light', 'dark', 'system'].includes(user.themePreference)) return;
    try {
      const localStored = localStorage.getItem(STORAGE_KEY);
      const localTs = Number(localStorage.getItem(OVERRIDE_TS_KEY) || 0);
      const serverTs = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
      if (!localStored || serverTs > localTs) {
        localStorage.setItem(STORAGE_KEY, user.themePreference);
        setThemeState(user.themePreference);
      }
    } catch {
      setThemeState(user.themePreference);
    }
  }, [user?.id, user?.themePreference, user?.updatedAt]);

  const setTheme = useCallback(
    async (nextTheme) => {
      if (!['light', 'dark', 'system'].includes(nextTheme)) return;
      setThemeState(nextTheme);
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
        localStorage.setItem(OVERRIDE_TS_KEY, String(Date.now()));
      } catch {
        // Ignore storage errors
      }

      if (user?.id) {
        try {
          const res = await api.put('/users/profile', { themePreference: nextTheme });
          const updatedUser = res.data?.data?.user;
          if (updatedUser && setUser) {
            setUser((prev) => {
              const merged = { ...(prev || {}), ...updatedUser, themePreference: nextTheme };
              try {
                localStorage.setItem('studify_user', JSON.stringify(merged));
              } catch {
                // Ignore
              }
              return merged;
            });
          }
        } catch {
          // Keep local theme active even if network sync fails
        }
      }
    },
    [user?.id, setUser]
  );

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
