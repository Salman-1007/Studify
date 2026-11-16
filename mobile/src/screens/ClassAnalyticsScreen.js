import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function ClassAnalyticsScreen({ onBack }) {
  const { theme } = useTheme();

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiClient.get('/teacher/analytics');
      setAnalyticsData(res.data?.data || null);
    } catch (err) {
      console.warn('[ClassAnalytics] Error loading analytics:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadAnalytics();
  };

  const classrooms = analyticsData?.classroomStats || analyticsData?.classrooms || [];
  const assignments = analyticsData?.assignments || [];
  const totalStudents = classrooms.reduce((acc, c) => acc + (c.memberCount || c.studentCount || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Classroom Analytics"
        subtitle="Performance Metrics & Enrollment"
        showBack={Boolean(onBack)}
        onBack={onBack}
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
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Text style={[styles.kpiVal, { color: theme.primary }]}>{classrooms.length}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Active Classes</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Text style={[styles.kpiVal, { color: theme.success }]}>{totalStudents}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Total Students</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Text style={[styles.kpiVal, { color: theme.accentGold }]}>{assignments.length}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Quizzes Assigned</Text>
              </View>
            </View>

            {/* Class Breakdown List */}
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Classroom Enrollment Summary</Text>

            {classrooms.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No classrooms data found. Create a class to begin tracking metrics.
                </Text>
              </View>
            ) : (
              classrooms.map((cls, idx) => (
                <View
                  key={cls.id || idx}
                  style={[styles.classItem, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.classItemName, { color: theme.text }]}>{cls.name || cls.classroom?.name}</Text>
                    <Text style={[styles.classItemMeta, { color: theme.textMuted }]}>
                      Join Code: {cls.joinCode} • Subject: {cls.subject || 'General'}
                    </Text>
                  </View>
                  <View style={[styles.studentsBadge, { backgroundColor: `${theme.primary}18` }]}>
                    <Text style={[styles.studentsBadgeText, { color: theme.primary }]}>
                      {cls.memberCount || cls.studentCount || 0} Students
                    </Text>
                  </View>
                </View>
              ))
            )}

            {/* Assignments Activity */}
            <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 20 }]}>
              Recent Published Assignments
            </Text>

            {assignments.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No assignments published yet. Use the Note-to-Quiz AI tool to create and distribute assessments.
                </Text>
              </View>
            ) : (
              assignments.map((asg, idx) => (
                <View
                  key={asg.id || idx}
                  style={[styles.asgCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.asgTitle, { color: theme.text }]}>
                      {asg.quiz?.title || asg.title || 'Curriculum Quiz'}
                    </Text>
                    <Text style={[styles.asgMeta, { color: theme.textMuted }]}>
                      Class: {asg.classroom?.name || 'Classroom'} • Passing: {asg.passingScore || 50}%
                    </Text>
                  </View>
                  <Text style={[styles.asgDate, { color: theme.textMuted }]}>
                    {new Date(asg.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </>
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
  kpiGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  classItemName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  classItemMeta: {
    fontSize: 12,
  },
  studentsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  studentsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  asgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  asgTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  asgMeta: {
    fontSize: 12,
  },
  asgDate: {
    fontSize: 11,
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
