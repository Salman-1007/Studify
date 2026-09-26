import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import apiClient from './src/api/client';

export default function App() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initialize push notifications
    registerForPushNotificationsAsync();

    // 2. Fetch daily arena status
    apiClient
      .get('/daily-arena/status')
      .then((res) => {
        setStatus(res.data?.data);
      })
      .catch((err) => {
        console.log('Daily arena check:', err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.title}>Studify</Text>
          <Text style={styles.subtitle}>Pakistani Curriculum & Entry Test Prep</Text>
        </View>

        {/* Daily Mock Arena Card */}
        <View style={styles.arenaCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>🔥 DAILY ARENA LIVE</Text>
            <Text style={styles.xpText}>+50 XP BONUS</Text>
          </View>
          <Text style={styles.cardTitle}>Daily Mock Exam Challenge</Text>
          <Text style={styles.cardDesc}>
            Take today's timed mock across Class 9–12, MDCAT (PMDC) & ECAT (UET). Maintain your streak!
          </Text>

          {loading ? (
            <ActivityIndicator color="#3B82F6" style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.statusRow}>
              <Text style={styles.statLabel}>
                Streak: <Text style={styles.statValue}>{status?.streakCount || 0} Days</Text>
              </Text>
              <Text style={styles.statLabel}>
                Resets: <Text style={styles.statValue}>{status?.secondsUntilReset ? Math.floor(status.secondsUntilReset / 3600) + 'h left' : 'Today'}</Text>
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Enter Daily Arena</Text>
          </TouchableOpacity>
        </View>

        {/* Tracks Grid */}
        <Text style={styles.sectionHeader}>Available Syllabuses</Text>
        <View style={styles.grid}>
          {['Class 9', 'Class 10', 'Class 11', 'Class 12', 'MDCAT (Medical)', 'ECAT (Engg)'].map(
            (track, idx) => (
              <View key={idx} style={styles.trackCard}>
                <Text style={styles.trackTitle}>{track}</Text>
                <Text style={styles.trackDesc}>Verified MCQs & Chapter Tests</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  scroll: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  arenaCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    marginTop: 10,
    marginBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FB923C',
  },
  xpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statValue: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackCard: {
    width: '48%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  trackDesc: {
    fontSize: 11,
    color: '#64748B',
  },
});
