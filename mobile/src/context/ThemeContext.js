import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { getItem, setItem } from '../utils/storage';

export const darkPalette = {
  bg: '#0B0D13',
  bgSecondary: '#12151F',
  card: '#161A26',
  cardHover: '#1E2333',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  accent: '#F97316',
  accentGold: '#F59E0B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#F43F5E',
  inputBg: '#10131C',
  inputBorder: 'rgba(255, 255, 255, 0.1)',
  statusBarStyle: 'light',

  // WhatsApp-grade messaging tokens
  waHeaderBg: '#12151F',
  waTeal: '#00A884',
  waSentBubble: '#005C4B',
  waSentText: '#E9EDEF',
  waReceivedBubble: '#1E2330',
  waReceivedText: '#E9EDEF',
  waBlueCheck: '#53BDEB',
  waGrayCheck: '#8696A0',
  waFab: '#00A884',
};

export const lightPalette = {
  bg: '#F8FAFC',
  bgSecondary: '#FFFFFF',
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
  error: '#E11D48',
  inputBg: '#F8FAFC',
  inputBorder: '#CBD5E1',
  statusBarStyle: 'dark',

  // WhatsApp-grade messaging tokens
  waHeaderBg: '#008069',
  waTeal: '#008069',
  waSentBubble: '#D9FDD3',
  waSentText: '#111B21',
  waReceivedBubble: '#FFFFFF',
  waReceivedText: '#111B21',
  waBlueCheck: '#53BDEB',
  waGrayCheck: '#8696A0',
  waFab: '#008069',
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
