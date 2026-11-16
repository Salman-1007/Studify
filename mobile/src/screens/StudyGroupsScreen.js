import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient, { SOCKET_URL } from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function StudyGroupsScreen({ onBack }) {
  const { user, token } = useAuth();
  const { theme } = useTheme();

  // Screen modes: 'list' | 'detail' | 'chat'
  const [viewMode, setViewMode] = useState('list');

  // Groups list
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active group detail
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupQuizzes, setGroupQuizzes] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Group chat
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const socketRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Create group modal
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubject, setGroupSubject] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Load groups from API
  const loadGroups = useCallback(async () => {
    try {
      const res = await apiClient.get('/groups');
      setGroups(res.data?.data?.groups || res.data?.data || []);
    } catch (err) {
      console.warn('[StudyGroups] Error fetching groups:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Open group detail
  const handleSelectGroup = async (group) => {
    try {
      triggerHaptic('selection');
      setSelectedGroup(group);
      setViewMode('detail');
      setLoadingDetail(true);

      const [detailRes, quizzesRes] = await Promise.allSettled([
        apiClient.get(`/groups/${group.id}`),
        apiClient.get(`/groups/${group.id}/quizzes`),
      ]);

      if (detailRes.status === 'fulfilled') {
        const fullGroup = detailRes.value.data?.data?.group || group;
        setSelectedGroup(fullGroup);
        setGroupMembers(fullGroup.memberships || fullGroup.members || []);
      }

      if (quizzesRes.status === 'fulfilled') {
        setGroupQuizzes(quizzesRes.value.data?.data?.quizzes || []);
      }
    } catch (err) {
      console.warn('[StudyGroups] Error loading group detail:', err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open group chat & connect socket
  const handleOpenGroupChat = async () => {
    if (!selectedGroup) return;
    try {
      triggerHaptic('light');
      setViewMode('chat');

      // Fetch historical messages
      const res = await apiClient.get(`/groups/${selectedGroup.id}/messages`).catch(() => null);
      if (res?.data?.data?.messages) {
        setMessages(res.data.data.messages);
      }

      // Connect socket
      if (token) {
        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('group:join', { groupId: selectedGroup.id });
        });

        socket.on('group:message', (newMsg) => {
          setMessages((prev) => [...prev, newMsg]);
          triggerHaptic('selection');
        });
      }
    } catch (err) {
      console.warn('[StudyGroups] Chat init error:', err.message);
    }
  };

  // Disconnect socket on leaving chat
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Send group chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim() || sendingMsg || !selectedGroup) return;
    const content = chatInput.trim();
    setChatInput('');
    triggerHaptic('light');

    const optimisticMsg = {
      id: String(Date.now()),
      senderId: user?.id,
      sender: { id: user?.id, name: user?.name || 'You' },
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSendingMsg(true);

    try {
      await apiClient.post(`/groups/${selectedGroup.id}/messages`, { content });
    } catch (err) {
      console.warn('[StudyGroups] Send error:', err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  // Join group
  const handleJoinGroup = async () => {
    if (!selectedGroup) return;
    try {
      triggerHaptic('medium');
      await apiClient.post(`/groups/${selectedGroup.id}/join`);
      triggerHaptic('success');
      Alert.alert('Joined Circle! 🎓', `You are now a member of ${selectedGroup.name}.`);
      handleSelectGroup(selectedGroup);
    } catch (err) {
      Alert.alert('Notice', err.response?.data?.message || 'Could not join group.');
    }
  };

  // Create new group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      triggerHaptic('medium');
      setCreatingGroup(true);
      await apiClient.post('/groups', {
        name: groupName.trim(),
        subject: groupSubject.trim() || 'General Studies',
        description: groupDesc.trim() || 'Pakistan Student Study Circle',
        isPrivate: false,
      });

      setModalVisible(false);
      setGroupName('');
      setGroupSubject('');
      setGroupDesc('');
      triggerHaptic('success');
      Alert.alert('Success! 🎉', 'Your study circle has been created.');
      loadGroups();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not create study group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Group Chat View
  // ----------------------------------------------------
  if (viewMode === 'chat' && selectedGroup) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header
          title={selectedGroup.name}
          subtitle="Study Circle Discussion"
          showBack
          onBack={() => {
            if (socketRef.current) socketRef.current.disconnect();
            setViewMode('detail');
          }}
        />

        <ScrollView
          ref={chatScrollRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => {
            const isMe = m.senderId === user?.id || m.sender?.id === user?.id;
            return (
              <View
                key={m.id}
                style={[
                  styles.msgBubble,
                  isMe
                    ? [styles.userBubble, { backgroundColor: theme.primary }]
                    : [styles.otherBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
                ]}
              >
                {!isMe && (
                  <Text style={[styles.senderName, { color: theme.primary }]}>
                    {m.sender?.username ? `@${m.sender.username}` : (m.sender?.name || 'Scholar')}
                  </Text>
                )}
                <Text style={[styles.msgText, { color: isMe ? '#FFF' : theme.text }]}>{m.content}</Text>
                <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.inputField, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
            placeholder="Discuss problems, share notes..."
            placeholderTextColor={theme.textMuted}
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            disabled={!chatInput.trim() || sendingMsg}
            onPress={handleSendMessage}
            style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: !chatInput.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ----------------------------------------------------
  // RENDER: Group Detail View
  // ----------------------------------------------------
  if (viewMode === 'detail' && selectedGroup) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={selectedGroup.name}
          subtitle={selectedGroup.subject || 'Study Circle'}
          showBack
          onBack={() => setViewMode('list')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Group Banner */}
          <View style={[styles.groupHeroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={[styles.groupHeroTitle, { color: theme.text }]}>{selectedGroup.name}</Text>
            <Text style={[styles.groupHeroSubject, { color: theme.primary }]}>
              {selectedGroup.subject || 'General'}
            </Text>
            <Text style={[styles.groupHeroDesc, { color: theme.textSecondary }]}>
              {selectedGroup.description || 'Welcome to this Pakistan curriculum study group!'}
            </Text>

            <View style={styles.groupHeroActionRow}>
              <TouchableOpacity
                onPress={handleOpenGroupChat}
                style={[styles.heroChatBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.heroChatBtnText}>Open Circle Chat 💬</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleJoinGroup}
                style={[styles.heroJoinBtn, { backgroundColor: theme.cardHover }]}
              >
                <Text style={[styles.heroJoinBtnText, { color: theme.text }]}>Join Group</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Members List */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            Circle Members ({groupMembers.length})
          </Text>

          {loadingDetail ? (
            <ActivityIndicator color={theme.primary} />
          ) : groupMembers.length === 0 ? (
            <Text style={[styles.emptyInlineText, { color: theme.textMuted }]}>No member details available.</Text>
          ) : (
            <View style={[styles.membersCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              {groupMembers.slice(0, 8).map((mem, i) => (
                <View key={mem.id || i} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: `${theme.primary}20` }]}>
                    <Text style={[styles.memberAvatarText, { color: theme.primary }]}>
                      {(mem.user?.name || mem.name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {mem.user?.name || mem.name || 'Fellow Scholar'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Group Quizzes */}
          <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 20 }]}>
            Group Quiz Challenges ({groupQuizzes.length})
          </Text>

          {groupQuizzes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No group challenges active. Start a live quiz battle with members!
              </Text>
            </View>
          ) : (
            groupQuizzes.map((quiz) => (
              <View
                key={quiz.id}
                style={[styles.quizChallengeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <Text style={[styles.quizChallengeTitle, { color: theme.text }]}>{quiz.title}</Text>
                <Text style={[styles.quizChallengeMeta, { color: theme.textMuted }]}>
                  {quiz.questionCount || 10} Questions • Status: {quiz.status || 'Active'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Groups List (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Study Groups"
        subtitle="Collaborative Learning Circles"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.createBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.createBtnText}>+ Create</Text>
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
              loadGroups();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Explore Study Circles</Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : groups.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>👥</Text>
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Study Circles Found</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Tap the "+ Create" button above to launch a new Pakistan study group for MDCAT, ECAT, or your board exams.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              activeOpacity={0.7}
              onPress={() => handleSelectGroup(group)}
              style={[styles.groupItemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={[styles.groupIconBox, { backgroundColor: `${theme.primary}20` }]}>
                <Text style={styles.groupIcon}>👥</Text>
              </View>
              <View style={styles.groupItemInfo}>
                <Text style={[styles.groupItemTitle, { color: theme.text }]}>{group.name}</Text>
                <Text style={[styles.groupItemMeta, { color: theme.textMuted }]}>
                  {group.subject || 'All Subjects'} • {group._count?.memberships || group.memberCount || 1} members
                </Text>
              </View>
              <Text style={[styles.arrowIcon, { color: theme.textMuted }]}>→</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal: Create Group */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Create Study Circle</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              Form a collaborative group for peers preparing for Pakistani exams.
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Circle Name (e.g. MDCAT 2026 Achievers)"
              placeholderTextColor={theme.textMuted}
              value={groupName}
              onChangeText={setGroupName}
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Subject / Track (e.g. Biology & Chemistry)"
              placeholderTextColor={theme.textMuted}
              value={groupSubject}
              onChangeText={setGroupSubject}
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder, height: 70 }]}
              placeholder="Short Description..."
              placeholderTextColor={theme.textMuted}
              multiline
              value={groupDesc}
              onChangeText={setGroupDesc}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.cardHover }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={creatingGroup || !groupName.trim()}
                onPress={handleCreateGroup}
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: !groupName.trim() ? 0.5 : 1 }]}
              >
                {creatingGroup ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Create Group</Text>
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
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  groupItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  groupIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupIcon: {
    fontSize: 20,
  },
  groupItemInfo: {
    flex: 1,
  },
  groupItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupItemMeta: {
    fontSize: 12,
  },
  arrowIcon: {
    fontSize: 18,
    marginLeft: 8,
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

  // Detail Styles
  groupHeroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  groupHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  groupHeroSubject: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  groupHeroDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  groupHeroActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  heroChatBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroChatBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroJoinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroJoinBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  membersCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyInlineText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  quizChallengeCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  quizChallengeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  quizChallengeMeta: {
    fontSize: 12,
  },

  // Chat Styles
  chatScroll: {
    padding: 16,
    paddingBottom: 24,
  },
  msgBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputField: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
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
