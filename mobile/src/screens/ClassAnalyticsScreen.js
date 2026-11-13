import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import { triggerHaptic } from '../utils/haptics';

export default function ClassAnalyticsScreen() {
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const analytics = {
    averageScore: 78.4,
    totalSubmissions: 58,
    completionRate: 92,
    passRate: 86,
    difficultyBreakdown: [
      { level: 'Easy Questions', accuracy: '94%', color: theme.success },
      { level: 'Medium Questions', accuracy: '76%', color: theme.warning },
      { level: 'Hard Questions', accuracy: '54%', color: theme.error },
    ],
    topPerformers: [
      { name: 'Hamza Khan', score: '98%', rank: '🥇 1st' },
      { name: 'Ayesha Fatima', score: '95%', rank: '🥈 2nd' },
      { name: 'Bilal Ahmed', score: '91%', rank: '🥉 3rd' },
    ],
  };

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Classroom Analytics"
        subtitle="Performance Metrics & Submission Rates"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.kpiVal, { color: theme.primary }]}>
              {analytics.averageScore}%
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>
              Class Average Score
            </Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.kpiVal, { color: theme.success }]}>
              {analytics.completionRate}%
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>
              Completion Rate
            </Text>
          </View>
        </View>

        {/* Difficulty Breakdown */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>
          Accuracy by Question Difficulty
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          {analytics.difficultyBreakdown.map((d, idx) => (
            <View
              key={idx}
              style={[
                styles.diffRow,
                idx > 0 && { borderTopWidth: 1, borderTopColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.diffLevel, { color: theme.text }]}>{d.level}</Text>
              <Text style={[styles.diffAcc, { color: d.color }]}>{d.accuracy}</Text>
            </View>
          ))}
        </View>

        {/* Top Performers */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>
          Class Leaderboard Highlights
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          {analytics.topPerformers.map((p, idx) => (
            <View
              key={idx}
              style={[
                styles.rankRow,
                idx > 0 && { borderTopWidth: 1, borderTopColor: theme.cardBorder },
              ]}
            >
              <Text style={styles.rankIcon}>{p.rank}</Text>
              <Text style={[styles.studentName, { color: theme.text }]}>{p.name}</Text>
              <Text style={[styles.studentScore, { color: theme.primary }]}>{p.score}</Text>
            </View>
          ))}
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
    padding: 18,
    paddingBottom: 32,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 26,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  diffLevel: {
    fontSize: 13,
    fontWeight: '600',
  },
  diffAcc: {
    fontSize: 14,
    fontWeight: '700',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  rankIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  studentName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  studentScore: {
    fontSize: 14,
    fontWeight: '800',
  },
});
