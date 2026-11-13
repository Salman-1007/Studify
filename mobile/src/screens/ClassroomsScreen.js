import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function ClassroomsScreen({ onOpenChat }) {
  const { theme } = useTheme();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const loadClassrooms = useCallback(async () => {
    try {
      const res = await apiClient.get('/classrooms/my-classrooms');
      setClassrooms(res.data?.data?.classrooms || []);
    } catch {
      // Demo classrooms fallback
      setClassrooms([
        {
          id: 'c1',
          name: 'Class 10 Physics Prep',
          subject: 'Physics',
          grade: '10',
          joinCode: 'CLS-93A87E',
          teacher: { name: 'Prof. Tariq Mahmood', institution: 'Punjab College' },
          announcements: [
            { id: 'a1', title: 'Mid-term Board Simulation Exam', content: 'Prepare Chapter 1 to 4.' },
          ],
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadClassrooms();
  };

  const handleJoinClassroom = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a valid join code');
      triggerHaptic('error');
      return;
    }

    try {
      setJoining(true);
      setError(null);
      await apiClient.post('/classrooms/join-by-code', {
        joinCode: joinCode.trim().toUpperCase(),
      });
      triggerHaptic('success');
      setJoinModalVisible(false);
      setJoinCode('');
      loadClassrooms();
    } catch (err) {
      triggerHaptic('error');
      setError(err.response?.data?.message || 'Invalid or expired classroom join code');
    } finally {
      setJoining(false);
    }
  };

  // 1. Detailed Classroom View
  if (selectedClass) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={selectedClass.name}
          subtitle={`${selectedClass.subject || 'General'} · Class ${selectedClass.grade || '10'}`}
          rightElement={
            <TouchableOpacity
              onPress={() => setSelectedClass(null)}
              style={[styles.closeBtn, { backgroundColor: theme.cardBorder }]}
            >
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Teacher Badge */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>Teacher Details</Text>
            <Text style={[styles.teacherName, { color: theme.primary }]}>
              {selectedClass.teacher?.name || 'Educator'}
            </Text>
            {selectedClass.teacher?.institution ? (
              <Text style={[styles.instName, { color: theme.textMuted }]}>
                {selectedClass.teacher.institution}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                triggerHaptic('light');
                if (onOpenChat) onOpenChat(selectedClass);
              }}
            >
              <Text style={styles.chatBtnText}>💬 Enter Classroom Chat Room</Text>
            </TouchableOpacity>
          </View>

          {/* Announcements */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 18 }]}>
            Recent Announcements
          </Text>
          {selectedClass.announcements && selectedClass.announcements.length > 0 ? (
            selectedClass.announcements.map((ann, idx) => (
              <View
                key={idx}
                style={[
                  styles.annCard,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.annTitle, { color: theme.text }]}>📢 {ann.title}</Text>
                <Text style={[styles.annContent, { color: theme.textMuted }]}>
                  {ann.content}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>
              No announcements posted yet.
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // 2. Classrooms List View
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="My Classrooms"
        subtitle="Digital learning spaces & teacher assessments"
        rightElement={
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              triggerHaptic('light');
              setJoinModalVisible(true);
            }}
          >
            <Text style={styles.joinBtnText}>+ Join Class</Text>
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
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : classrooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏫</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Classrooms Joined</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Enter a join code provided by your educator to access materials and tests.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
              onPress={() => setJoinModalVisible(true)}
            >
              <Text style={styles.emptyBtnText}>Enter Join Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          classrooms.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('light');
                setSelectedClass(cls);
              }}
              style={[
                styles.classCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.classRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.className, { color: theme.text }]}>{cls.name}</Text>
                  <Text style={[styles.classTeacher, { color: theme.textMuted }]}>
                    {cls.teacher?.name || 'Class Teacher'} · {cls.subject || 'General'}
                  </Text>
                </View>
                <View style={[styles.codePill, { backgroundColor: `${theme.primary}15` }]}>
                  <Text style={[styles.codeText, { color: theme.primary }]}>{cls.joinCode}</Text>
                </View>
              </View>
              <Text style={[styles.cardAction, { color: theme.primary }]}>View Classroom →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Join Code Modal */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Join a Classroom</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              Enter the unique 6-10 character code provided by your teacher (e.g. CLS-93A87E)
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder="CLS-93A87E"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={(t) => {
                setJoinCode(t);
                if (error) setError(null);
              }}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: theme.cardBorder }]}
                onPress={() => setJoinModalVisible(false)}
              >
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, { backgroundColor: theme.primary }]}
                onPress={handleJoinClassroom}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Join Class</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  joinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  classCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  classRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  className: {
    fontSize: 15,
    fontWeight: '700',
  },
  classTeacher: {
    fontSize: 12,
    marginTop: 2,
  },
  codePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardAction: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  emptyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  infoCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  instName: {
    fontSize: 12,
    marginTop: 2,
  },
  chatBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  chatBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  annCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  annTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  annContent: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmit: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
