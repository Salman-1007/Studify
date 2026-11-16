import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiClient, { SOCKET_URL } from '../api/client';
import { triggerHaptic } from '../utils/haptics';
import {
  SearchIcon,
  MoreVerticalIcon,
  CheckCheckIcon,
  SendIcon,
  ArrowLeftIcon,
  PlusIcon,
  UsersIcon,
  PaperclipIcon,
} from '../components/Icons';

export function getChatPartner(chat, currentUserId) {
  if (!chat) return { name: 'User', username: 'user', displayName: 'User', fallbackInitial: 'U' };
  const raw =
    chat.partner ||
    (chat.user1Id === currentUserId ? chat.user2 : chat.user1) ||
    (chat.user1?.id === currentUserId ? chat.user2 : chat.user1) ||
    {};

  const username = raw.username || '';
  const name = raw.name || '';
  const emailPrefix = raw.email ? raw.email.split('@')[0] : '';

  const displayName = username ? `@${username}` : (name || emailPrefix || 'User');
  const fallbackInitial = (username || name || emailPrefix || 'U').charAt(0).toUpperCase();

  return {
    ...raw,
    id: raw.id || (chat.user1Id === currentUserId ? chat.user2Id : chat.user1Id),
    username: username || (displayName.startsWith('@') ? displayName.slice(1) : displayName),
    name: name || username || 'User',
    displayName,
    fallbackInitial,
  };
}

export default function WhatsAppChatsScreen({ onBack: _onBack }) {
  const { user, token } = useAuth();
  const { theme } = useTheme();

  // Active chat sub-tab: 'direct' | 'groups'
  const [activeTab, setActiveTab] = useState('direct');

  // Three-dots menu modal
  const [menuVisible, setMenuVisible] = useState(false);

  // Search in chats
  const [isSearching, setIsSearching] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // New Direct Chat Modal
  const [newDirectModal, setNewDirectModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // New Group Circle Modal
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubject, setGroupSubject] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Data lists
  const [directChats, setDirectChats] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Room state: null | { type: 'direct' | 'group', data: ... }
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  const [roomInput, setRoomInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const socketRef = useRef(null);
  const chatScrollRef = useRef(null);

  // ----------------------------------------------------
  // Load Direct and Group Chats
  // ----------------------------------------------------
  const loadAllChats = useCallback(async () => {
    try {
      const [directRes, groupRes] = await Promise.allSettled([
        apiClient.get('/direct-chats'),
        apiClient.get('/groups'),
      ]);

      if (directRes.status === 'fulfilled') {
        setDirectChats(directRes.value.data?.data?.chats || directRes.value.data?.data || []);
      }

      if (groupRes.status === 'fulfilled') {
        setGroupChats(groupRes.value.data?.data?.groups || groupRes.value.data?.data || []);
      }
    } catch (err) {
      console.warn('[Chats] Error loading conversations:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllChats();
  }, [loadAllChats]);

  // Connect Socket.IO
  useEffect(() => {
    if (!token) return;

    try {
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      // Handle direct message incoming
      socket.on('direct:message', (newMsg) => {
        if (activeRoom?.type === 'direct' && newMsg.chatId === activeRoom.data.id) {
          setRoomMessages((prev) => [...prev, newMsg]);
          triggerHaptic('selection');
        }
        loadAllChats();
      });

      // Handle group message incoming
      socket.on('group:message', (newMsg) => {
        if (activeRoom?.type === 'group' && newMsg.groupId === activeRoom.data.id) {
          setRoomMessages((prev) => [...prev, newMsg]);
          triggerHaptic('selection');
        }
        loadAllChats();
      });

      return () => {
        socket.disconnect();
      };
    } catch {
      // Fallback to REST
    }
  }, [token, activeRoom, loadAllChats]);

  // ----------------------------------------------------
  // Open 1-on-1 Chat Room
  // ----------------------------------------------------
  const handleOpenDirectRoom = async (chat) => {
    try {
      triggerHaptic('selection');
      const partner = getChatPartner(chat, user?.id);

      setActiveRoom({ type: 'direct', data: chat, partner });

      const res = await apiClient.get(`/direct-chats/${chat.id}/messages`);
      const msgs = res.data?.data?.messages || [];
      setRoomMessages(msgs);

      if (res.data?.data?.partner) {
        const freshPartner = getChatPartner({ partner: res.data.data.partner }, user?.id);
        setActiveRoom({ type: 'direct', data: chat, partner: freshPartner });
      }

      // Mark read
      apiClient.post(`/direct-chats/${chat.id}/read`).catch(() => {});
    } catch (err) {
      console.warn('[Chats] Open direct error:', err.message);
    }
  };

  // ----------------------------------------------------
  // Open Group Chat Room
  // ----------------------------------------------------
  const handleOpenGroupRoom = async (group) => {
    try {
      triggerHaptic('selection');
      setActiveRoom({ type: 'group', data: group });

      const res = await apiClient.get(`/groups/${group.id}/messages`);
      setRoomMessages(res.data?.data?.messages || []);

      if (socketRef.current) {
        socketRef.current.emit('group:join', { groupId: group.id });
      }

      apiClient.post(`/groups/${group.id}/read`).catch(() => {});
    } catch (err) {
      console.warn('[Chats] Open group error:', err.message);
    }
  };

  // ----------------------------------------------------
  // Send Message in Active Room
  // ----------------------------------------------------
  const handleSendMessage = async () => {
    if (!roomInput.trim() || sendingMsg || !activeRoom) return;
    const text = roomInput.trim();
    setRoomInput('');
    triggerHaptic('light');

    if (activeRoom.type === 'direct') {
      const optimistic = {
        id: String(Date.now()),
        senderId: user?.id,
        content: text,
        createdAt: new Date().toISOString(),
      };
      setRoomMessages((prev) => [...prev, optimistic]);
      setSendingMsg(true);

      try {
        await apiClient.post(`/direct-chats/${activeRoom.data.id}/messages`, { content: text });
      } catch (err) {
        console.warn('[Chats] Send direct error:', err.message);
      } finally {
        setSendingMsg(false);
      }
    } else if (activeRoom.type === 'group') {
      const optimistic = {
        id: String(Date.now()),
        senderId: user?.id,
        sender: { id: user?.id, name: user?.name || 'You' },
        content: text,
        createdAt: new Date().toISOString(),
      };
      setRoomMessages((prev) => [...prev, optimistic]);
      setSendingMsg(true);

      try {
        await apiClient.post(`/groups/${activeRoom.data.id}/messages`, { content: text });
      } catch (err) {
        console.warn('[Chats] Send group error:', err.message);
      } finally {
        setSendingMsg(false);
      }
    }
  };

  // ----------------------------------------------------
  // User Search for New 1-on-1 Chat
  // ----------------------------------------------------
  const handleSearchUsers = async (q) => {
    setUserSearchQuery(q);
    if (!q.trim() || q.length < 2) {
      setUserSearchResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const res = await apiClient.get('/direct-chats/search-users', {
        params: { q },
      });
      setUserSearchResults(res.data?.data?.users || res.data?.data || []);
    } catch (err) {
      console.warn('[Chats] User search error:', err.message);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleStartChatWithUser = async (targetUser) => {
    try {
      triggerHaptic('medium');
      const res = await apiClient.post('/direct-chats/request', {
        recipientId: targetUser.id,
        targetUserId: targetUser.id,
      });

      const chat = res.data?.data?.chat || res.data?.data;
      setNewDirectModal(false);
      setUserSearchQuery('');
      setUserSearchResults([]);

      const chatWithPartner = {
        ...chat,
        partner: chat?.partner || targetUser,
      };
      handleOpenDirectRoom(chatWithPartner);
      loadAllChats();
    } catch (err) {
      Alert.alert('Notice', err.response?.data?.message || 'Could not start chat.');
    }
  };

  // ----------------------------------------------------
  // Create New Study Circle Group
  // ----------------------------------------------------
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      triggerHaptic('medium');
      setCreatingGroup(true);
      const res = await apiClient.post('/groups', {
        name: groupName.trim(),
        subject: groupSubject.trim() || 'General Studies',
        description: groupDesc.trim() || 'Collaborative study group',
        isPrivate: false,
      });

      const newGrp = res.data?.data?.group || res.data?.data;
      setNewGroupModal(false);
      setGroupName('');
      setGroupSubject('');
      setGroupDesc('');
      triggerHaptic('success');
      Alert.alert('Study Circle Created! 🎓', 'You can now invite members and share discussions.');
      loadAllChats();
      if (newGrp?.id) {
        handleOpenGroupRoom(newGrp);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not create study group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // ----------------------------------------------------
  // Filtered Lists
  // ----------------------------------------------------
  const filteredDirect = directChats.filter((c) => {
    if (!filterQuery.trim()) return true;
    const partner = getChatPartner(c, user?.id);
    const searchTarget = `${partner.displayName} ${partner.name} ${partner.username}`.toLowerCase();
    return searchTarget.includes(filterQuery.toLowerCase());
  });

  const filteredGroups = groupChats.filter((g) => {
    if (!filterQuery.trim()) return true;
    return (g.name || '').toLowerCase().includes(filterQuery.toLowerCase());
  });

  // ----------------------------------------------------
  // RENDER: Active Chat Room (1-on-1 or Group)
  // ----------------------------------------------------
  if (activeRoom) {
    const isDirect = activeRoom.type === 'direct';
    const partner = isDirect ? (activeRoom.partner || getChatPartner(activeRoom.data, user?.id)) : null;
    const title = isDirect ? partner?.displayName || 'Chat' : activeRoom.data?.name || 'Group';
    const subtitle = isDirect
      ? (partner?.name && partner?.username
          ? `${partner.name} • ${partner.presence?.online ? 'Online' : 'Active'}`
          : partner?.institution || (partner?.grade ? `Class ${partner.grade}` : 'Active Scholar'))
      : `${activeRoom.data?.subject || 'Circle'} • ${activeRoom.data?._count?.memberships || activeRoom.data?.memberCount || 1} members`;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* WhatsApp Room Header */}
        <View style={[styles.roomHeader, { backgroundColor: theme.waHeaderBg, borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.roomBackBtn}
            onPress={() => {
              setActiveRoom(null);
              loadAllChats();
            }}
          >
            <ArrowLeftIcon size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.roomAvatarCircle, { backgroundColor: `${theme.primary}30` }]}>
            <Text style={styles.roomAvatarText}>
              {title.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.roomHeaderInfo}>
            <Text numberOfLines={1} style={styles.roomHeaderTitle}>{title}</Text>
            <Text numberOfLines={1} style={styles.roomHeaderSub}>{subtitle}</Text>
          </View>
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={chatScrollRef}
          contentContainerStyle={styles.roomScroll}
          onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {roomMessages.length === 0 ? (
            <View style={styles.emptyRoomBox}>
              <Text style={[styles.emptyRoomText, { color: theme.textMuted }]}>
                🔒 End-to-end encrypted academic discussion.{'\n'}Say hello to start the conversation!
              </Text>
            </View>
          ) : (
            roomMessages.map((m) => {
              const isMe = m.senderId === user?.id || m.sender?.id === user?.id;
              const timeStr = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <View
                  key={m.id}
                  style={[
                    styles.waBubble,
                    isMe
                      ? [styles.waBubbleMe, { backgroundColor: theme.waSentBubble }]
                      : [styles.waBubbleOther, { backgroundColor: theme.waReceivedBubble, borderColor: theme.cardBorder }],
                  ]}
                >
                  {!isMe && !isDirect && (
                    <Text style={[styles.waSenderName, { color: theme.waTeal }]}>
                      {m.sender?.username ? `@${m.sender.username}` : (m.sender?.name || 'Scholar')}
                    </Text>
                  )}
                  <Text style={[styles.waMsgText, { color: isMe ? theme.waSentText : theme.waReceivedText }]}>
                    {m.content}
                  </Text>
                  <View style={styles.waTimeRow}>
                    <Text style={[styles.waTimeText, { color: isMe ? 'rgba(255,255,255,0.65)' : theme.textMuted }]}>
                      {timeStr}
                    </Text>
                    {isMe && (
                      <View style={{ marginLeft: 4 }}>
                        <CheckCheckIcon size={14} color={theme.waBlueCheck} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* WhatsApp Pill Input Bar */}
        <View style={[styles.waInputBar, { backgroundColor: theme.bgSecondary, borderTopColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.waAttachBtn}
            onPress={() => Alert.alert('Share', 'Share lecture notes, formulas, or document attachment.')}
          >
            <PaperclipIcon size={20} color={theme.textMuted} />
          </TouchableOpacity>

          <TextInput
            style={[styles.waInputField, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textMuted}
            value={roomInput}
            onChangeText={setRoomInput}
            onSubmitEditing={handleSendMessage}
            multiline
          />

          <TouchableOpacity
            disabled={!roomInput.trim() || sendingMsg}
            onPress={handleSendMessage}
            style={[
              styles.waSendBtn,
              {
                backgroundColor: theme.waTeal,
                opacity: !roomInput.trim() ? 0.6 : 1,
              },
            ]}
          >
            {sendingMsg ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <SendIcon size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ----------------------------------------------------
  // RENDER: WhatsApp Main Chats Screen (Direct & Groups)
  // ----------------------------------------------------
  const unreadDirect = directChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadGroups = groupChats.reduce((acc, g) => acc + (g.unreadCount || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* WhatsApp Header Bar */}
      <View style={[styles.waTopHeader, { backgroundColor: theme.waHeaderBg, borderBottomColor: theme.cardBorder }]}>
        <Text style={styles.waAppTitle}>Studify Chats</Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setIsSearching((prev) => !prev)}
          >
            <SearchIcon size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Three Dots Button */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              triggerHaptic('light');
              setMenuVisible((prev) => !prev);
            }}
          >
            <MoreVerticalIcon size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* WhatsApp Sub-Tabs (Direct vs Groups) */}
      <View style={[styles.waTabsRow, { backgroundColor: theme.waHeaderBg, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            triggerHaptic('selection');
            setActiveTab('direct');
          }}
          style={[styles.waTabItem, activeTab === 'direct' && styles.waTabItemActive]}
        >
          <View style={styles.tabContentRow}>
            <Text style={[styles.waTabText, activeTab === 'direct' && styles.waTabTextActive]}>
              Direct Messages
            </Text>
            {unreadDirect > 0 && (
              <View style={[styles.waTabBadge, { backgroundColor: theme.waTeal }]}>
                <Text style={styles.waTabBadgeText}>{unreadDirect}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            triggerHaptic('selection');
            setActiveTab('groups');
          }}
          style={[styles.waTabItem, activeTab === 'groups' && styles.waTabItemActive]}
        >
          <View style={styles.tabContentRow}>
            <Text style={[styles.waTabText, activeTab === 'groups' && styles.waTabTextActive]}>
              Study Circles
            </Text>
            {unreadGroups > 0 && (
              <View style={[styles.waTabBadge, { backgroundColor: theme.waTeal }]}>
                <Text style={styles.waTabBadgeText}>{unreadGroups}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Filter / Search Bar */}
      {isSearching && (
        <View style={[styles.searchBarBox, { backgroundColor: theme.cardHover }]}>
          <SearchIcon size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchBarInput, { color: theme.text }]}
            placeholder="Filter conversations..."
            placeholderTextColor={theme.textMuted}
            value={filterQuery}
            onChangeText={setFilterQuery}
            autoFocus
          />
          {filterQuery.length > 0 && (
            <TouchableOpacity onPress={() => setFilterQuery('')}>
              <Text style={{ color: theme.textMuted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Chat List View */}
      <ScrollView
        contentContainerStyle={styles.listScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              triggerHaptic('light');
              setRefreshing(true);
              loadAllChats();
            }}
            tintColor={theme.waTeal}
            colors={[theme.waTeal]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.waTeal} style={{ marginTop: 40 }} />
        ) : activeTab === 'direct' ? (
          /* ---------------- 1-on-1 Direct Chats List ---------------- */
          filteredDirect.length === 0 ? (
            <View style={styles.emptyInboxCard}>
              <Text style={[styles.emptyInboxTitle, { color: theme.text }]}>No Direct Chats Yet</Text>
              <Text style={[styles.emptyInboxSub, { color: theme.textMuted }]}>
                Tap the three dots (⋮) at top right or the green button below to start a private discussion with any student or educator.
              </Text>
              <TouchableOpacity
                onPress={() => setNewDirectModal(true)}
                style={[styles.startChatActionBtn, { backgroundColor: theme.waTeal }]}
              >
                <Text style={styles.startChatActionText}>Start 1-on-1 Chat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredDirect.map((chat) => {
              const partner = getChatPartner(chat, user?.id);

              const lastMsg = chat.lastMessage || chat.messages?.[0];
              const timeFormatted = lastMsg
                ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              const isMeLast = lastMsg?.senderId === user?.id;

              return (
                <TouchableOpacity
                  key={chat.id}
                  activeOpacity={0.7}
                  onPress={() => handleOpenDirectRoom(chat)}
                  style={[styles.waChatRow, { borderBottomColor: theme.cardBorder }]}
                >
                  <View style={[styles.waAvatarBox, { backgroundColor: `${theme.primary}20` }]}>
                    <Text style={[styles.waAvatarText, { color: theme.primary }]}>
                      {partner.fallbackInitial}
                    </Text>
                    <View style={styles.onlineDot} />
                  </View>

                  <View style={styles.waRowContent}>
                    <View style={styles.waRowHeader}>
                      <Text style={[styles.waNameText, { color: theme.text }]}>{partner.displayName}</Text>
                      <Text style={[styles.waTimeMeta, { color: theme.textMuted }]}>{timeFormatted}</Text>
                    </View>

                    <View style={styles.waMsgSnippetRow}>
                      {isMeLast && (
                        <View style={{ marginRight: 4 }}>
                          <CheckCheckIcon size={14} color={theme.waBlueCheck} />
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.waSnippetText,
                          { color: chat.unreadCount > 0 ? theme.text : theme.textSecondary, fontWeight: chat.unreadCount > 0 ? '700' : '400' },
                        ]}
                      >
                        {lastMsg?.content || 'Tap to start conversation'}
                      </Text>

                      {chat.unreadCount > 0 && (
                        <View style={[styles.waUnreadBadge, { backgroundColor: theme.waTeal }]}>
                          <Text style={styles.waUnreadBadgeText}>{chat.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          /* ---------------- Group Study Circles List ---------------- */
          filteredGroups.length === 0 ? (
            <View style={styles.emptyInboxCard}>
              <Text style={[styles.emptyInboxTitle, { color: theme.text }]}>No Study Circles</Text>
              <Text style={[styles.emptyInboxSub, { color: theme.textMuted }]}>
                Form a collaborative group with peers preparing for MDCAT, ECAT, or your board exams.
              </Text>
              <TouchableOpacity
                onPress={() => setNewGroupModal(true)}
                style={[styles.startChatActionBtn, { backgroundColor: theme.waTeal }]}
              >
                <Text style={styles.startChatActionText}>Create Study Circle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredGroups.map((grp) => (
              <TouchableOpacity
                key={grp.id}
                activeOpacity={0.7}
                onPress={() => handleOpenGroupRoom(grp)}
                style={[styles.waChatRow, { borderBottomColor: theme.cardBorder }]}
              >
                <View style={[styles.waAvatarBox, { backgroundColor: `${theme.accentGold}20` }]}>
                  <UsersIcon size={20} color={theme.accentGold} />
                </View>

                <View style={styles.waRowContent}>
                  <View style={styles.waRowHeader}>
                    <Text style={[styles.waNameText, { color: theme.text }]}>{grp.name}</Text>
                    <Text style={[styles.waTimeMeta, { color: theme.textMuted }]}>
                      {grp.subject || 'Circle'}
                    </Text>
                  </View>

                  <View style={styles.waMsgSnippetRow}>
                    <Text
                      numberOfLines={1}
                      style={[styles.waSnippetText, { color: theme.textSecondary }]}
                    >
                      {grp.description || 'Tap to enter group discussion'}
                    </Text>
                    <Text style={[styles.memberCountTag, { color: theme.textMuted }]}>
                      {grp._count?.memberships || grp.memberCount || 1} members
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>

      {/* WhatsApp Floating Action Button (FAB) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          triggerHaptic('medium');
          if (activeTab === 'direct') {
            setNewDirectModal(true);
          } else {
            setNewGroupModal(true);
          }
        }}
        style={[styles.waFab, { backgroundColor: theme.waFab }]}
      >
        <PlusIcon size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Dropdown Three-Dot Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
          style={styles.menuOverlay}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setNewDirectModal(true);
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>💬 New Direct Chat</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.cardBorder }]} />

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setNewGroupModal(true);
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>👥 New Study Circle</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.cardBorder }]} />

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                apiClient.patch('/notifications/read-all').catch(() => {});
                triggerHaptic('success');
                Alert.alert('Read Receipts', 'All conversation badges updated.');
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>✓✓ Mark All as Read</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: New 1-on-1 Direct Chat User Search */}
      <Modal visible={newDirectModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>Start Direct Chat</Text>
              <TouchableOpacity onPress={() => setNewDirectModal(false)}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubheading, { color: theme.textMuted }]}>
              Search any student, classmate, or teacher by name or email:
            </Text>

            <TextInput
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Search scholar name or email..."
              placeholderTextColor={theme.textMuted}
              value={userSearchQuery}
              onChangeText={handleSearchUsers}
              autoFocus
            />

            <ScrollView style={{ maxHeight: 240, marginVertical: 10 }}>
              {searchingUsers ? (
                <ActivityIndicator color={theme.waTeal} style={{ marginVertical: 16 }} />
              ) : userSearchResults.length === 0 && userSearchQuery.length >= 2 ? (
                <Text style={[styles.emptySearchText, { color: theme.textMuted }]}>
                  No users found matching "{userSearchQuery}".
                </Text>
              ) : (
                userSearchResults.map((usr) => (
                  <TouchableOpacity
                    key={usr.id}
                    onPress={() => handleStartChatWithUser(usr)}
                    style={[styles.searchUserRow, { borderColor: theme.cardBorder }]}
                  >
                    <View style={[styles.smallAvatar, { backgroundColor: `${theme.primary}20` }]}>
                      <Text style={[styles.smallAvatarText, { color: theme.primary }]}>
                        {(usr.username || usr.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.searchUserName, { color: theme.text }]}>
                        {usr.username ? `@${usr.username}` : usr.name}
                      </Text>
                      <Text style={[styles.searchUserMeta, { color: theme.textMuted }]}>
                        {usr.name ? `${usr.name} • ` : ''}{usr.institution || (usr.grade ? `Class ${usr.grade}` : (usr.email || 'Scholar'))}
                      </Text>
                    </View>
                    <Text style={[styles.startChatPill, { color: theme.waTeal }]}>Chat →</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Create New Study Circle Group */}
      <Modal visible={newGroupModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>Create Study Circle</Text>
              <TouchableOpacity onPress={() => setNewGroupModal(false)}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Circle Name (e.g. MDCAT Biology 2026)"
              placeholderTextColor={theme.textMuted}
              value={groupName}
              onChangeText={setGroupName}
            />

            <TextInput
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Subject (e.g. Biology, Physics, Math)"
              placeholderTextColor={theme.textMuted}
              value={groupSubject}
              onChangeText={setGroupSubject}
            />

            <TextInput
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder, height: 70 }]}
              placeholder="Description..."
              placeholderTextColor={theme.textMuted}
              multiline
              value={groupDesc}
              onChangeText={setGroupDesc}
            />

            <TouchableOpacity
              disabled={creatingGroup || !groupName.trim()}
              onPress={handleCreateGroup}
              style={[styles.createGroupBtn, { backgroundColor: theme.waTeal, opacity: !groupName.trim() ? 0.5 : 1 }]}
            >
              {creatingGroup ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.createGroupBtnText}>Create Circle</Text>
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
  // WhatsApp Header
  waTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  waAppTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // WhatsApp Sub-Tabs
  waTabsRow: {
    flexDirection: 'row',
  },
  waTabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  waTabItemActive: {
    borderBottomColor: '#00A884',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waTabText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  waTabTextActive: {
    color: '#FFFFFF',
  },
  waTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  waTabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Filter Bar
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
  },

  // Chat Row
  listScroll: {
    paddingBottom: 80,
  },
  waChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  waAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  waAvatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: 1,
    right: 1,
    borderWidth: 1.5,
    borderColor: '#0B0D13',
  },
  waRowContent: {
    flex: 1,
  },
  waRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  waNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  waTimeMeta: {
    fontSize: 11,
  },
  waMsgSnippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waSnippetText: {
    flex: 1,
    fontSize: 13,
  },
  waUnreadBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  waUnreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  memberCountTag: {
    fontSize: 11,
    marginLeft: 6,
  },

  // FAB
  waFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  // Dropdown Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: 16,
  },
  dropdownMenu: {
    width: 190,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
  },

  // Room View
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  roomBackBtn: {
    padding: 6,
    marginRight: 4,
  },
  roomAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  roomAvatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  roomHeaderInfo: {
    flex: 1,
  },
  roomHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  roomHeaderSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  roomScroll: {
    padding: 14,
    paddingBottom: 24,
  },
  emptyRoomBox: {
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyRoomText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  waBubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 14,
    marginBottom: 8,
  },
  waBubbleMe: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  waBubbleOther: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    borderWidth: 0.5,
  },
  waSenderName: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  waMsgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  waTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  waTimeText: {
    fontSize: 10,
  },
  waInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  waAttachBtn: {
    padding: 8,
  },
  waInputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  waSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubheading: {
    fontSize: 12,
    marginBottom: 12,
  },
  userSearchInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
  },
  searchUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  smallAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  smallAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  searchUserName: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchUserMeta: {
    fontSize: 11,
  },
  startChatPill: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptySearchText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 16,
  },
  createGroupBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  createGroupBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyInboxCard: {
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyInboxTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyInboxSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  startChatActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startChatActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
