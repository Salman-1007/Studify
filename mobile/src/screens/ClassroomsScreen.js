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
  Alert,
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

  // Active selected classroom
  const [selectedClass, setSelectedClass] = useState(null);
  const [classAnnouncements, setClassAnnouncements] = useState([]);
  const [classAssignments, setClassAssignments] = useState([]);

  // Assignment Take Mode
  const [takingAssignment, setTakingAssignment] = useState(null);
  const [assignmentQuestions, setAssignmentQuestions] = useState([]);
  const [assignmentIndex, setAssignmentIndex] = useState(0);
  const [assignmentAnswers, setAssignmentAnswers] = useState({});
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  // Load classrooms student has joined
  const loadClassrooms = useCallback(async () => {
    try {
      const res = await apiClient.get('/classrooms/joined');
      setClassrooms(res.data?.data?.classrooms || res.data?.data || []);
    } catch (err) {
      console.warn('[Classrooms] Error loading classrooms:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  // Open Classroom Details
  const handleSelectClass = async (cls) => {
    try {
      triggerHaptic('selection');
      setSelectedClass(cls);

      const res = await apiClient.get(`/classrooms/${cls.id}`);
      const detail = res.data?.data?.classroom || res.data?.data || cls;
      setSelectedClass(detail);
      setClassAnnouncements(detail.announcements || []);
      setClassAssignments(detail.assignments || []);
    } catch (err) {
      console.warn('[Classrooms] Detail error:', err.message);
    }
  };

  // Join by code
  const handleJoinClassroom = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a valid join code');
      triggerHaptic('warning');
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
      Alert.alert('Classroom Joined! 🏫', 'You have been enrolled in the classroom.');
      loadClassrooms();
    } catch (err) {
      triggerHaptic('warning');
      setError(err.response?.data?.message || 'Invalid or expired classroom join code');
    } finally {
      setJoining(false);
    }
  };

  // Start Assignment
  const handleStartAssignment = async (assignment) => {
    try {
      triggerHaptic('medium');
      const res = await apiClient.post(`/classrooms/assignments/${assignment.id}/start`);
      const questions = res.data?.data?.questions || assignment.quiz?.questions || [];

      if (questions.length === 0) {
        Alert.alert('Notice', 'No questions found for this assignment.');
        return;
      }

      setTakingAssignment(assignment);
      setAssignmentQuestions(questions);
      setAssignmentIndex(0);
      setAssignmentAnswers({});
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not start assignment.');
    }
  };

  // Submit Assignment
  const handleSubmitAssignment = async () => {
    if (submittingAssignment || !takingAssignment) return;
    try {
      triggerHaptic('warning');
      setSubmittingAssignment(true);

      const formattedAnswers = assignmentQuestions.map((q, idx) => ({
        questionId: q.id,
        selectedOption: assignmentAnswers[idx] || null,
      }));

      const res = await apiClient.post(`/classrooms/assignments/${takingAssignment.id}/submit`, {
        answers: formattedAnswers,
        timeTakenSecs: 600,
      });

      triggerHaptic('success');
      const score = res.data?.data?.score || 0;
      const total = res.data?.data?.totalQuestions || assignmentQuestions.length;
      Alert.alert('Assignment Submitted! 🎉', `Your score: ${score}/${total}`);

      setTakingAssignment(null);
      handleSelectClass(selectedClass);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit assignment.');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Taking Assignment Runner
  // ----------------------------------------------------
  if (takingAssignment && assignmentQuestions.length > 0) {
    const currentQ = assignmentQuestions[assignmentIndex];
    const totalQ = assignmentQuestions.length;

    const options = Array.isArray(currentQ?.options)
      ? currentQ.options.map((opt, i) => {
          if (typeof opt === 'string') {
            return { key: String.fromCharCode(65 + i), text: opt };
          }
          return { key: opt.key || String.fromCharCode(65 + i), text: opt.text || opt.label || '' };
        })
      : [];

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={takingAssignment.title || 'Classroom Quiz'}
          subtitle={`Question ${assignmentIndex + 1} of ${totalQ}`}
          showBack
          onBack={() => {
            Alert.alert('Exit Assignment?', 'Your answers will be lost. Are you sure?', [
              { text: 'Keep Going', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: () => setTakingAssignment(null) },
            ]);
          }}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Question Box */}
          <View style={[styles.questionBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.questionPrompt, { color: theme.text }]}>{currentQ?.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = assignmentAnswers[assignmentIndex] === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    triggerHaptic('light');
                    setAssignmentAnswers((prev) => ({ ...prev, [assignmentIndex]: opt.key }));
                  }}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: isSelected ? `${theme.primary}18` : theme.card,
                      borderColor: isSelected ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <View style={[styles.optionKey, { backgroundColor: isSelected ? theme.primary : theme.cardHover }]}>
                    <Text style={{ color: isSelected ? '#FFF' : theme.textMuted, fontWeight: '700' }}>
                      {opt.key}
                    </Text>
                  </View>
                  <Text style={[styles.optionText, { color: isSelected ? theme.text : theme.textSecondary }]}>
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Nav Buttons */}
          <View style={styles.runnerNavRow}>
            <TouchableOpacity
              disabled={assignmentIndex === 0}
              onPress={() => setAssignmentIndex((i) => i - 1)}
              style={[styles.navBtn, { backgroundColor: theme.cardHover, opacity: assignmentIndex === 0 ? 0.4 : 1 }]}
            >
              <Text style={[styles.navBtnText, { color: theme.text }]}>← Previous</Text>
            </TouchableOpacity>

            {assignmentIndex < totalQ - 1 ? (
              <TouchableOpacity
                onPress={() => setAssignmentIndex((i) => i + 1)}
                style={[styles.navBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.navBtnText, { color: '#FFF' }]}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                disabled={submittingAssignment}
                onPress={handleSubmitAssignment}
                style={[styles.navBtn, { backgroundColor: theme.success }]}
              >
                {submittingAssignment ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.navBtnText, { color: '#FFF' }]}>Submit Quiz ✓</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Classroom Details View
  // ----------------------------------------------------
  if (selectedClass) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={selectedClass.name}
          subtitle={`${selectedClass.subject || 'General'} · Class ${selectedClass.classGrade || selectedClass.grade || '10'}`}
          showBack
          onBack={() => setSelectedClass(null)}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Teacher Info Card */}
          <View style={[styles.detailHeroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.detailHeroHeader}>
              <View>
                <Text style={[styles.detailHeroTitle, { color: theme.text }]}>{selectedClass.name}</Text>
                <Text style={[styles.detailTeacherName, { color: theme.primary }]}>
                  {selectedClass.teacher?.name || 'Educator'}
                </Text>
                {selectedClass.teacher?.institution && (
                  <Text style={[styles.detailInstName, { color: theme.textMuted }]}>
                    {selectedClass.teacher.institution}
                  </Text>
                )}
              </View>
              <View style={[styles.codeBadge, { backgroundColor: `${theme.primary}18` }]}>
                <Text style={[styles.codeBadgeText, { color: theme.primary }]}>{selectedClass.joinCode}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.chatLauncherBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                triggerHaptic('light');
                if (onOpenChat) onOpenChat(selectedClass);
              }}
            >
              <Text style={styles.chatLauncherBtnText}>💬 Enter Classroom Discussion</Text>
            </TouchableOpacity>
          </View>

          {/* Assignments */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Class Assignments</Text>

          {classAssignments.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No assignments assigned yet.</Text>
            </View>
          ) : (
            classAssignments.map((asg) => (
              <View
                key={asg.id}
                style={[styles.assignmentCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.assignmentInfo}>
                  <Text style={[styles.assignmentTitle, { color: theme.text }]}>{asg.title || 'Curriculum Test'}</Text>
                  <Text style={[styles.assignmentMeta, { color: theme.textMuted }]}>
                    Due: {asg.dueDate ? new Date(asg.dueDate).toLocaleDateString() : 'No Deadline'} • Passing: {asg.passingScore || 50}%
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleStartAssignment(asg)}
                  style={[styles.takeTestBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.takeTestBtnText}>Start Test</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Announcements */}
          <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 24 }]}>
            Teacher Announcements
          </Text>

          {classAnnouncements.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No announcements posted yet.</Text>
            </View>
          ) : (
            classAnnouncements.map((ann, i) => (
              <View
                key={ann.id || i}
                style={[styles.annCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <Text style={[styles.annTitle, { color: theme.text }]}>📢 {ann.title}</Text>
                <Text style={[styles.annContent, { color: theme.textSecondary }]}>{ann.content}</Text>
                <Text style={[styles.annDate, { color: theme.textMuted }]}>
                  {new Date(ann.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Classrooms List (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="My Classrooms"
        subtitle="Digital Learning Spaces"
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
            onRefresh={() => {
              triggerHaptic('light');
              setRefreshing(true);
              loadClassrooms();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : classrooms.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🏫</Text>
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Classrooms Joined</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Enter a 6-character code (e.g. CLS-93A87E) provided by your teacher to access assignments and classroom announcements.
            </Text>
            <TouchableOpacity
              style={[styles.enterCodeBtn, { backgroundColor: theme.primary }]}
              onPress={() => setJoinModalVisible(true)}
            >
              <Text style={styles.enterCodeBtnText}>Enter Join Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          classrooms.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              activeOpacity={0.7}
              onPress={() => handleSelectClass(cls)}
              style={[styles.classCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={styles.classRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.className, { color: theme.text }]}>{cls.name}</Text>
                  <Text style={[styles.classTeacher, { color: theme.textMuted }]}>
                    {cls.teacher?.name || 'Teacher'} · {cls.subject || 'General'}
                  </Text>
                </View>
                <View style={[styles.codePill, { backgroundColor: `${theme.primary}15` }]}>
                  <Text style={[styles.codeText, { color: theme.primary }]}>{cls.joinCode}</Text>
                </View>
              </View>
              <Text style={[styles.cardAction, { color: theme.primary }]}>View Classroom & Assignments →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal: Join Code */}
      <Modal visible={joinModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Join a Classroom</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Ask your teacher for the 6-character join code (e.g., CLS-93A87E).
            </Text>

            {error && <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>}

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="CLS-XXXXXX"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={setJoinCode}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => {
                  setJoinModalVisible(false);
                  setError(null);
                }}
                style={[styles.modalBtn, { backgroundColor: theme.cardHover }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={joining || !joinCode.trim()}
                onPress={handleJoinClassroom}
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: !joinCode.trim() ? 0.5 : 1 }]}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Join Class</Text>
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
    padding: 16,
    paddingBottom: 40,
  },
  joinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  classCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  classRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
  },
  classTeacher: {
    fontSize: 12,
    marginTop: 2,
  },
  codePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cardAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyHeadline: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  enterCodeBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  enterCodeBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Detail Styles
  detailHeroCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  detailHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailTeacherName: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  detailInstName: {
    fontSize: 12,
    marginTop: 1,
  },
  codeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  codeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  chatLauncherBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatLauncherBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  assignmentMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  takeTestBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  takeTestBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  annCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  annTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  annContent: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  annDate: {
    fontSize: 11,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Assignment Runner Styles
  questionBox: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  questionPrompt: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionKey: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
  },
  runnerNavRow: {
    flexDirection: 'row',
    gap: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
