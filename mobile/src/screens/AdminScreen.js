import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';
import { normalizeQuestion } from '../utils/quizUtils';
import {
  ShieldIcon,
  ArrowLeftIcon,
  LayersIcon,
  GraduationCapIcon,
  UsersIcon,
  DocumentIcon,
  ChatIcon,
  TestsIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  SearchIcon,
} from '../components/Icons';

export default function AdminScreen({ onBack }) {
  const { theme } = useTheme();

  // Active section tab: 'OVERVIEW' | 'EDUCATORS' | 'USERS' | 'MATERIALS' | 'CHATS' | 'QUESTIONS' | 'PACKS'
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  // Loading & Refreshing states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [chatsAudit, setChatsAudit] = useState({ directChats: [], recentGroupMessages: [] });
  const [questions, setQuestions] = useState([]);
  const [packs, setPacks] = useState([]);

  // Search & Filter states
  const [userSearch, setUserSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionStatusFilter, setQuestionStatusFilter] = useState('');

  // Modals & Forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', maxUses: '1', expiresInDays: '14' });
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [showPackModal, setShowPackModal] = useState(false);
  const [packForm, setPackForm] = useState({
    title: '',
    description: '',
    classGrade: '9',
    subjectName: 'Physics',
    boardName: 'Punjab Textbook Board',
  });
  const [creatingPack, setCreatingPack] = useState(false);

  // ----------------------------------------------------
  // Load Admin Data based on current tab
  // ----------------------------------------------------
  const loadAdminData = useCallback(async () => {
    try {
      if (activeTab === 'OVERVIEW') {
        const res = await apiClient.get('/admin/stats');
        setStats(res.data?.data || null);
      } else if (activeTab === 'EDUCATORS') {
        const [teachRes, invRes] = await Promise.allSettled([
          apiClient.get('/admin/teachers'),
          apiClient.get('/admin/teacher-invites'),
        ]);
        if (teachRes.status === 'fulfilled') {
          setTeachers(teachRes.value.data?.data?.teachers || []);
        }
        if (invRes.status === 'fulfilled') {
          setInvites(invRes.value.data?.data?.invites || []);
        }
      } else if (activeTab === 'USERS') {
        const res = await apiClient.get('/admin/users');
        setUsersList(res.data?.data?.users || []);
      } else if (activeTab === 'MATERIALS') {
        const res = await apiClient.get('/admin/materials');
        setMaterials(res.data?.data?.materials || []);
      } else if (activeTab === 'CHATS') {
        const res = await apiClient.get('/admin/chats-audit');
        setChatsAudit(res.data?.data || { directChats: [], recentGroupMessages: [] });
      } else if (activeTab === 'QUESTIONS') {
        const params = {};
        if (questionSearch.trim()) params.search = questionSearch.trim();
        if (questionStatusFilter) params.status = questionStatusFilter;
        const res = await apiClient.get('/admin/questions', { params });
        setQuestions(res.data?.data?.questions || res.data?.data || []);
      } else if (activeTab === 'PACKS') {
        const res = await apiClient.get('/question-packs');
        setPacks(res.data?.data?.packs || res.data?.data || []);
      }
    } catch (err) {
      console.warn('[Admin] Data fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, questionSearch, questionStatusFilter]);

  useEffect(() => {
    setLoading(true);
    loadAdminData();
  }, [loadAdminData]);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadAdminData();
  };

  // ----------------------------------------------------
  // Actions: Teacher Approval / Rejection
  // ----------------------------------------------------
  const handleApproveTeacher = async (teacherId) => {
    try {
      triggerHaptic('medium');
      await apiClient.patch(`/admin/teachers/${teacherId}/approve`);
      Alert.alert('Success', 'Educator account approved successfully.');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Approval failed.');
    }
  };

  const handleRejectTeacher = async (teacherId, isRevoke = false) => {
    try {
      triggerHaptic('warning');
      await apiClient.patch(`/admin/teachers/${teacherId}/reject`);
      Alert.alert('Success', isRevoke ? 'Educator status revoked.' : 'Educator request rejected.');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Action failed.');
    }
  };

  // ----------------------------------------------------
  // Actions: Educator Invite Codes
  // ----------------------------------------------------
  const handleCreateInviteCode = async () => {
    try {
      triggerHaptic('medium');
      setCreatingInvite(true);
      await apiClient.post('/admin/teacher-invites', {
        email: inviteForm.email.trim() || undefined,
        maxUses: parseInt(inviteForm.maxUses, 10) || 1,
        expiresInDays: parseInt(inviteForm.expiresInDays, 10) || 14,
      });
      setShowInviteModal(false);
      setInviteForm({ email: '', maxUses: '1', expiresInDays: '14' });
      Alert.alert('Success', 'New educator invite code generated.');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not generate invite code.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      triggerHaptic('warning');
      await apiClient.patch(`/admin/teacher-invites/${inviteId}/revoke`);
      Alert.alert('Success', 'Invite code revoked.');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Revocation failed.');
    }
  };

  // ----------------------------------------------------
  // Actions: User Management
  // ----------------------------------------------------
  const handleDeactivateUser = (userId, userName) => {
    Alert.alert(
      'Deactivate User',
      `Are you sure you want to suspend/deactivate ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error');
              await apiClient.patch(`/admin/users/${userId}/deactivate`);
              Alert.alert('Notice', 'User account deactivated.');
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to deactivate user.');
            }
          },
        },
      ]
    );
  };

  // ----------------------------------------------------
  // Actions: Materials Audit
  // ----------------------------------------------------
  const handleDeleteMaterial = (materialId, title) => {
    Alert.alert(
      'Delete Material',
      `Permanently remove "${title}" from the platform?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error');
              await apiClient.delete(`/admin/materials/${materialId}`);
              Alert.alert('Success', 'Material deleted.');
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete material.');
            }
          },
        },
      ]
    );
  };

  // ----------------------------------------------------
  // Actions: Question Bank
  // ----------------------------------------------------
  const handleUpdateQuestionStatus = async (questionId, newStatus) => {
    try {
      triggerHaptic('medium');
      await apiClient.patch(`/admin/questions/${questionId}/status`, { status: newStatus });
      Alert.alert('Success', `Question marked as ${newStatus}.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Status update failed.');
    }
  };

  const handleDeleteQuestion = (questionId) => {
    Alert.alert(
      'Delete Canonical Question',
      'Permanently delete this question from the official Question Bank?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error');
              await apiClient.delete(`/admin/questions/${questionId}`);
              Alert.alert('Success', 'Question deleted.');
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete question.');
            }
          },
        },
      ]
    );
  };

  // ----------------------------------------------------
  // Actions: Question Packs
  // ----------------------------------------------------
  const handleCreatePack = async () => {
    if (!packForm.title.trim()) {
      Alert.alert('Notice', 'Please provide a pack title.');
      return;
    }
    try {
      triggerHaptic('medium');
      setCreatingPack(true);
      await apiClient.post('/question-packs', {
        title: packForm.title.trim(),
        description: packForm.description.trim() || 'Curriculum verified exam question pack.',
        classGrade: packForm.classGrade,
        subjectName: packForm.subjectName,
        boardName: packForm.boardName,
      });
      setShowPackModal(false);
      setPackForm({
        title: '',
        description: '',
        classGrade: '9',
        subjectName: 'Physics',
        boardName: 'Punjab Textbook Board',
      });
      Alert.alert('Success', 'Official curriculum pack published!');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create pack.');
    } finally {
      setCreatingPack(false);
    }
  };

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  });

  const pendingTeachersCount = teachers.filter((t) => t.teacherStatus === 'PENDING').length;

  const adminTabs = [
    { key: 'OVERVIEW', label: 'Overview', IconComp: LayersIcon },
    {
      key: 'EDUCATORS',
      label: pendingTeachersCount > 0 ? `Educators (${pendingTeachersCount})` : 'Educators',
      IconComp: GraduationCapIcon,
    },
    { key: 'USERS', label: 'Users', IconComp: UsersIcon },
    { key: 'MATERIALS', label: 'Materials', IconComp: DocumentIcon },
    { key: 'CHATS', label: 'Chats Audit', IconComp: ChatIcon },
    { key: 'QUESTIONS', label: 'Question Bank', IconComp: TestsIcon },
    { key: 'PACKS', label: 'Question Packs', IconComp: PlusIcon },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Header */}
      <View style={[styles.topHeader, { backgroundColor: theme.waHeaderBg, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('light');
            onBack?.();
          }}
          style={styles.headerBackBtn}
        >
          <ArrowLeftIcon size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <View style={styles.badgeRow}>
            <View style={styles.adminBadge}>
              <ShieldIcon size={12} color="#F43F5E" />
              <Text style={styles.adminBadgeText}>ADMIN PORTAL</Text>
            </View>
            <Text style={styles.headerRoleTag}>Production Control</Text>
          </View>
          <Text style={styles.headerMainTitle}>System Administration</Text>
        </View>
      </View>

      {/* Horizontal Navigation Tabs */}
      <View style={[styles.tabBarContainer, { backgroundColor: theme.waHeaderBg, borderBottomColor: theme.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          {adminTabs.map(({ key, label, IconComp }) => {
            const isActive = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('selection');
                  setActiveTab(key);
                }}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <IconComp size={15} color={isActive ? '#3B82F6' : theme.textMuted} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Body Content */}
      <ScrollView
        contentContainerStyle={styles.scrollBody}
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
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#F43F5E" />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading administrative records…</Text>
          </View>
        ) : (
          <>
            {/* ==================================================== */}
            {/* TAB 1: OVERVIEW & PLATFORM METRICS */}
            {/* ==================================================== */}
            {activeTab === 'OVERVIEW' && (
              <View style={styles.tabSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Platform Metrics</Text>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Real-time activity across Studify Neon database & live services.
                </Text>

                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>STUDENTS</Text>
                    <Text style={[styles.metricValue, { color: '#3B82F6' }]}>{stats?.users || 0}</Text>
                    <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Registered Scholars</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>CANONICAL MCQS</Text>
                    <Text style={[styles.metricValue, { color: '#10B981' }]}>{stats?.bankQuestions || 0}</Text>
                    <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Verified Bank</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>TESTS COMPLETED</Text>
                    <Text style={[styles.metricValue, { color: '#8B5CF6' }]}>{stats?.testAttempts || 0}</Text>
                    <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Standard Mocks</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>STUDY CIRCLES</Text>
                    <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{stats?.groups || 0}</Text>
                    <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Active Groups</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>MATERIALS</Text>
                    <Text style={[styles.metricValue, { color: '#EC4899' }]}>{stats?.materials || 0}</Text>
                    <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Uploaded Notes</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>DIRECT CHATS</Text>
                    <Text style={[styles.metricValue, { color: '#00A884' }]}>{stats?.directChats || 0}</Text>
                    <Text style={[styles.metricSub, { color: theme.textSecondary }]}>1-on-1 Threads</Text>
                  </View>
                </View>

                {/* Quick Navigation Cards */}
                <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Quick Management</Text>
                <View style={styles.quickJumpList}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab('EDUCATORS')}
                    style={[styles.jumpCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  >
                    <View style={[styles.jumpIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                      <GraduationCapIcon size={20} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jumpTitle, { color: theme.text }]}>Educator Verification</Text>
                      <Text style={[styles.jumpSub, { color: theme.textMuted }]}>
                        {pendingTeachersCount} pending teacher applications & invite codes
                      </Text>
                    </View>
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Review →</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab('QUESTIONS')}
                    style={[styles.jumpCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  >
                    <View style={[styles.jumpIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                      <TestsIcon size={20} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jumpTitle, { color: theme.text }]}>Canonical MCQ Bank</Text>
                      <Text style={[styles.jumpSub, { color: theme.textMuted }]}>
                        Approve, edit, or reject official curriculum questions
                      </Text>
                    </View>
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Manage →</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab('MATERIALS')}
                    style={[styles.jumpCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  >
                    <View style={[styles.jumpIconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                      <DocumentIcon size={20} color="#EC4899" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jumpTitle, { color: theme.text }]}>Materials Audit</Text>
                      <Text style={[styles.jumpSub, { color: theme.textMuted }]}>
                        Inspect uploaded PDFs and remove policy-violating files
                      </Text>
                    </View>
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Audit →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ==================================================== */}
            {/* TAB 2: EDUCATORS (TEACHER APPROVALS & INVITE CODES) */}
            {/* ==================================================== */}
            {activeTab === 'EDUCATORS' && (
              <View style={styles.tabSection}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Educator Verification ({teachers.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowInviteModal(true)}
                    style={[styles.pillBtnPrimary, { backgroundColor: theme.primary }]}
                  >
                    <PlusIcon size={14} color="#FFFFFF" />
                    <Text style={styles.pillBtnText}>Invite Code</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Approve or revoke teacher privileges for classroom creation and note-to-quiz generation.
                </Text>

                {teachers.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No teacher applications found.</Text>
                  </View>
                ) : (
                  teachers.map((t) => {
                    const isPending = t.teacherStatus === 'PENDING';
                    const isApproved = t.teacherStatus === 'APPROVED';
                    return (
                      <View
                        key={t.id}
                        style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                      >
                        <View style={styles.itemHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemNameText, { color: theme.text }]}>{t.name}</Text>
                            <Text style={[styles.itemSubText, { color: theme.textMuted }]}>
                              {t.username ? `@${t.username} • ` : ''}{t.email}
                            </Text>
                            <Text style={[styles.institutionText, { color: theme.textSecondary }]}>
                              🏫 {t.institution || 'Institutional Educator'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              isApproved
                                ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }
                                : isPending
                                ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.35)' }
                                : { backgroundColor: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.35)' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                isApproved
                                  ? { color: '#10B981' }
                                  : isPending
                                  ? { color: '#F59E0B' }
                                  : { color: '#F43F5E' },
                              ]}
                            >
                              {t.teacherStatus || 'PENDING'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.actionBtnRow}>
                          {!isApproved && (
                            <TouchableOpacity
                              onPress={() => handleApproveTeacher(t.id)}
                              style={[styles.actionBtnSuccess, { backgroundColor: '#10B981' }]}
                            >
                              <CheckIcon size={14} color="#FFFFFF" />
                              <Text style={styles.actionBtnSuccessText}>Approve</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleRejectTeacher(t.id, isApproved)}
                            style={[styles.actionBtnDestructive, { borderColor: theme.cardBorder }]}
                          >
                            <Text style={styles.actionBtnDestructiveText}>
                              {isApproved ? 'Revoke Access' : 'Reject'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}

                {/* Educator Invite Codes */}
                <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>
                  Active Invite Codes ({invites.length})
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Share these codes with teachers for instant automated workspace verification.
                </Text>

                {invites.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No invite codes generated yet.</Text>
                  </View>
                ) : (
                  invites.map((inv) => (
                    <View
                      key={inv.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <View style={styles.itemHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.codeRow}>
                            <Text style={styles.codeText}>{inv.code}</Text>
                            <Text style={[styles.usesBadge, { color: theme.textMuted }]}>
                              Uses: {inv.usedCount}/{inv.maxUses}
                            </Text>
                          </View>
                          <Text style={[styles.itemSubText, { color: theme.textMuted, marginTop: 4 }]}>
                            {inv.email ? `Restricted to: ${inv.email}` : 'Valid for any faculty email'}
                          </Text>
                          {inv.expiresAt && (
                            <Text style={[styles.itemSubText, { color: theme.textMuted }]}>
                              Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>

                        {!inv.isRevoked && (
                          <TouchableOpacity
                            onPress={() => handleRevokeInvite(inv.id)}
                            style={styles.revokeBtn}
                          >
                            <Text style={styles.revokeBtnText}>Revoke</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ==================================================== */}
            {/* TAB 3: USERS DIRECTORY & DEACTIVATION */}
            {/* ==================================================== */}
            {activeTab === 'USERS' && (
              <View style={styles.tabSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Platform Users Directory ({usersList.length})
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Manage student profiles, roles, and platform access.
                </Text>

                {/* Search Bar */}
                <View style={[styles.searchBox, { backgroundColor: theme.cardHover, borderColor: theme.cardBorder }]}>
                  <SearchIcon size={16} color={theme.textMuted} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search by name, handle (@username), or email..."
                    placeholderTextColor={theme.textMuted}
                    value={userSearch}
                    onChangeText={setUserSearch}
                  />
                  {userSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setUserSearch('')}>
                      <Text style={{ color: theme.textMuted }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {filteredUsers.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No matching users found.</Text>
                  </View>
                ) : (
                  filteredUsers.map((u) => (
                    <View
                      key={u.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <View style={styles.itemHeaderRow}>
                        <View style={[styles.userAvatarBox, { backgroundColor: `${theme.primary}25` }]}>
                          <Text style={[styles.userAvatarInitial, { color: theme.primary }]}>
                            {(u.username || u.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.itemNameText, { color: theme.text }]}>
                              {u.username ? `@${u.username}` : u.name}
                            </Text>
                            <View
                              style={[
                                styles.roleBadge,
                                u.role === 'ADMIN'
                                  ? { backgroundColor: 'rgba(244, 63, 94, 0.2)', borderColor: 'rgba(244, 63, 94, 0.4)' }
                                  : u.role === 'TEACHER'
                                  ? { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: 'rgba(99, 102, 241, 0.4)' }
                                  : { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.roleBadgeText,
                                  u.role === 'ADMIN' ? { color: '#F43F5E' } : u.role === 'TEACHER' ? { color: '#6366F1' } : { color: '#3B82F6' },
                                ]}
                              >
                                {u.role}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.itemSubText, { color: theme.textMuted }]}>
                            {u.name} • {u.email}
                          </Text>
                          <Text style={[styles.itemMetaText, { color: theme.textSecondary }]}>
                            {u.grade ? `Class ${u.grade}` : 'Standard Grade'} • {u.board || 'Punjab Board'} • {u.points || 0} XP
                          </Text>
                        </View>
                      </View>

                      {u.isActive && u.role !== 'ADMIN' && (
                        <TouchableOpacity
                          onPress={() => handleDeactivateUser(u.id, u.name)}
                          style={[styles.deactivateBtn, { borderColor: theme.cardBorder }]}
                        >
                          <Text style={styles.deactivateBtnText}>Deactivate User</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ==================================================== */}
            {/* TAB 4: MATERIALS AUDIT */}
            {/* ==================================================== */}
            {activeTab === 'MATERIALS' && (
              <View style={styles.tabSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Uploaded Notes & Materials Audit ({materials.length})
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Inspect student and teacher uploaded documents and purge offending content.
                </Text>

                {materials.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No materials uploaded yet.</Text>
                  </View>
                ) : (
                  materials.map((m) => (
                    <View
                      key={m.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <View style={styles.itemHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemNameText, { color: theme.text }]}>{m.title}</Text>
                          <Text style={[styles.itemSubText, { color: theme.textMuted }]}>
                            Uploaded by {m.user?.name || 'Scholar'} ({m.user?.email || 'N/A'}) •{' '}
                            {new Date(m.createdAt).toLocaleDateString()}
                          </Text>
                          {m.extractedText && (
                            <Text numberOfLines={2} style={[styles.previewSnippet, { color: theme.textSecondary }]}>
                              {m.extractedText.slice(0, 150)}…
                            </Text>
                          )}
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteMaterial(m.id, m.title)}
                          style={styles.deleteCircleBtn}
                        >
                          <TrashIcon size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ==================================================== */}
            {/* TAB 5: CHAT SAFETY & MODERATION AUDIT */}
            {/* ==================================================== */}
            {activeTab === 'CHATS' && (
              <View style={styles.tabSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Chat Safety & Moderation Audit
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Review recent 1-on-1 direct conversations and public study circle communications.
                </Text>

                <Text style={[styles.subsectionTitle, { color: theme.text }]}>1-on-1 Direct Chat Channels</Text>
                {chatsAudit.directChats?.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No active direct chat channels.</Text>
                  </View>
                ) : (
                  chatsAudit.directChats.map((c) => (
                    <View
                      key={c.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={[styles.itemNameText, { color: theme.text }]}>
                          {c.user1?.name} & {c.user2?.name}
                        </Text>
                        <Text style={[styles.chatCountText, { color: theme.textMuted }]}>
                          {c._count?.messages || 0} messages
                        </Text>
                      </View>

                      {c.messages && c.messages.length > 0 && (
                        <View style={[styles.chatSnippetBox, { backgroundColor: theme.cardHover }]}>
                          {c.messages.slice(0, 2).map((msg) => (
                            <Text key={msg.id} numberOfLines={1} style={[styles.chatSnippetText, { color: theme.textSecondary }]}>
                              <Text style={{ fontWeight: '700', color: theme.text }}>{msg.sender?.name}: </Text>
                              {msg.content}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}

                <Text style={[styles.subsectionTitle, { color: theme.text, marginTop: 24 }]}>
                  Recent Study Group Messages
                </Text>
                {chatsAudit.recentGroupMessages?.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No recent group messages.</Text>
                  </View>
                ) : (
                  chatsAudit.recentGroupMessages.slice(0, 15).map((gm) => (
                    <View
                      key={gm.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={{ fontWeight: '700', color: theme.primary, fontSize: 13 }}>
                          {gm.sender?.name || 'Scholar'}{' '}
                          <Text style={{ fontWeight: '400', color: theme.textMuted }}>in [{gm.group?.name || 'Group'}]</Text>
                        </Text>
                        <Text style={{ fontSize: 10, color: theme.textMuted }}>
                          {new Date(gm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={[styles.groupMsgContent, { color: theme.text }]}>{gm.content}</Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ==================================================== */}
            {/* TAB 6: CANONICAL QUESTION BANK */}
            {/* ==================================================== */}
            {activeTab === 'QUESTIONS' && (
              <View style={styles.tabSection}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Canonical Question Bank Management ({questions.length})
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Curate official MCQs verified against FBISE & Punjab textbook curricula.
                </Text>

                {/* Filter & Search Bar */}
                <View style={[styles.searchBox, { backgroundColor: theme.cardHover, borderColor: theme.cardBorder }]}>
                  <SearchIcon size={16} color={theme.textMuted} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search question text or keyword..."
                    placeholderTextColor={theme.textMuted}
                    value={questionSearch}
                    onChangeText={setQuestionSearch}
                  />
                </View>

                {/* Status Filter Chips */}
                <View style={styles.chipRow}>
                  {['', 'APPROVED', 'DRAFT', 'REJECTED'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => {
                        triggerHaptic('selection');
                        setQuestionStatusFilter(st);
                      }}
                      style={[
                        styles.filterChip,
                        questionStatusFilter === st && styles.filterChipActive,
                      ]}
                    >
                      <Text style={[styles.filterChipText, questionStatusFilter === st && styles.filterChipTextActive]}>
                        {st ? st : 'ALL'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {questions.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No questions matching criteria.</Text>
                  </View>
                ) : (
                  questions.map((q) => (
                    <View
                      key={q.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <View style={styles.rowBetween}>
                        <View style={styles.badgeRow}>
                          <Text style={[styles.gradeTag, { color: theme.primary }]}>
                            Class {q.classGrade || '9'}
                          </Text>
                          <Text style={[styles.difficultyTag, { color: theme.accentGold }]}>
                            {q.difficulty || 'MEDIUM'}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            q.status === 'APPROVED'
                              ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }
                              : q.status === 'REJECTED'
                              ? { backgroundColor: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.35)' }
                              : { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.35)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              q.status === 'APPROVED' ? { color: '#10B981' } : q.status === 'REJECTED' ? { color: '#F43F5E' } : { color: '#F59E0B' },
                            ]}
                          >
                            {q.status || 'DRAFT'}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.questionText, { color: theme.text }]}>
                        {q.questionText || q.question}
                      </Text>

                      {/* Options */}
                      {(() => {
                        const norm = normalizeQuestion(q);
                        const correctVal = (q.correctAnswer || q.correctOption || '').toUpperCase();
                        if (!norm?.options?.length) return null;
                        return (
                          <View style={styles.optionsBox}>
                            {norm.options.map((opt) => {
                              const isCorrect = opt.key.toUpperCase() === correctVal;
                              return (
                                <View
                                  key={opt.key}
                                  style={[
                                    styles.optionRow,
                                    isCorrect && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },
                                  ]}
                                >
                                  <Text style={[styles.optionKey, isCorrect && { color: '#10B981', fontWeight: '800' }]}>
                                    {opt.key}:
                                  </Text>
                                  <Text style={[styles.optionVal, { color: isCorrect ? '#10B981' : theme.textSecondary }]}>
                                    {opt.text}
                                  </Text>
                                  {isCorrect && <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700' }}>✓ Correct</Text>}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })()}

                      {/* Action buttons */}
                      <View style={styles.actionBtnRow}>
                        {q.status !== 'APPROVED' && (
                          <TouchableOpacity
                            onPress={() => handleUpdateQuestionStatus(q.id, 'APPROVED')}
                            style={[styles.actionBtnSuccess, { backgroundColor: '#10B981' }]}
                          >
                            <Text style={styles.actionBtnSuccessText}>Approve</Text>
                          </TouchableOpacity>
                        )}
                        {q.status !== 'REJECTED' && (
                          <TouchableOpacity
                            onPress={() => handleUpdateQuestionStatus(q.id, 'REJECTED')}
                            style={[styles.actionBtnDestructive, { borderColor: theme.cardBorder }]}
                          >
                            <Text style={styles.actionBtnDestructiveText}>Reject</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteQuestion(q.id)}
                          style={[styles.actionBtnDestructive, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                        >
                          <TrashIcon size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ==================================================== */}
            {/* TAB 7: QUESTION PACKS */}
            {/* ==================================================== */}
            {activeTab === 'PACKS' && (
              <View style={styles.tabSection}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Question Packs ({packs.length})</Text>
                  <TouchableOpacity
                    onPress={() => setShowPackModal(true)}
                    style={[styles.pillBtnPrimary, { backgroundColor: theme.primary }]}
                  >
                    <PlusIcon size={14} color="#FFFFFF" />
                    <Text style={styles.pillBtnText}>New Pack</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Curate syllabus-aligned collections of canonical MCQs for offline review.
                </Text>

                {packs.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No question packs published yet.</Text>
                  </View>
                ) : (
                  packs.map((p) => (
                    <View
                      key={p.id}
                      style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                    >
                      <Text style={[styles.itemNameText, { color: theme.text }]}>{p.title}</Text>
                      <Text style={[styles.itemSubText, { color: theme.textMuted, marginTop: 4 }]}>
                        {p.description}
                      </Text>
                      <View style={[styles.badgeRow, { marginTop: 8 }]}>
                        <Text style={[styles.gradeTag, { color: theme.primary }]}>Class {p.classGrade}</Text>
                        <Text style={[styles.difficultyTag, { color: theme.accentGold }]}>{p.subjectName}</Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{p.boardName}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ==================================================== */}
      {/* MODAL: Generate Educator Invite Code */}
      {/* ==================================================== */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Generate Invite Code</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Create an educator registration code with usage and expiration limits.
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Restrict to Email (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="faculty@school.edu"
              placeholderTextColor={theme.textMuted}
              value={inviteForm.email}
              onChangeText={(t) => setInviteForm({ ...inviteForm, email: t })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Max Uses</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="1"
              placeholderTextColor={theme.textMuted}
              value={inviteForm.maxUses}
              onChangeText={(t) => setInviteForm({ ...inviteForm, maxUses: t })}
              keyboardType="numeric"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Expires In (Days)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="14"
              placeholderTextColor={theme.textMuted}
              value={inviteForm.expiresInDays}
              onChangeText={(t) => setInviteForm({ ...inviteForm, expiresInDays: t })}
              keyboardType="numeric"
            />

            <TouchableOpacity
              disabled={creatingInvite}
              onPress={handleCreateInviteCode}
              style={[styles.modalActionBtn, { backgroundColor: '#10B981' }]}
            >
              {creatingInvite ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalActionBtnText}>Generate Code</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: Create Question Pack */}
      {/* ==================================================== */}
      <Modal visible={showPackModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>New Question Pack</Text>
              <TouchableOpacity onPress={() => setShowPackModal(false)}>
                <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Publish a verified question collection for students.
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Pack Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="PTB Class 9 Physics - Board Exam Pack"
              placeholderTextColor={theme.textMuted}
              value={packForm.title}
              onChangeText={(t) => setPackForm({ ...packForm, title: t })}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Full syllabus board exam MCQs with explanations."
              placeholderTextColor={theme.textMuted}
              value={packForm.description}
              onChangeText={(t) => setPackForm({ ...packForm, description: t })}
            />

            <TouchableOpacity
              disabled={creatingPack}
              onPress={handleCreatePack}
              style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
            >
              {creatingPack ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalActionBtnText}>Publish Pack</Text>
              )}
            </TouchableOpacity>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleBox: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#F43F5E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRoleTag: {
    color: '#94A3B8',
    fontSize: 11,
  },
  headerMainTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 60,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  tabSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  metricSub: {
    fontSize: 11,
    marginTop: 2,
  },
  quickJumpList: {
    gap: 10,
  },
  jumpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  jumpIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  jumpSub: {
    fontSize: 11,
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pillBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  institutionText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  itemMetaText: {
    fontSize: 11,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  actionBtnSuccess: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnSuccessText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnDestructive: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnDestructiveText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeText: {
    color: '#6366F1',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
  },
  usesBadge: {
    fontSize: 11,
  },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  revokeBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
  },
  userAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    fontSize: 15,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  deactivateBtn: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
    alignSelf: 'flex-start',
  },
  deactivateBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  previewSnippet: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  deleteCircleBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  chatCountText: {
    fontSize: 11,
  },
  chatSnippetBox: {
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 4,
  },
  chatSnippetText: {
    fontSize: 11,
  },
  groupMsgContent: {
    fontSize: 12,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#3B82F6',
    fontWeight: '800',
  },
  questionText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginVertical: 8,
  },
  gradeTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  difficultyTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  optionsBox: {
    gap: 4,
    marginVertical: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionKey: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  optionVal: {
    fontSize: 11,
    flex: 1,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalActionBtn: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
