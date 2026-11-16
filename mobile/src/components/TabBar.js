import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../utils/haptics';
import {
  HomeIcon,
  ChatIcon,
  TestsIcon,
  HubIcon,
  ClassroomsIcon,
  SparklesIcon,
  TrophyIcon,
} from './Icons';

export default function TabBar({ activeTab, onTabChange, isTeacher = false }) {
  const { theme } = useTheme();

  const studentTabs = [
    { key: 'dashboard', label: 'Home', IconComponent: HomeIcon },
    { key: 'chats', label: 'Chats', IconComponent: ChatIcon },
    { key: 'tests', label: 'Tests', IconComponent: TestsIcon },
    { key: 'studyHub', label: 'Hub', IconComponent: HubIcon },
    { key: 'classrooms', label: 'Classes', IconComponent: ClassroomsIcon },
  ];

  const teacherTabs = [
    { key: 'teacherDashboard', label: 'Overview', IconComponent: HomeIcon },
    { key: 'chats', label: 'Chats', IconComponent: ChatIcon },
    { key: 'teacherClassrooms', label: 'Classes', IconComponent: ClassroomsIcon },
    { key: 'noteToQuiz', label: 'Note→Quiz', IconComponent: SparklesIcon },
    { key: 'analytics', label: 'Analytics', IconComponent: TrophyIcon },
  ];

  const tabs = isTeacher ? teacherTabs : studentTabs;

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.bgSecondary,
          borderTopColor: theme.cardBorder,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const IconComp = tab.IconComponent;
        const iconColor = isActive ? theme.primary : theme.textMuted;

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
                isActive && { backgroundColor: `${theme.primary}15` },
              ]}
            >
              <IconComp size={20} color={iconColor} strokeWidth={isActive ? 2.2 : 1.8} />
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? theme.text : theme.textMuted },
                isActive && { fontWeight: '700' },
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
    height: Platform.OS === 'ios' ? 76 : 62,
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingTop: 6,
    borderTopWidth: 1,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
