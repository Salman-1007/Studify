import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function LeaderboardScreen({ onBack }) {
  const { theme } = useTheme();

  // Tab: 'global' | 'arena'
  const [activeTab, setActiveTab] = useState('global');
  const [globalList, setGlobalList] = useState([]);
  const [arenaList, setArenaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [globalRes, arenaRes] = await Promise.allSettled([
        apiClient.get('/leaderboard'),
        apiClient.get('/daily-arena/leaderboard'),
      ]);

      if (globalRes.status === 'fulfilled') {
        setGlobalList(globalRes.value.data?.data?.leaderboard || globalRes.value.data?.data || []);
      }

      if (arenaRes.status === 'fulfilled') {
        setArenaList(arenaRes.value.data?.data?.leaderboard || []);
      }
    } catch (err) {
      console.warn('[Leaderboard] Load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeList = activeTab === 'global' ? globalList : arenaList;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Leaderboard"
        subtitle="National Student Standings"
        showBack={Boolean(onBack)}
        onBack={onBack}
      />

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            setActiveTab('global');
          }}
          style={[styles.tabItem, activeTab === 'global' && { borderBottomColor: theme.primary, borderBottomWidth: 2.5 }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'global' ? theme.primary : theme.textMuted, fontWeight: activeTab === 'global' ? '700' : '500' }]}>
            ⚡ Global XP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            setActiveTab('arena');
          }}
          style={[styles.tabItem, activeTab === 'arena' && { borderBottomColor: theme.primary, borderBottomWidth: 2.5 }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'arena' ? theme.primary : theme.textMuted, fontWeight: activeTab === 'arena' ? '700' : '500' }]}>
            🔥 Daily Arena
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              triggerHaptic('light');
              setRefreshing(true);
              loadData();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : activeList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🏆</Text>
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Rankings Available</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Practice tests and complete Daily Arenas to claim your spot on the national leaderboard!
            </Text>
          </View>
        ) : (
          activeList.map((item, idx) => {
            const isTop3 = idx < 3;
            const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const name = item.name || item.user?.name || item.username || 'Scholar';
            const xp = item.points || item.xp || item.score || 0;

            return (
              <View
                key={item.id || item.userId || idx}
                style={[
                  styles.rankCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: isTop3 ? `${theme.accentGold}40` : theme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.rankLabel, { color: isTop3 ? theme.accentGold : theme.textMuted }]}>
                  {rankLabel}
                </Text>

                <View style={[styles.avatarCircle, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, { color: theme.text }]}>{name}</Text>
                  <Text style={[styles.rankMeta, { color: theme.textMuted }]}>
                    {activeTab === 'global' ? `Level ${item.level || 1} Scholar` : `Score: ${item.score}/${item.totalQuestions || 15} (${item.percentage || 0}%)`}
                  </Text>
                </View>

                <View style={styles.scoreBadge}>
                  <Text style={[styles.scoreNumber, { color: theme.primary }]}>
                    {activeTab === 'global' ? `${xp} XP` : `${item.timeTakenSecs || 0}s`}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  rankLabel: {
    width: 34,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rankMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'flex-end',
  },
  scoreNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyHeadline: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
