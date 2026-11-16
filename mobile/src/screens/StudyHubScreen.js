import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import { triggerHaptic } from '../utils/haptics';
import {
  SparklesIcon,
  DocumentIcon,
  HubIcon,
  UsersIcon,
} from '../components/Icons';

import MentorScreen from './MentorScreen';
import MaterialsScreen from './MaterialsScreen';
import FlashcardsScreen from './FlashcardsScreen';
import StudyGroupsScreen from './StudyGroupsScreen';

export default function StudyHubScreen({ initialSection = null }) {
  const { theme } = useTheme();

  // Active section: null (hub menu) | 'mentor' | 'materials' | 'flashcards' | 'groups'
  const [activeSection, setActiveSection] = useState(initialSection);

  if (activeSection === 'mentor') {
    return <MentorScreen onBack={() => setActiveSection(null)} />;
  }

  if (activeSection === 'materials') {
    return <MaterialsScreen onBack={() => setActiveSection(null)} />;
  }

  if (activeSection === 'flashcards') {
    return <FlashcardsScreen onBack={() => setActiveSection(null)} />;
  }

  if (activeSection === 'groups') {
    return <StudyGroupsScreen onBack={() => setActiveSection(null)} />;
  }

  const sections = [
    {
      id: 'mentor',
      IconComp: SparklesIcon,
      title: '24/7 AI Study Mentor',
      subtitle: 'Ask conceptual questions, solve formulas, and clarify Pakistani board topics.',
      badge: 'Curriculum AI',
      color: theme.primary,
    },
    {
      id: 'materials',
      IconComp: DocumentIcon,
      title: 'Study Materials & Notes',
      subtitle: 'Upload lecture slides or PDFs. AI auto-generates summaries, flashcards & tests.',
      badge: 'Document AI',
      color: theme.accent,
    },
    {
      id: 'flashcards',
      IconComp: HubIcon,
      title: 'Spaced Repetition Flashcards',
      subtitle: 'Study with 3D flip cards and active recall intervals (1d, 3d, 7d).',
      badge: 'Active Recall',
      color: theme.success,
    },
    {
      id: 'groups',
      IconComp: UsersIcon,
      title: 'Collaborative Study Circles',
      subtitle: 'Join peer groups, discuss board exam problems, and challenge friends to quiz battles.',
      badge: 'Peer Learning',
      color: theme.accentGold,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Study Hub"
        subtitle="AI Tutor, Documents, Flashcards & Circles"
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Intelligent Learning Tools</Text>

        <View style={styles.grid}>
          {sections.map((item) => {
            const IconComp = item.IconComp;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('medium');
                  setActiveSection(item.id);
                }}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: `${item.color}18` }]}>
                    <IconComp size={22} color={item.color} />
                  </View>
                  <View style={[styles.badge, { backgroundColor: `${item.color}15` }]}>
                    <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
                  </View>
                </View>

                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.cardSub, { color: theme.textMuted }]}>{item.subtitle}</Text>

                <View style={styles.cardFooter}>
                  <Text style={[styles.actionText, { color: item.color }]}>Open Tool →</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  grid: {
    gap: 14,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
