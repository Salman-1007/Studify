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

export default function DashboardScreen({
  onEnterArena,
  onOpenStandardTests,
  onOpenMentor,
  onOpenMaterials,
  onOpenFlashcards,
  onOpenStudyGroups,
  onOpenClassrooms,
  onOpenLeaderboard,
  onOpenProfile,
}) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [arenaStatus, setArenaStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentTests, setRecentTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [arenaRes, statsRes, historyRes] = await Promise.allSettled([
        apiClient.get('/daily-arena/status'),
        apiClient.get('/auth/me'),
        apiClient.get('/standard-tests/history'),
      ]);

      if (arenaRes.status === 'fulfilled') {
        const arenaData = arenaRes.value.data?.data;
        setArenaStatus(arenaData);
        if (arenaData?.secondsUntilReset) {
          setCountdown(arenaData.secondsUntilReset);
        }
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data?.data?.user);
      }

      if (historyRes.status === 'fulfilled') {
        const hist = historyRes.value.data?.data?.attempts || historyRes.value.data?.data || [];
        setRecentTests(hist.slice(0, 3));
      }
    } catch (err) {
      console.warn('[Dashboard] Error fetching dashboard data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Countdown clock to midnight PKT
  useEffect(() => {
    const cdTimer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cdTimer);
  }, []);

  const formatCountdown = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m left`;
  };

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadData();
  };

  const streak = stats?.streakCount || arenaStatus?.streakCount || user?.streakCount || 0;
  const points = stats?.points || user?.points || 0;

  const quickActions = [
    {
      id: 'arena',
      icon: '🔥',
      title: 'Daily Arena',
      sub: '15 Timed Questions',
      badge: '+50 XP',
      onPress: onEnterArena,
    },
    {
      id: 'tests',
      icon: '🩺',
      title: 'Entry Tests',
      sub: 'MDCAT & ECAT Mocks',
      badge: 'Full Exam',
      onPress: onOpenStandardTests,
    },
    {
      id: 'mentor',
      icon: '🤖',
      title: 'AI Mentor',
      sub: '24/7 Curriculum Tutor',
      badge: 'FBISE/PTB',
      onPress: onOpenMentor,
    },
    {
      id: 'materials',
      icon: '📄',
      title: 'Materials & Notes',
      sub: 'PDF Upload & AI Docs',
      badge: 'AI Summary',
      onPress: onOpenMaterials,
    },
    {
      id: 'flashcards',
      icon: '🗂️',
      title: 'Flashcards',
      sub: 'Spaced Repetition',
      badge: 'Active Recall',
      onPress: onOpenFlashcards,
    },
    {
      id: 'groups',
      icon: '👥',
      title: 'Study Circles',
      sub: 'Collaborate & Chat',
      badge: 'Peer Study',
      onPress: onOpenStudyGroups,
    },
    {
      id: 'classrooms',
      icon: '🏫',
      title: 'Classrooms',
      sub: 'Teacher Assignments',
      badge: 'Join Class',
      onPress: onOpenClassrooms,
    },
    {
      id: 'leaderboard',
      icon: '🏆',
      title: 'Leaderboard',
      sub: 'National Standings',
      badge: 'Top Ranks',
      onPress: onOpenLeaderboard,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Studify"
        subtitle={`Welcome, ${user?.name ? user.name.split(' ')[0] : 'Scholar'}`}
        rightElement={
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenProfile}
            style={[styles.streakBadge, { backgroundColor: `${theme.accent}18` }]}
          >
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={[styles.streakCount, { color: theme.accent }]}>{streak}d</Text>
          </TouchableOpacity>
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
        <View style={[styles.arenaCard, { backgroundColor: theme.card, borderColor: `${theme.accent}40` }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.liveTag, { backgroundColor: `${theme.accent}20` }]}>
              <Text style={[styles.liveText, { color: theme.accent }]}>🔥 DAILY ARENA</Text>
            </View>
            <Text style={[styles.bonusTag, { color: theme.accentGold }]}>+50 XP BONUS</Text>
          </View>

          <Text style={[styles.arenaTitle, { color: theme.text }]}>Today's Curriculum Challenge</Text>
          <Text style={[styles.arenaDesc, { color: theme.textSecondary }]}>
            Complete today's 15-question challenge matched to your board curriculum. Maintain your daily streak!
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 14 }} />
          ) : (
            <View style={[styles.arenaMetrics, { backgroundColor: theme.cardHover }]}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Current Streak</Text>
                <Text style={[styles.metricValue, { color: theme.accent }]}>{streak} Days</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Resets In</Text>
                <Text style={[styles.metricValue, { color: theme.accentGold }]}>
                  {formatCountdown(countdown)}
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
            <Text style={styles.arenaButtonText}>
              {arenaStatus?.hasCompletedToday ? 'Review Daily Challenge →' : 'Enter Daily Arena →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Grid */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Academic Overview</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{points}</Text>
            <Text style={[styles.statTitle, { color: theme.textMuted }]}>Total XP</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.statIcon}>🏛️</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {user?.board || 'FBISE'}
            </Text>
            <Text style={[styles.statTitle, { color: theme.textMuted }]}>Board</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.statIcon}>🎓</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {user?.grade ? `Class ${user.grade}` : 'MDCAT'}
            </Text>
            <Text style={[styles.statTitle, { color: theme.textMuted }]}>Curriculum</Text>
          </View>
        </View>

        {/* Quick Action Hub (8 Grid Cards) */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Study Ecosystem</Text>
        <View style={styles.actionGrid}>
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('light');
                if (item.onPress) item.onPress();
              }}
              style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={styles.actionCardHeader}>
                <Text style={styles.actionIcon}>{item.icon}</Text>
                <View style={[styles.actionBadge, { backgroundColor: `${theme.primary}18` }]}>
                  <Text style={[styles.actionBadgeText, { color: theme.primary }]}>{item.badge}</Text>
                </View>
              </View>
              <Text style={[styles.actionTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Test History */}
        {recentTests.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.recentHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Recent Tests</Text>
              <TouchableOpacity onPress={onOpenStandardTests}>
                <Text style={[styles.viewAllLink, { color: theme.primary }]}>View All →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentList}>
              {recentTests.map((t) => (
                <View
                  key={t.id}
                  style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recentTitle, { color: theme.text }]}>
                      {t.subject?.name || t.track || 'Mock Test'}
                    </Text>
                    <Text style={[styles.recentMeta, { color: theme.textMuted }]}>
                      Score: {t.score}/{t.totalQuestions} • {new Date(t.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.recentScoreBadge,
                      { backgroundColor: t.percentage >= 60 ? `${theme.success}18` : `${theme.error}18` },
                    ]}
                  >
                    <Text
                      style={{
                        color: t.percentage >= 60 ? theme.success : theme.error,
                        fontWeight: '800',
                        fontSize: 13,
                      }}
                    >
                      {t.percentage}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  streakFire: {
    fontSize: 14,
    marginRight: 4,
  },
  streakCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  arenaCard: {
    borderRadius: 20,
    padding: 20,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bonusTag: {
    fontSize: 12,
    fontWeight: '800',
  },
  arenaTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  arenaDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  arenaMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  arenaButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
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
    letterSpacing: -0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 11,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    gap: 8,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  recentMeta: {
    fontSize: 11,
  },
  recentScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
