import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import StudifyLogo from './StudifyLogo';

export default function Header({ title, subtitle, rightElement }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.cardBorder }]}>
      <View style={styles.leftContainer}>
        <StudifyLogo size={36} />
        <View>
          <Text style={[styles.title, { color: theme.text }]}>{title || 'Studify'}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {rightElement ? <View style={styles.rightContainer}>{rightElement}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    fontSize: 20,
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
});
