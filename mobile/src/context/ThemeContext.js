import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { getItem, setItem } from '../utils/storage';

export const darkPalette = {
  bg: '#0A0F1E',
  bgSecondary: '#0B132B',
  card: '#0F172A',
  cardHover: '#1E293B',
  cardBorder: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  accent: '#F97316',
  accentGold: '#FBBF24',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  inputBg: '#131D36',
  inputBorder: '#273552',
  statusBarStyle: 'light',
};

export const lightPalette = {
  bg: '#F8FAFC',
  bgSecondary: '#EDF2F7',
  card: '#FFFFFF',
  cardHover: '#F1F5F9',
  cardBorder: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  accent: '#EA580C',
  accentGold: '#D97706',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  inputBg: '#F1F5F9',
  inputBorder: '#CBD5E1',
  statusBarStyle: 'dark',
};

const ThemeContext = createContext({
  theme: darkPalette,
  isDark: true,
  themePreference: 'dark',
  setThemePreference: () => {},
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setPreference] = useState('dark');

  useEffect(() => {
    getItem('studify_theme_preference').then((stored) => {
      if (stored) {
        setPreference(stored);
      }
    });
  }, []);

  const setThemePreference = async (pref) => {
    setPreference(pref);
    await setItem('studify_theme_preference', pref);
  };

  const isDark =
    themePreference === 'system'
      ? systemColorScheme !== 'light'
      : themePreference === 'dark';

  const theme = isDark ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        themePreference,
        setThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
