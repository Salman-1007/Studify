import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../utils/haptics';

export default function TabBar({ activeTab, onTabChange, isTeacher = false }) {
  const { theme } = useTheme();

  const studentTabs = [
    { key: 'dashboard', label: 'Home', icon: '🏠' },
    { key: 'arena', label: 'Arena', icon: '🔥' },
    { key: 'tests', label: 'Tests', icon: '📝' },
    { key: 'studyHub', label: 'Hub', icon: '💡' },
    { key: 'classrooms', label: 'Classes', icon: '🏫' },
  ];

  const teacherTabs = [
    { key: 'teacherDashboard', label: 'Overview', icon: '📊' },
    { key: 'teacherClassrooms', label: 'Classes', icon: '🏫' },
    { key: 'noteToQuiz', label: 'Note→Quiz', icon: '✨' },
    { key: 'analytics', label: 'Analytics', icon: '📈' },
    { key: 'chat', label: 'Messages', icon: '💬' },
  ];

  const tabs = isTeacher ? teacherTabs : studentTabs;

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('selection');
              onTabChange(tab.key);
            }}
            style={styles.tabItem}
          >
            <View
              style={[
                styles.iconContainer,
                isActive && { backgroundColor: `${theme.primary}18` },
              ]}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? theme.primary : theme.textMuted },
                isActive && { fontWeight: '800' },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 76 : 64,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 6,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabIconActive: {
    transform: [{ scale: 1.08 }],
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
