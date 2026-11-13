import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function DashboardScreen({ onSelectTrack, onEnterArena }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [arenaStatus, setArenaStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [arenaRes, statsRes] = await Promise.allSettled([
        apiClient.get('/daily-arena/status'),
        apiClient.get('/auth/me'),
      ]);

      if (arenaRes.status === 'fulfilled') {
        setArenaStatus(arenaRes.value.data?.data);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data?.data?.user);
      }
    } catch (err) {
      console.warn('[Dashboard] Error fetching data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadData();
  };

  const streak = stats?.streakCount || arenaStatus?.streakCount || 0;
  const points = stats?.points || 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Studify"
        subtitle={`Welcome back, ${user?.name ? user.name.split(' ')[0] : 'Scholar'}`}
        rightElement={
          <View style={[styles.streakBadge, { backgroundColor: `${theme.accent}20` }]}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={[styles.streakCount, { color: theme.accent }]}>{streak}d</Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Daily Arena Hero Card */}
        <View
          style={[
            styles.arenaCard,
            {
              backgroundColor: theme.card,
              borderColor: `${theme.accent}50`,
            },
          ]}
        >
          <View style={styles.badgeRow}>
            <View style={[styles.liveTag, { backgroundColor: `${theme.accent}25` }]}>
              <Text style={[styles.liveText, { color: theme.accent }]}>🔥 DAILY ARENA</Text>
            </View>
            <Text style={[styles.bonusTag, { color: theme.accentGold }]}>+50 XP BONUS</Text>
          </View>

          <Text style={[styles.arenaTitle, { color: theme.text }]}>
            Daily Mock Exam Challenge
          </Text>
          <Text style={[styles.arenaDesc, { color: theme.textMuted }]}>
            Test your knowledge across Pakistan curriculum boards. 10 rapid-fire questions to maintain your learning streak!
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 14 }} />
          ) : (
            <View style={[styles.arenaMetrics, { borderColor: theme.cardBorder }]}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Current Streak</Text>
                <Text style={[styles.metricValue, { color: theme.accent }]}>{streak} Days</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Next Reset</Text>
                <Text style={[styles.metricValue, { color: theme.primary }]}>
                  {arenaStatus?.secondsUntilReset
                    ? `${Math.floor(arenaStatus.secondsUntilReset / 3600)}h left`
                    : 'Midnight'}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.arenaButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('medium');
              if (onEnterArena) onEnterArena();
            }}
          >
            <Text style={styles.arenaButtonText}>Start Daily Arena Mock</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Grid */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Learning Progress</Text>
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{points}</Text>
            <Text style={[styles.statTitle, { color: theme.textMuted }]}>Total XP</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.statIcon}>🏆</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {user?.board || 'Punjab'}
            </Text>
            <Text style={[styles.statTitle, { color: theme.textMuted }]}>Board</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.statIcon}>🎓</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {user?.grade ? `Class ${user.grade}` : 'SSC/HSSC'}
            </Text>
            <Text style={[styles.statTitle, { color: theme.textMuted }]}>Curriculum</Text>
          </View>
        </View>

        {/* Syllabuses & Standard Exams */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>
          Curriculum Mock Tests
        </Text>
        <View style={styles.tracksGrid}>
          {[
            { id: '9', name: 'Class 9 (Matric I)', desc: 'Physics, Chem, Biology, Math', tag: 'FBISE/BISE' },
            { id: '10', name: 'Class 10 (Matric II)', desc: 'Full Board Exam Simulation', tag: 'FBISE/BISE' },
            { id: '11', name: 'Class 11 (FSc I)', desc: 'Pre-Medical & Pre-Engineering', tag: 'Inter Part 1' },
            { id: '12', name: 'Class 12 (FSc II)', desc: 'Pre-Medical & Pre-Engineering', tag: 'Inter Part 2' },
            { id: 'MDCAT', name: 'MDCAT (PMDC)', desc: 'Medical & Dental Entry Exam', tag: '200 MCQs' },
            { id: 'ECAT', name: 'ECAT (UET)', desc: 'Engineering College Test', tag: '100 MCQs' },
          ].map((track) => (
            <TouchableOpacity
              key={track.id}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('light');
                if (onSelectTrack) onSelectTrack(track);
              }}
              style={[
                styles.trackCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.trackHeader}>
                <Text style={[styles.trackName, { color: theme.text }]}>{track.name}</Text>
                <View style={[styles.trackTag, { backgroundColor: `${theme.primary}15` }]}>
                  <Text style={[styles.trackTagText, { color: theme.primary }]}>{track.tag}</Text>
                </View>
              </View>
              <Text style={[styles.trackDesc, { color: theme.textMuted }]}>{track.desc}</Text>
              <Text style={[styles.trackAction, { color: theme.primary }]}>Practice Now →</Text>
            </TouchableOpacity>
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  streakFire: {
    fontSize: 14,
  },
  streakCount: {
    fontSize: 12,
    fontWeight: '800',
  },
  arenaCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bonusTag: {
    fontSize: 11,
    fontWeight: '800',
  },
  arenaTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  arenaDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  arenaMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  arenaButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  arenaButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statTitle: {
    fontSize: 10,
    marginTop: 2,
  },
  tracksGrid: {
    gap: 10,
  },
  trackCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  trackName: {
    fontSize: 14,
    fontWeight: '700',
  },
  trackTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trackTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  trackDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  trackAction: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
});
