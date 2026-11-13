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

export default function TeacherClassroomsScreen() {
  const { theme } = useTheme();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('10');
  const [creating, setCreating] = useState(false);

  const loadClassrooms = useCallback(async () => {
    try {
      const res = await apiClient.get('/teacher/classrooms');
      setClassrooms(res.data?.data?.classrooms || []);
    } catch {
      setClassrooms([
        {
          id: 't-cls-1',
          name: 'Class 10 Physics Alpha',
          subject: 'Physics',
          grade: '10',
          joinCode: 'CLS-93A87E',
          _count: { memberships: 24 },
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

  const handleCreateClassroom = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Classroom name is required');
      triggerHaptic('error');
      return;
    }

    try {
      setCreating(true);
      triggerHaptic('medium');
      await apiClient.post('/teacher/classrooms', {
        name: name.trim(),
        subject: subject.trim() || 'General',
        grade: grade || '10',
      });
      triggerHaptic('success');
      setModalVisible(false);
      setName('');
      setSubject('');
      loadClassrooms();
    } catch (err) {
      Alert.alert('Notice', err.response?.data?.message || 'Failed to create classroom');
      triggerHaptic('error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Classroom Manager"
        subtitle="Manage Digital Classes & Join Codes"
        rightElement={
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              triggerHaptic('light');
              setModalVisible(true);
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
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : classrooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏫</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Classes Yet</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              Create your first classroom to generate join codes for students.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.emptyBtnText}>Create Classroom</Text>
            </TouchableOpacity>
          </View>
        ) : (
          classrooms.map((cls) => (
            <View
              key={cls.id}
              style={[
                styles.classCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.className, { color: theme.text }]}>{cls.name}</Text>
                  <Text style={[styles.classDetail, { color: theme.textMuted }]}>
                    {cls.subject} · Grade {cls.grade} · {cls._count?.memberships || 0} Students
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.codeBadge, { backgroundColor: `${theme.primary}15` }]}
                  onPress={() => {
                    triggerHaptic('success');
                    Alert.alert('Join Code', `Share this code with your students: ${cls.joinCode}`);
                  }}
                >
                  <Text style={[styles.codeText, { color: theme.primary }]}>
                    {cls.joinCode} 📋
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Create Digital Classroom
            </Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Generates an instant 6-10 character join code for student enrollment.
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Classroom Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder="e.g. Sp23-BcsC FYP Prep"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Subject</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder="Physics / Biology / Computer Science"
              placeholderTextColor={theme.textMuted}
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Grade / Level</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder="9, 10, 11, 12, or University"
              placeholderTextColor={theme.textMuted}
              value={grade}
              onChangeText={setGrade}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.cardBorder }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleCreateClassroom}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Class</Text>
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
  createBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createBtnText: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  className: {
    fontSize: 15,
    fontWeight: '700',
  },
  classDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  codeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
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
  emptySub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
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
  modalSub: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
