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
import {
  FlameIcon,
  TestsIcon,
  SparklesIcon,
  DocumentIcon,
  UsersIcon,
  ClassroomsIcon,
  TrophyIcon,
  HubIcon,
  ShieldIcon,
} from '../components/Icons';

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
  onOpenAdmin,
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
        apiClient.get('/tests/history').catch(() => apiClient.get('/standard-tests/history')),
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
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadData();
  };

  const streak = stats?.streakCount || arenaStatus?.streakCount || user?.streakCount || 0;
  const points = stats?.points || user?.points || 0;
  const isAdmin = user?.role === 'ADMIN' || user?.email?.toLowerCase() === 'msalmanadil44@gmail.com';

  const quickActions = [
    ...(isAdmin
      ? [
          {
            id: 'admin',
            IconComp: ShieldIcon,
            iconColor: '#F43F5E',
            title: 'Admin Panel',
            sub: 'System Control',
            badge: 'Admin',
            onPress: onOpenAdmin,
          },
        ]
      : []),
    {
      id: 'arena',
      IconComp: FlameIcon,
      iconColor: theme.accent,
      title: 'Daily Arena',
      sub: '15 Timed Questions',
      badge: '+50 XP',
      onPress: onEnterArena,
    },
    {
      id: 'tests',
      IconComp: TestsIcon,
      iconColor: theme.primary,
      title: 'Entrance Exams',
      sub: 'MDCAT & ECAT Mocks',
      badge: 'Full Exam',
      onPress: onOpenStandardTests,
    },
    {
      id: 'mentor',
      IconComp: SparklesIcon,
      iconColor: theme.waTeal,
      title: 'AI Study Mentor',
      sub: '24/7 Curriculum Tutor',
      badge: 'FBISE/PTB',
      onPress: onOpenMentor,
    },
    {
      id: 'materials',
      IconComp: DocumentIcon,
      iconColor: theme.accentGold,
      title: 'Materials & Notes',
      sub: 'PDF Upload & AI Summary',
      badge: 'Document AI',
      onPress: onOpenMaterials,
    },
    {
      id: 'flashcards',
      IconComp: HubIcon,
      iconColor: theme.success,
      title: 'Flashcards',
      sub: 'Spaced Repetition SRS',
      badge: 'Active Recall',
      onPress: onOpenFlashcards,
    },
    {
      id: 'groups',
      IconComp: UsersIcon,
      iconColor: theme.accent,
      title: 'Study Circles',
      sub: 'Peer Discussions',
      badge: 'Collaborate',
      onPress: onOpenStudyGroups,
    },
    {
      id: 'classrooms',
      IconComp: ClassroomsIcon,
      iconColor: theme.primary,
      title: 'Classrooms',
      sub: 'Teacher Assignments',
      badge: 'Enrolled',
      onPress: onOpenClassrooms,
    },
    {
      id: 'leaderboard',
      IconComp: TrophyIcon,
      iconColor: theme.accentGold,
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
          <View style={styles.headerRightBox}>
            {isAdmin && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('medium');
                  onOpenAdmin?.();
                }}
                style={styles.adminTopPill}
              >
                <ShieldIcon size={12} color="#F43F5E" />
                <Text style={styles.adminTopPillText}>Admin</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.streakPill, { backgroundColor: `${theme.accent}15` }]}>
              <FlameIcon size={16} color={theme.accent} />
              <Text style={[styles.streakCountText, { color: theme.accent }]}>{streak}d</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onOpenProfile}
              style={[styles.profileAvatarBtn, { backgroundColor: `${theme.primary}20` }]}
            >
              <Text style={[styles.profileAvatarInitial, { color: theme.primary }]}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
              </Text>
            </TouchableOpacity>
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
        {/* Admin Executive Shortcut Banner */}
        {isAdmin && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('medium');
              onOpenAdmin?.();
            }}
            style={[styles.adminBannerCard, { backgroundColor: theme.card, borderColor: 'rgba(244, 63, 94, 0.35)' }]}
          >
            <View style={styles.adminBannerContent}>
              <View style={[styles.adminBannerIcon, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <ShieldIcon size={20} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.adminBannerHeaderRow}>
                  <Text style={[styles.adminBannerTitle, { color: theme.text }]}>Admin Panel</Text>
                  <View style={styles.adminTagBadge}>
                    <Text style={styles.adminTagBadgeText}>MANAGEMENT</Text>
                  </View>
                </View>
                <Text style={[styles.adminBannerSubtitle, { color: theme.textMuted }]}>
                  Verify educators, canonical MCQs, student safety & notes audit
                </Text>
              </View>
            </View>
            <View style={styles.adminBannerAction}>
              <Text style={styles.adminBannerActionText}>Open Panel →</Text>
            </View>
          </TouchableOpacity>
        )}
        {/* ==================================================== */}
        {/* DAILY ARENA HERO CARD (ON HOME PAGE)                  */}
        {/* ==================================================== */}
        <View style={[styles.arenaCard, { backgroundColor: theme.card, borderColor: `${theme.accent}30` }]}>
          <View style={styles.arenaHeaderRow}>
            <View style={styles.arenaTagRow}>
              <FlameIcon size={16} color={theme.accent} />
              <Text style={[styles.arenaTagName, { color: theme.accent }]}>DAILY ARENA</Text>
            </View>
            <View style={[styles.bonusPill, { backgroundColor: `${theme.accentGold}18` }]}>
              <Text style={[styles.bonusPillText, { color: theme.accentGold }]}>+50 XP BONUS</Text>
            </View>
          </View>

          <Text style={[styles.arenaTitle, { color: theme.text }]}>Today's Curriculum Challenge</Text>
          <Text style={[styles.arenaSub, { color: theme.textSecondary }]}>
            15 rapid-fire questions calibrated to your syllabus. Maintain your daily study streak!
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 14 }} />
          ) : (
            <View style={[styles.arenaStatsRow, { backgroundColor: theme.cardHover }]}>
              <View style={styles.arenaStatCol}>
                <Text style={[styles.arenaStatLabel, { color: theme.textMuted }]}>ACTIVE STREAK</Text>
                <Text style={[styles.arenaStatVal, { color: theme.accent }]}>{streak} Days</Text>
              </View>
              <View style={[styles.arenaStatDivider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.arenaStatCol}>
                <Text style={[styles.arenaStatLabel, { color: theme.textMuted }]}>RESETS IN</Text>
                <Text style={[styles.arenaStatVal, { color: theme.accentGold }]}>
                  {formatCountdown(countdown)}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.arenaActionBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('medium');
              if (onEnterArena) onEnterArena();
            }}
          >
            <Text style={styles.arenaActionBtnText}>
              {arenaStatus?.hasCompletedToday ? 'Review Daily Challenge Results →' : 'Enter Daily Challenge →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Academic Overview KPIs */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Academic Standing</Text>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{points}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Total XP</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{user?.board || 'Punjab'}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Board</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{user?.grade ? `Class ${user.grade}` : 'MDCAT'}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Curriculum</Text>
          </View>
        </View>

        {/* 8-Tile Quick Action Grid */}
        <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 20 }]}>Study Ecosystem</Text>
        <View style={styles.grid}>
          {quickActions.map((item) => {
            const IconComp = item.IconComp;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.75}
                onPress={() => {
                  triggerHaptic('light');
                  if (item.onPress) item.onPress();
                }}
                style={[styles.gridCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.gridCardTop}>
                  <View style={[styles.iconBox, { backgroundColor: `${item.iconColor}18` }]}>
                    <IconComp size={18} color={item.iconColor} />
                  </View>
                  <View style={[styles.badgePill, { backgroundColor: `${item.iconColor}15` }]}>
                    <Text style={[styles.badgePillText, { color: item.iconColor }]}>{item.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.gridTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.gridSub, { color: theme.textMuted }]}>{item.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Performance History */}
        {recentTests.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <View style={styles.recentSectionHeader}>
              <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: 0 }]}>Recent Tests</Text>
              <TouchableOpacity onPress={onOpenStandardTests}>
                <Text style={[styles.viewAllText, { color: theme.primary }]}>View All →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentList}>
              {recentTests.map((t) => (
                <View
                  key={t.id}
                  style={[styles.recentItemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recentItemTitle, { color: theme.text }]}>
                      {t.subject?.name || t.track || 'Mock Test'}
                    </Text>
                    <Text style={[styles.recentItemMeta, { color: theme.textMuted }]}>
                      Score: {t.score}/{t.totalQuestions} • {new Date(t.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.scoreBadgePill,
                      { backgroundColor: t.percentage >= 60 ? `${theme.success}18` : `${theme.error}18` },
                    ]}
                  >
                    <Text
                      style={{
                        color: t.percentage >= 60 ? theme.success : theme.error,
                        fontWeight: '800',
                        fontSize: 12,
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
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  streakCountText: {
    fontSize: 12,
    fontWeight: '800',
  },
  profileAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
  },

  // Daily Arena Hero Card
  arenaCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  arenaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  arenaTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arenaTagName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bonusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bonusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  arenaTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  arenaSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  arenaStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  arenaStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  arenaStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  arenaStatVal: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  arenaStatDivider: {
    width: 1,
    height: 20,
  },
  arenaActionBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  arenaActionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // KPIs
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // 8-Tile Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  gridCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  gridSub: {
    fontSize: 11,
    lineHeight: 14,
  },

  // Recent History
  recentSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    gap: 8,
  },
  recentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  recentItemMeta: {
    fontSize: 11,
  },
  scoreBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // Admin Top Button & Banner
  adminTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adminTopPillText: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  adminBannerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  adminBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  adminTagBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminTagBadgeText: {
    color: '#F43F5E',
    fontSize: 9,
    fontWeight: '800',
  },
  adminBannerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  adminBannerAction: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'flex-end',
  },
  adminBannerActionText: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: '800',
  },
});
