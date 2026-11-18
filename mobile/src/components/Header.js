import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import StudifyLogo from './StudifyLogo';
import { ArrowLeftIcon, SunIcon, MoonIcon } from './Icons';
import { triggerHaptic } from '../utils/haptics';

export default function Header({
  title,
  subtitle,
  rightElement,
  showBack = false,
  onBack,
  showThemeToggle = true,
}) {
  const { theme, isDark, setThemePreference } = useTheme();

  const handleToggleTheme = () => {
    triggerHaptic('light');
    setThemePreference(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.cardBorder }]}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onBack}
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <ArrowLeftIcon size={18} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <StudifyLogo size={36} />
        )}
        <View style={styles.titleBox}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {title || 'Studify'}
          </Text>
          {Boolean(subtitle) && (
            <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textMuted }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightContainer}>
        {showThemeToggle && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleToggleTheme}
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {isDark ? (
              <SunIcon size={18} color="#F59E0B" />
            ) : (
              <MoonIcon size={18} color="#6366F1" />
            )}
          </TouchableOpacity>
        )}
        {rightElement}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  titleBox: {
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
