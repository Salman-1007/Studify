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

export default function TeacherDashboardScreen({ onNavigateTab }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [dashboardData, setDashboardData] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTeacherData = useCallback(async () => {
    try {
      const [dashRes, clsRes] = await Promise.allSettled([
        apiClient.get('/teacher/dashboard'),
        apiClient.get('/teacher/classrooms'),
      ]);

      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value.data?.data);
      }

      if (clsRes.status === 'fulfilled') {
        setClassrooms(clsRes.value.data?.data?.classrooms || clsRes.value.data?.data || []);
      }
    } catch (err) {
      console.warn('[TeacherDashboard] Error loading data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTeacherData();
  }, [loadTeacherData]);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadTeacherData();
  };

  const totalStudents = classrooms.reduce(
    (acc, c) => acc + (c._count?.memberships || c.memberCount || 0),
    0
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Educator Portal"
        subtitle={user?.institution || user?.name || 'Academic Workspace'}
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
            colors={[theme.primary]}
          />
        }
      >
        {/* Metric Cards */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.metricIcon}>🏫</Text>
            <Text style={[styles.metricVal, { color: theme.text }]}>{classrooms.length}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Active Classes</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.metricIcon}>👨‍🎓</Text>
            <Text style={[styles.metricVal, { color: theme.primary }]}>{totalStudents}</Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Enrolled Students</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={styles.metricIcon}>📝</Text>
            <Text style={[styles.metricVal, { color: theme.accentGold }]}>
              {dashboardData?.totalAssignments || dashboardData?.activeAssignments || 0}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Assignments</Text>
          </View>
        </View>

        {/* Action Shortcuts */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Educator Tools</Text>

        <View style={styles.toolsGrid}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              if (onNavigateTab) onNavigateTab('noteToQuiz');
            }}
            style={[styles.toolCard, { backgroundColor: theme.card, borderColor: `${theme.primary}50` }]}
          >
            <Text style={styles.toolIcon}>✨</Text>
            <Text style={[styles.toolTitle, { color: theme.text }]}>Note-to-Quiz AI</Text>
            <Text style={[styles.toolSub, { color: theme.textMuted }]}>
              Paste lecture notes or upload a chapter to generate verified board MCQs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              if (onNavigateTab) onNavigateTab('teacherClassrooms');
            }}
            style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <Text style={styles.toolIcon}>📢</Text>
            <Text style={[styles.toolTitle, { color: theme.text }]}>Post Announcements</Text>
            <Text style={[styles.toolSub, { color: theme.textMuted }]}>
              Broadcast exam dates and syllabus updates with instant mobile push notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              if (onNavigateTab) onNavigateTab('analytics');
            }}
            style={[styles.toolCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <Text style={styles.toolIcon}>📈</Text>
            <Text style={[styles.toolTitle, { color: theme.text }]}>Class Analytics</Text>
            <Text style={[styles.toolSub, { color: theme.textMuted }]}>
              Inspect class-wide average accuracy, completion rates, and weak topics
            </Text>
          </TouchableOpacity>
        </View>

        {/* Classrooms Preview */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: 0 }]}>My Classrooms</Text>
          <TouchableOpacity onPress={() => onNavigateTab && onNavigateTab('teacherClassrooms')}>
            <Text style={[styles.actionLink, { color: theme.primary }]}>Manage All →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
        ) : classrooms.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No digital classes created yet. Tap "Manage All" to create your first class.
            </Text>
          </View>
        ) : (
          classrooms.slice(0, 3).map((cls) => (
            <TouchableOpacity
              key={cls.id}
              activeOpacity={0.7}
              onPress={() => onNavigateTab && onNavigateTab('teacherClassrooms')}
              style={[styles.classItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.className, { color: theme.text }]}>{cls.name}</Text>
                <Text style={[styles.classMeta, { color: theme.textMuted }]}>
                  {cls.subject} • Grade {cls.classGrade || cls.grade || '10'}
                </Text>
              </View>
              <View style={[styles.codeBadge, { backgroundColor: `${theme.primary}18` }]}>
                <Text style={[styles.codeText, { color: theme.primary }]}>{cls.joinCode}</Text>
              </View>
            </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 40,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  metricIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  toolsGrid: {
    gap: 10,
    marginBottom: 24,
  },
  toolCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  toolIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  toolSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  className: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  classMeta: {
    fontSize: 12,
  },
  codeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
