import React, { useState, useEffect } from 'react';
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

export default function TeacherDashboardScreen({ onNavigateTab }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTeacherData = async () => {
    try {
      const res = await apiClient.get('/teacher/classrooms');
      setClassrooms(res.data?.data?.classrooms || []);
    } catch {
      // Demo classrooms
      setClassrooms([
        {
          id: 't-cls-1',
          name: 'Class 10 Physics Alpha',
          subject: 'Physics',
          grade: '10',
          joinCode: 'CLS-93A87E',
          _count: { memberships: 24, assignments: 3 },
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTeacherData();
  }, []);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadTeacherData();
  };

  const totalStudents = classrooms.reduce((acc, c) => acc + (c._count?.memberships || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Educator Portal"
        subtitle={user?.institution || 'Academic Administration'}
        rightElement={
          <View style={[styles.badge, { backgroundColor: `${theme.primary}20` }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>TEACHER</Text>
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
          />
        }
      >
        {/* Metric Cards */}
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.metricIcon}>🏫</Text>
            <Text style={[styles.metricVal, { color: theme.text }]}>
              {classrooms.length}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Active Classes
            </Text>
          </View>
          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.metricIcon}>👥</Text>
            <Text style={[styles.metricVal, { color: theme.text }]}>
              {totalStudents}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Total Students
            </Text>
          </View>
          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.metricIcon}>📝</Text>
            <Text style={[styles.metricVal, { color: theme.text }]}>
              {classrooms.reduce((acc, c) => acc + (c._count?.assignments || 0), 0)}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Quizzes Active
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>
          Educator Actions
        </Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('medium');
              if (onNavigateTab) onNavigateTab('noteToQuiz');
            }}
          >
            <Text style={styles.actionCardIcon}>✨</Text>
            <Text style={styles.actionCardTitle}>AI Note-to-Quiz Generator</Text>
            <Text style={styles.actionCardSub}>
              Snap handwritten notes or upload PDFs to create graded quizzes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionCardSecondary,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              if (onNavigateTab) onNavigateTab('teacherClassrooms');
            }}
          >
            <Text style={styles.actionCardIcon}>🏫</Text>
            <Text style={[styles.actionCardTitleSec, { color: theme.text }]}>
              Classroom & Join Code Manager
            </Text>
            <Text style={[styles.actionCardSubSec, { color: theme.textMuted }]}>
              Generate join codes, view student rosters, and post announcements
            </Text>
          </TouchableOpacity>
        </View>

        {/* Classrooms Summary */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>
          Your Active Digital Classrooms
        </Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : classrooms.length === 0 ? (
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>
            No classrooms created yet. Tap Classroom Manager to create one.
          </Text>
        ) : (
          classrooms.map((cls) => (
            <View
              key={cls.id}
              style={[
                styles.classCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.classHeader}>
                <View>
                  <Text style={[styles.className, { color: theme.text }]}>{cls.name}</Text>
                  <Text style={[styles.classSub, { color: theme.textMuted }]}>
                    {cls.subject} · Grade {cls.grade}
                  </Text>
                </View>
                <View style={[styles.joinPill, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.joinPillText, { color: theme.primary }]}>
                    {cls.joinCode}
                  </Text>
                </View>
              </View>
            </View>
          ))
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
    padding: 18,
    paddingBottom: 32,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  actionGrid: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 16,
    padding: 18,
  },
  actionCardIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionCardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  actionCardSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  actionCardSecondary: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  actionCardTitleSec: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionCardSubSec: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  classCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  className: {
    fontSize: 14,
    fontWeight: '700',
  },
  classSub: {
    fontSize: 12,
    marginTop: 2,
  },
  joinPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  joinPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
