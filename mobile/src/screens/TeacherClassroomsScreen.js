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
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function TeacherClassroomsScreen({ onBack }) {
  const { theme } = useTheme();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create classroom modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('10');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Selected classroom detail
  const [selectedClass, setSelectedClass] = useState(null);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Post announcement modal
  const [annModalVisible, setAnnModalVisible] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  const loadClassrooms = useCallback(async () => {
    try {
      const res = await apiClient.get('/teacher/classrooms');
      setClassrooms(res.data?.data?.classrooms || res.data?.data || []);
    } catch (err) {
      console.warn('[TeacherClassrooms] Error loading classrooms:', err.message);
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
      setLoadingDetail(true);

      const [detailRes, membersRes] = await Promise.allSettled([
        apiClient.get(`/classrooms/${cls.id}`),
        apiClient.get(`/classrooms/${cls.id}/members`),
      ]);

      if (detailRes.status === 'fulfilled') {
        const d = detailRes.value.data?.data?.classroom || detailRes.value.data?.data || cls;
        setSelectedClass(d);
        setAnnouncements(d.announcements || []);
      }

      if (membersRes.status === 'fulfilled') {
        setMembers(membersRes.value.data?.data?.members || []);
      }
    } catch (err) {
      console.warn('[TeacherClassrooms] Detail error:', err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Create Classroom
  const handleCreateClassroom = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Classroom name is required');
      triggerHaptic('warning');
      return;
    }

    try {
      setCreating(true);
      triggerHaptic('medium');
      await apiClient.post('/teacher/classrooms', {
        name: name.trim(),
        subject: subject.trim() || 'General Studies',
        classGrade: grade || '10',
        description: description.trim() || 'Official digital classroom',
      });

      triggerHaptic('success');
      setCreateModalVisible(false);
      setName('');
      setSubject('');
      setDescription('');
      Alert.alert('Classroom Created! 🏫', 'Your classroom is live with an active join code.');
      loadClassrooms();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create classroom');
      triggerHaptic('warning');
    } finally {
      setCreating(false);
    }
  };

  // Post Announcement (triggers instant push notification to students)
  const handlePostAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim() || !selectedClass) return;
    try {
      triggerHaptic('medium');
      setPostingAnn(true);
      await apiClient.post(`/teacher/classrooms/${selectedClass.id}/announcements`, {
        title: annTitle.trim(),
        content: annContent.trim(),
      });

      triggerHaptic('success');
      setAnnModalVisible(false);
      setAnnTitle('');
      setAnnContent('');
      Alert.alert(
        'Announcement Published! 📢',
        'Push notifications have been dispatched to all enrolled students.'
      );
      handleSelectClass(selectedClass);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not post announcement.');
    } finally {
      setPostingAnn(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Teacher Classroom Detail View
  // ----------------------------------------------------
  if (selectedClass) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={selectedClass.name}
          subtitle={`Grade ${selectedClass.classGrade || selectedClass.grade || '10'} · ${selectedClass.subject}`}
          showBack
          onBack={() => setSelectedClass(null)}
          rightElement={
            <TouchableOpacity
              onPress={() => setAnnModalVisible(true)}
              style={[styles.postAnnHeaderBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.postAnnHeaderBtnText}>+ Announce</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Join Code Hero Card */}
          <View style={[styles.joinCodeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.joinCodeLabel, { color: theme.textMuted }]}>STUDENT JOIN CODE</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic('success');
                Alert.alert('Share Join Code', `Give this code to your students: ${selectedClass.joinCode}`);
              }}
              style={[styles.joinCodeBadge, { backgroundColor: `${theme.primary}18`, borderColor: theme.primary }]}
            >
              <Text style={[styles.joinCodeText, { color: theme.primary }]}>{selectedClass.joinCode}</Text>
              <Text style={{ fontSize: 16, marginLeft: 8 }}>📋</Text>
            </TouchableOpacity>
            <Text style={[styles.joinCodeHint, { color: theme.textMuted }]}>
              Tap to share code with your class via WhatsApp or SMS.
            </Text>
          </View>

          {/* Announcements Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              Class Announcements ({announcements.length})
            </Text>
            <TouchableOpacity onPress={() => setAnnModalVisible(true)}>
              <Text style={[styles.actionLink, { color: theme.primary }]}>Post New 📢</Text>
            </TouchableOpacity>
          </View>

          {announcements.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No announcements yet. Post updates, reminders, or exam syllabus.
              </Text>
            </View>
          ) : (
            announcements.map((ann, idx) => (
              <View
                key={ann.id || idx}
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

          {/* Student Roster */}
          <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 24 }]}>
            Enrolled Students ({members.length})
          </Text>

          {loadingDetail ? (
            <ActivityIndicator color={theme.primary} />
          ) : members.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No students enrolled yet. Share the join code {selectedClass.joinCode} with your class.
              </Text>
            </View>
          ) : (
            <View style={[styles.rosterCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              {members.map((mem, i) => (
                <View key={mem.id || i} style={styles.rosterRow}>
                  <View style={[styles.rosterAvatar, { backgroundColor: `${theme.primary}20` }]}>
                    <Text style={[styles.rosterAvatarText, { color: theme.primary }]}>
                      {(mem.user?.name || mem.name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rosterName, { color: theme.text }]}>{mem.user?.name || mem.name}</Text>
                    <Text style={[styles.rosterEmail, { color: theme.textMuted }]}>
                      {mem.user?.email || mem.email || 'Enrolled Student'}
                    </Text>
                  </View>
                  <Text style={[styles.rosterDate, { color: theme.textMuted }]}>
                    {mem.joinedAt ? new Date(mem.joinedAt).toLocaleDateString() : 'Active'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Modal: Post Announcement */}
        <Modal visible={annModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Post Classroom Announcement</Text>
              <Text style={[styles.modalSub, { color: theme.textMuted }]}>
                Enrolled students will receive an instant push notification on their device.
              </Text>

              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
                placeholder="Announcement Title (e.g. Mid-term Board Mock)"
                placeholderTextColor={theme.textMuted}
                value={annTitle}
                onChangeText={setAnnTitle}
              />

              <TextInput
                style={[
                  styles.modalInput,
                  { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder, height: 90 },
                ]}
                placeholder="Write message to students..."
                placeholderTextColor={theme.textMuted}
                multiline
                value={annContent}
                onChangeText={setAnnContent}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  onPress={() => setAnnModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: theme.cardHover }]}
                >
                  <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={postingAnn || !annTitle.trim() || !annContent.trim()}
                  onPress={handlePostAnnouncement}
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: theme.primary,
                      opacity: !annTitle.trim() || !annContent.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  {postingAnn ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Publish & Push</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Teacher Classrooms List (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Classroom Manager"
        subtitle="Manage Classes & Student Rosters"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              triggerHaptic('light');
              setCreateModalVisible(true);
            }}
          >
            <Text style={styles.createBtnText}>+ New Class</Text>
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
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Classrooms Created</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Create your first classroom to generate unique join codes, assign practice quizzes, and post announcements.
            </Text>
            <TouchableOpacity
              style={[styles.createFirstBtn, { backgroundColor: theme.primary }]}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={styles.createFirstBtnText}>Create Classroom</Text>
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
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.className, { color: theme.text }]}>{cls.name}</Text>
                  <Text style={[styles.classDetail, { color: theme.textMuted }]}>
                    {cls.subject} · Grade {cls.classGrade || cls.grade || '10'} · {cls._count?.memberships || cls.memberCount || 0} Students
                  </Text>
                </View>
                <View style={[styles.codeBadge, { backgroundColor: `${theme.primary}18` }]}>
                  <Text style={[styles.codeText, { color: theme.primary }]}>{cls.joinCode}</Text>
                </View>
              </View>
              <Text style={[styles.cardAction, { color: theme.primary }]}>Manage Classroom & Roster →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal: Create Classroom */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create Digital Classroom</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Generates an instant 6-10 character join code for student enrollment.
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Classroom Name (e.g. Matric Physics Alpha)"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Subject (e.g. Physics, Biology, Math)"
              placeholderTextColor={theme.textMuted}
              value={subject}
              onChangeText={setSubject}
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Class Grade (e.g. 9, 10, 11, 12, MDCAT)"
              placeholderTextColor={theme.textMuted}
              value={grade}
              onChangeText={setGrade}
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Description (Optional)"
              placeholderTextColor={theme.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.cardHover }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={creating || !name.trim()}
                onPress={handleCreateClassroom}
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: !name.trim() ? 0.5 : 1 }]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Create</Text>
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
  createBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  postAnnHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  postAnnHeaderBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  classCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
  },
  classDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  codeBadge: {
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
  createFirstBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createFirstBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Detail Styles
  joinCodeCard: {
    alignItems: 'center',
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  joinCodeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  joinCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  joinCodeText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  joinCodeHint: {
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  annCard: {
    padding: 14,
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
  rosterCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rosterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rosterAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rosterEmail: {
    fontSize: 11,
  },
  rosterDate: {
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
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 12,
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
});
