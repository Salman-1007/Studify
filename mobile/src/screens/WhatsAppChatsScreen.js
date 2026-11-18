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
  CheckIcon,
  SendIcon,
  ArrowLeftIcon,
  PlusIcon,
  UsersIcon,
  PaperclipIcon,
  SunIcon,
  MoonIcon,
} from '../components/Icons';

export function formatActivityPresence(presence) {
  if (!presence) return { isOnline: false, text: 'offline' };
  if (presence.showOnlineStatus === false) {
    return { isOnline: false, text: 'last seen recently' };
  }
  if (presence.online) {
    return { isOnline: true, text: 'online' };
  }
  if (!presence.lastSeenAt) {
    return { isOnline: false, text: 'offline' };
  }

  const date = new Date(presence.lastSeenAt);
  if (isNaN(date.getTime())) return { isOnline: false, text: 'offline' };

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return { isOnline: false, text: 'last seen just now' };
  if (diffMins < 60) return { isOnline: false, text: `last seen ${diffMins}m ago` };

  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) {
    return { isOnline: false, text: `last seen today at ${timeStr}` };
  }
  if (isYesterday) {
    return { isOnline: false, text: `last seen yesterday at ${timeStr}` };
  }
  return {
    isOnline: false,
    text: `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`,
  };
}

export function MessageStatusTick({ status, size = 13, isDark = true }) {
  if (status === 'SEEN') {
    return <CheckCheckIcon size={size} color="#53BDEB" />;
  }
  const defaultGray = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';
  if (status === 'DELIVERED') {
    return <CheckCheckIcon size={size} color={defaultGray} />;
  }
  return <CheckIcon size={size} color={defaultGray} />;
}

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

export default function WhatsAppChatsScreen({ onBack: _onBack, onOpenSettings }) {
  const { user, token } = useAuth();
  const { theme, isDark, setThemePreference } = useTheme();

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

  // New Group Circle Modal with Participant Selection
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSubject, setGroupSubject] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupUserSearchQuery, setGroupUserSearchQuery] = useState('');
  const [groupUserSearchResults, setGroupUserSearchResults] = useState([]);
  const [searchingGroupUsers, setSearchingGroupUsers] = useState(false);

  // Join Group by Code Modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningGroup, setJoiningGroup] = useState(false);

  // Group Info Drawer Modal
  const [groupInfoModalVisible, setGroupInfoModalVisible] = useState(false);
  const [groupDetails, setGroupDetails] = useState(null);
  const [groupMembersList, setGroupMembersList] = useState([]);
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false);

  // Add Members to Existing Group Modal
  const [addMembersModalVisible, setAddMembersModalVisible] = useState(false);
  const [addMembersSelected, setAddMembersSelected] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

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
  // Load Direct and Group Chats (WhatsApp Whitelist Filter)
  // ----------------------------------------------------
  const loadAllChats = useCallback(async () => {
    try {
      const [directRes, groupRes] = await Promise.allSettled([
        apiClient.get('/direct-chats'),
        apiClient.get('/groups/my').catch(() => apiClient.get('/groups')),
      ]);

      if (directRes.status === 'fulfilled') {
        setDirectChats(directRes.value.data?.data?.chats || directRes.value.data?.data || []);
      }

      if (groupRes.status === 'fulfilled') {
        const rawGroups = groupRes.value.data?.data?.groups || groupRes.value.data?.data || [];
        // Strictly show ONLY groups where current user is owner or an active participant
        const myJoinedGroups = rawGroups.filter((g) => {
          if (!g) return false;
          if (g.ownerId === user?.id) return true;
          if (Array.isArray(g.members)) {
            return g.members.some((m) => (m.userId || m.user?.id) === user?.id);
          }
          return false;
        });
        setGroupChats(myJoinedGroups);
      }
    } catch (err) {
      console.warn('[Chats] Error loading conversations:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

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

          // If from partner, acknowledge receipt as seen
          if (newMsg.senderId !== user?.id) {
            socket.emit('direct:seen', {
              chatId: activeRoom.data.id,
              messageIds: [newMsg.id],
            });
            apiClient.post(`/direct-chats/${activeRoom.data.id}/read`).catch(() => {});
          }
        }
        loadAllChats();
      });

      // Handle real-time presence updates (Online / Offline / Last seen)
      socket.on('presence:update', ({ userId, online, lastSeenAt }) => {
        setDirectChats((prev) =>
          prev.map((c) => {
            const p = c.partner || (c.user1Id === user?.id ? c.user2 : c.user1);
            if (p && p.id === userId) {
              return {
                ...c,
                partner: {
                  ...p,
                  presence: {
                    ...p.presence,
                    online: Boolean(online),
                    lastSeenAt: lastSeenAt || new Date().toISOString(),
                    showOnlineStatus: p.presence?.showOnlineStatus !== false,
                  },
                },
              };
            }
            return c;
          })
        );

        setActiveRoom((prev) => {
          if (prev?.type === 'direct' && prev.partner?.id === userId) {
            return {
              ...prev,
              partner: {
                ...prev.partner,
                presence: {
                  ...prev.partner.presence,
                  online: Boolean(online),
                  lastSeenAt: lastSeenAt || new Date().toISOString(),
                  showOnlineStatus: prev.partner.presence?.showOnlineStatus !== false,
                },
              },
            };
          }
          return prev;
        });
      });

      // Handle real-time read receipts (Legit Blue Ticks)
      socket.on('direct:messages_seen', ({ chatId, messageIds }) => {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return;
        setRoomMessages((prev) =>
          prev.map((m) =>
            messageIds.includes(m.id) ? { ...m, deliveryStatus: 'SEEN' } : m
          )
        );
        setDirectChats((prev) =>
          prev.map((c) => {
            if (c.id === chatId && c.lastMessage && messageIds.includes(c.lastMessage.id)) {
              return {
                ...c,
                lastMessage: {
                  ...c.lastMessage,
                  deliveryStatus: 'SEEN',
                },
              };
            }
            return c;
          })
        );
      });

      // Handle group message incoming
      socket.on('group:message', (newMsg) => {
        if (activeRoom?.type === 'group' && newMsg.groupId === activeRoom.data.id) {
          setRoomMessages((prev) => [...prev, newMsg]);
          triggerHaptic('selection');
        }
        loadAllChats();
      });

      // Handle direct message unsent (delete for everyone)
      socket.on('direct:message_unsent', ({ messageId, message }) => {
        setRoomMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isUnsent: true,
                  isDeletedForEveryone: true,
                  content: message?.content || 'This message was unsent',
                }
              : m
          )
        );
        loadAllChats();
      });

      // Handle group message unsent (delete for everyone)
      socket.on('group:message_unsent', ({ messageId, message }) => {
        setRoomMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isUnsent: true,
                  isDeletedForEveryone: true,
                  content: message?.content || 'This message was unsent',
                }
              : m
          )
        );
        loadAllChats();
      });

      return () => {
        socket.disconnect();
      };
    } catch {
      // Fallback to REST
    }
  }, [token, activeRoom, user?.id, loadAllChats]);

  // ----------------------------------------------------
  // Open 1-on-1 Chat Room
  // ----------------------------------------------------
  const handleOpenDirectRoom = async (chat) => {
    try {
      triggerHaptic('selection');
      const partner = getChatPartner(chat, user?.id);

      setActiveRoom({ type: 'direct', data: chat, partner });

      if (socketRef.current) {
        socketRef.current.emit('direct:join', { chatId: chat.id });
      }

      const res = await apiClient.get(`/direct-chats/${chat.id}/messages`);
      const msgs = res.data?.data?.messages || [];
      setRoomMessages(msgs);

      if (res.data?.data?.partner) {
        const freshPartner = getChatPartner({ partner: res.data.data.partner }, user?.id);
        setActiveRoom({ type: 'direct', data: chat, partner: freshPartner });
      }

      // Mark read and broadcast seen receipt
      apiClient.post(`/direct-chats/${chat.id}/read`).catch(() => {});
      if (msgs.length > 0 && socketRef.current) {
        const unseenIds = msgs.filter((m) => m.senderId !== user?.id).map((m) => m.id);
        if (unseenIds.length > 0) {
          socketRef.current.emit('direct:seen', {
            chatId: chat.id,
            messageIds: unseenIds,
          });
        }
      }
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
        id: `opt-${Date.now()}`,
        senderId: user?.id,
        content: text,
        createdAt: new Date().toISOString(),
        deliveryStatus: 'SENT',
      };
      setRoomMessages((prev) => [...prev, optimistic]);
      setSendingMsg(true);

      try {
        const res = await apiClient.post(`/direct-chats/${activeRoom.data.id}/messages`, { content: text });
        const createdMsg = res.data?.data?.message || res.data?.data;
        if (createdMsg) {
          setRoomMessages((prev) =>
            prev.map((m) => (m.id === optimistic.id ? createdMsg : m))
          );
        }
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
  // Member Search for Group Creation & Addition
  // ----------------------------------------------------
  const handleSearchGroupUsers = async (q) => {
    setGroupUserSearchQuery(q);
    if (!q.trim() || q.length < 2) {
      setGroupUserSearchResults([]);
      return;
    }

    try {
      setSearchingGroupUsers(true);
      const res = await apiClient
        .get(`/users/search?q=${encodeURIComponent(q.trim())}`)
        .catch(async () => apiClient.get(`/direct-chats/search-users?q=${encodeURIComponent(q.trim())}`));
      const found = res.data?.data?.users || res.data?.data || [];
      setGroupUserSearchResults(found.filter((u) => u.id !== user?.id));
    } catch (err) {
      console.warn('[Chats] Search group users error:', err.message);
    } finally {
      setSearchingGroupUsers(false);
    }
  };

  const toggleSelectGroupMember = (usr) => {
    triggerHaptic('selection');
    setSelectedGroupMembers((prev) => {
      const exists = prev.some((m) => m.id === usr.id);
      if (exists) {
        return prev.filter((m) => m.id !== usr.id);
      }
      return [...prev, usr];
    });
  };

  // ----------------------------------------------------
  // Create New WhatsApp-Style Private Study Circle Group
  // ----------------------------------------------------
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name.');
      return;
    }
    try {
      triggerHaptic('medium');
      setCreatingGroup(true);
      const res = await apiClient.post('/groups', {
        name: groupName.trim(),
        subject: groupSubject.trim() || 'General Studies',
        description: groupDesc.trim() || 'WhatsApp-style private study group',
        privacy: 'PRIVATE',
        memberIds: selectedGroupMembers.map((m) => m.id),
      });

      const newGrp = res.data?.data?.group || res.data?.data;
      setNewGroupModal(false);
      setGroupName('');
      setGroupSubject('');
      setGroupDesc('');
      setSelectedGroupMembers([]);
      setGroupUserSearchQuery('');
      setGroupUserSearchResults([]);
      triggerHaptic('success');
      Alert.alert(
        'Study Circle Created! 🎓',
        `Private circle created with ${selectedGroupMembers.length + 1} participant(s). Only invited participants can see or participate.`
      );
      await loadAllChats();
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
  // Join Group via Code or Invite Link
  // ----------------------------------------------------
  const handleJoinByCode = async () => {
    if (!joinCodeInput.trim()) {
      Alert.alert('Required', 'Please enter an invite code or paste link.');
      return;
    }
    try {
      setJoiningGroup(true);
      triggerHaptic('medium');
      const raw = joinCodeInput.trim();
      const code = raw.includes('/') ? raw.split('/').pop().trim() : raw;

      const res = await apiClient.post('/groups/join-by-code', { code });
      const grp = res.data?.data?.group || res.data?.data;
      triggerHaptic('success');
      setJoinModalVisible(false);
      setJoinCodeInput('');
      Alert.alert('Joined Group! 👥', `You are now a member of "${grp?.name || 'the study group'}".`);
      await loadAllChats();
      if (grp?.id) {
        handleOpenGroupRoom(grp);
      }
    } catch (err) {
      Alert.alert('Join Error', err.response?.data?.message || 'Invalid or expired invite code.');
    } finally {
      setJoiningGroup(false);
    }
  };

  // ----------------------------------------------------
  // Open Group Info Drawer
  // ----------------------------------------------------
  const handleOpenGroupInfo = async () => {
    if (!activeRoom || activeRoom.type !== 'group') return;
    try {
      triggerHaptic('selection');
      setGroupInfoModalVisible(true);
      setLoadingGroupInfo(true);
      const res = await apiClient.get(`/groups/${activeRoom.data.id}`);
      const grp = res.data?.data?.group || res.data?.data || activeRoom.data;
      setGroupDetails(grp);
      setGroupMembersList(grp.members || []);
    } catch (err) {
      console.warn('[Chats] Group info error:', err.message);
    } finally {
      setLoadingGroupInfo(false);
    }
  };

  // ----------------------------------------------------
  // Add Members to Existing Group
  // ----------------------------------------------------
  const handleAddMembersToExistingGroup = async () => {
    if (!activeRoom || addMembersSelected.length === 0) return;
    try {
      setAddingMembers(true);
      triggerHaptic('medium');
      await apiClient.post(`/groups/${activeRoom.data.id}/add-members`, {
        userIds: addMembersSelected.map((u) => u.id),
      });
      triggerHaptic('success');
      Alert.alert('Members Added!', `Added ${addMembersSelected.length} participant(s) to the circle.`);
      setAddMembersModalVisible(false);
      setAddMembersSelected([]);

      // Refresh group info and chat list
      const res = await apiClient.get(`/groups/${activeRoom.data.id}`);
      const grp = res.data?.data?.group || res.data?.data;
      setGroupDetails(grp);
      setGroupMembersList(grp.members || []);
      loadAllChats();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not add members.');
    } finally {
      setAddingMembers(false);
    }
  };

  // ----------------------------------------------------
  // Message Options: Delete for Me & Delete for Everyone
  // ----------------------------------------------------
  const handleMessageLongPress = (msg) => {
    if (msg.isUnsent || msg.isDeletedForEveryone) return;
    triggerHaptic('impactMedium');

    const isMe = msg.senderId === user?.id || msg.sender?.id === user?.id;
    const isDirect = activeRoom?.type === 'direct';
    const targetId = activeRoom?.data?.id;

    const options = [];

    // Delete for Everyone (if sent by current user or user is admin)
    if (isMe || user?.role === 'ADMIN') {
      options.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          try {
            triggerHaptic('warning');
            if (isDirect) {
              await apiClient.delete(`/direct-chats/messages/${msg.id}`);
            } else {
              await apiClient.delete(`/groups/messages/${msg.id}`);
            }
            // Optimistically update message in active view
            setRoomMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id
                  ? { ...m, isUnsent: true, isDeletedForEveryone: true, content: 'This message was unsent' }
                  : m
              )
            );
            loadAllChats();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not delete message for everyone.');
          }
        },
      });
    }

    // Delete for Me (always available)
    options.push({
      text: 'Delete for me',
      style: 'destructive',
      onPress: async () => {
        try {
          triggerHaptic('light');
          if (isDirect) {
            await apiClient.delete(`/direct-chats/${targetId}/messages/${msg.id}/for-me`);
          } else {
            await apiClient.delete(`/groups/${targetId}/messages/${msg.id}/for-me`);
          }
          // Remove from local room message array
          setRoomMessages((prev) => prev.filter((m) => m.id !== msg.id));
          loadAllChats();
        } catch (err) {
          Alert.alert('Error', err.response?.data?.message || 'Could not delete message for me.');
        }
      },
    });

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert(
      'Message Options',
      'Choose an action for this message:',
      options
    );
  };

  // ----------------------------------------------------
  // Chat Room Actions: Clear Chat, Delete Chat, Leave Group
  // ----------------------------------------------------
  const handleOpenRoomOptions = () => {
    if (!activeRoom) return;
    triggerHaptic('light');
    const isDirect = activeRoom.type === 'direct';
    const targetId = activeRoom.data.id;
    const title = isDirect ? (activeRoom.partner?.displayName || 'Chat') : (activeRoom.data?.name || 'Group');

    if (isDirect) {
      Alert.alert(
        title,
        'Manage this direct conversation:',
        [
          {
            text: 'Clear Chat',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Clear Chat?',
                'Are you sure you want to clear all messages in this conversation?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await apiClient.delete(`/direct-chats/${targetId}`);
                        setRoomMessages([]);
                        triggerHaptic('success');
                        loadAllChats();
                      } catch (err) {
                        Alert.alert('Error', err.response?.data?.message || 'Could not clear chat.');
                      }
                    },
                  },
                ]
              );
            },
          },
          {
            text: 'Delete Chat',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Delete Chat?',
                'This conversation will be deleted and removed from your chats list.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await apiClient.delete(`/direct-chats/${targetId}`);
                        setActiveRoom(null);
                        triggerHaptic('success');
                        loadAllChats();
                      } catch (err) {
                        Alert.alert('Error', err.response?.data?.message || 'Could not delete chat.');
                      }
                    },
                  },
                ]
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      const isOwner = activeRoom.data?.ownerId === user?.id;
      const options = [];

      if (isOwner) {
        options.push({
          text: 'Delete Study Circle',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Study Circle?',
              'Are you sure you want to delete this study circle for all members?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Circle',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiClient.delete(`/groups/${targetId}`);
                      setActiveRoom(null);
                      triggerHaptic('success');
                      loadAllChats();
                    } catch (err) {
                      Alert.alert('Error', err.response?.data?.message || 'Could not delete group.');
                    }
                  },
                },
              ]
            );
          },
        });
      } else {
        options.push({
          text: 'Leave Study Circle',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Leave Study Circle?',
              'Are you sure you want to leave this circle?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiClient.delete(`/groups/${targetId}/members/${user?.id}`);
                      setActiveRoom(null);
                      triggerHaptic('success');
                      loadAllChats();
                    } catch (err) {
                      Alert.alert('Error', err.response?.data?.message || 'Could not leave circle.');
                    }
                  },
                },
              ]
            );
          },
        });
      }

      options.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(title, 'Study Circle Options:', options);
    }
  };

  // ----------------------------------------------------
  // Long Press Conversation Item in List
  // ----------------------------------------------------
  const handleConversationLongPress = (item, type) => {
    triggerHaptic('impactMedium');
    if (type === 'direct') {
      const partner = getChatPartner(item, user?.id);
      Alert.alert(
        partner.displayName,
        'Manage conversation:',
        [
          {
            text: 'Clear Chat History',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.delete(`/direct-chats/${item.id}`);
                triggerHaptic('success');
                loadAllChats();
              } catch (err) {
                Alert.alert('Error', err.response?.data?.message || 'Could not clear chat.');
              }
            },
          },
          {
            text: 'Delete Conversation',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Delete Chat?',
                'Remove this conversation from your chat inbox?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await apiClient.delete(`/direct-chats/${item.id}`);
                        setDirectChats((prev) => prev.filter((c) => c.id !== item.id));
                        triggerHaptic('success');
                      } catch (err) {
                        Alert.alert('Error', err.response?.data?.message || 'Could not delete chat.');
                      }
                    },
                  },
                ]
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      const isOwner = item.ownerId === user?.id;
      Alert.alert(
        item.name,
        'Study Circle Options:',
        [
          isOwner
            ? {
                text: 'Delete Circle',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await apiClient.delete(`/groups/${item.id}`);
                    setGroupChats((prev) => prev.filter((g) => g.id !== item.id));
                    triggerHaptic('success');
                  } catch (err) {
                    Alert.alert('Error', err.response?.data?.message || 'Could not delete circle.');
                  }
                },
              }
            : {
                text: 'Leave Circle',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await apiClient.delete(`/groups/${item.id}/members/${user?.id}`);
                    setGroupChats((prev) => prev.filter((g) => g.id !== item.id));
                    triggerHaptic('success');
                  } catch (err) {
                    Alert.alert('Error', err.response?.data?.message || 'Could not leave circle.');
                  }
                },
              },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
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
    const presenceInfo = isDirect ? formatActivityPresence(partner?.presence) : null;
    const title = isDirect ? partner?.displayName || 'Chat' : activeRoom.data?.name || 'Group';
    const subtitle = isDirect
      ? presenceInfo?.text || 'offline'
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
            {isDirect && presenceInfo?.isOnline && (
              <View style={[styles.roomOnlineBadge, { borderColor: theme.bg }]} />
            )}
          </View>

          <TouchableOpacity
            style={styles.roomHeaderInfo}
            activeOpacity={isDirect ? 1 : 0.7}
            onPress={isDirect ? undefined : handleOpenGroupInfo}
          >
            <Text numberOfLines={1} style={styles.roomHeaderTitle}>{title}</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.roomHeaderSub,
                isDirect && presenceInfo?.isOnline && { color: theme.waTeal, fontWeight: '700' },
              ]}
            >
              {subtitle}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roomMoreBtn}
            onPress={isDirect ? handleOpenRoomOptions : handleOpenGroupInfo}
          >
            <MoreVerticalIcon size={20} color="#FFFFFF" />
          </TouchableOpacity>
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
              const isUnsent = Boolean(m.isUnsent || m.isDeletedForEveryone);

              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.85}
                  onLongPress={() => handleMessageLongPress(m)}
                  style={[
                    styles.waBubble,
                    isMe
                      ? [styles.waBubbleMe, { backgroundColor: theme.waSentBubble }]
                      : [styles.waBubbleOther, { backgroundColor: theme.waReceivedBubble, borderColor: theme.cardBorder }],
                    isUnsent && { opacity: 0.75 },
                  ]}
                >
                  {!isMe && !isDirect && (
                    <Text style={[styles.waSenderName, { color: theme.waTeal }]}>
                      {m.sender?.username ? `@${m.sender.username}` : (m.sender?.name || 'Scholar')}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.waMsgText,
                      { color: isMe ? theme.waSentText : theme.waReceivedText },
                      isUnsent && { fontStyle: 'italic' },
                    ]}
                  >
                    {isUnsent ? '🚫 This message was deleted' : m.content}
                  </Text>
                  <View style={styles.waTimeRow}>
                    <Text
                      style={[
                        styles.waTimeText,
                        {
                          color: isMe
                            ? isDark
                              ? 'rgba(255,255,255,0.7)'
                              : 'rgba(0,0,0,0.6)'
                            : theme.textMuted,
                        },
                      ]}
                    >
                      {timeStr}
                    </Text>
                    {isMe && !isUnsent && (
                      <View style={{ marginLeft: 4 }}>
                        <MessageStatusTick
                          status={m.deliveryStatus || (m.receipts?.some((r) => r.userId !== user?.id && r.seenAt) ? 'SEEN' : 'SENT')}
                          size={14}
                          isDark={isDark}
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
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
            onPress={() => {
              triggerHaptic('light');
              setThemePreference(isDark ? 'light' : 'dark');
            }}
          >
            {isDark ? <SunIcon size={20} color="#F59E0B" /> : <MoonIcon size={20} color="#FFFFFF" />}
          </TouchableOpacity>

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
          style={[
            styles.waTabItem,
            activeTab === 'direct' && {
              borderBottomColor: isDark ? theme.waTeal : '#FFFFFF',
            },
          ]}
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
          style={[
            styles.waTabItem,
            activeTab === 'groups' && {
              borderBottomColor: isDark ? theme.waTeal : '#FFFFFF',
            },
          ]}
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
              const presenceInfo = formatActivityPresence(partner.presence);

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
                  onLongPress={() => handleConversationLongPress(chat, 'direct')}
                  style={[styles.waChatRow, { borderBottomColor: theme.cardBorder }]}
                >
                  <View style={[styles.waAvatarBox, { backgroundColor: `${theme.primary}20` }]}>
                    <Text style={[styles.waAvatarText, { color: theme.primary }]}>
                      {partner.fallbackInitial}
                    </Text>
                    {presenceInfo.isOnline && (
                      <View style={[styles.onlineDot, { borderColor: theme.bg }]} />
                    )}
                  </View>

                  <View style={styles.waRowContent}>
                    <View style={styles.waRowHeader}>
                      <Text style={[styles.waNameText, { color: theme.text }]}>{partner.displayName}</Text>
                      <Text style={[styles.waTimeMeta, { color: theme.textMuted }]}>{timeFormatted}</Text>
                    </View>

                    <View style={styles.waMsgSnippetRow}>
                      {isMeLast && (
                        <View style={{ marginRight: 4 }}>
                          <MessageStatusTick
                            status={lastMsg?.deliveryStatus || (lastMsg?.receipts?.some((r) => r.userId !== user?.id && r.seenAt) ? 'SEEN' : 'SENT')}
                            size={14}
                            isDark={isDark}
                          />
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
                onLongPress={() => handleConversationLongPress(grp, 'group')}
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
              <Text style={[styles.menuItemText, { color: theme.text }]}>👥 New Group Circle</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.cardBorder }]} />

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                setJoinModalVisible(true);
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>🔑 Join Group via Code</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.cardBorder }]} />

            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                setThemePreference(isDark ? 'light' : 'dark');
                setMenuVisible(false);
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {isDark ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: theme.cardBorder }]} />

            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
              style={styles.menuItem}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>⚙️ Settings & Log Out</Text>
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
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder, maxHeight: '88%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>Create Private Study Group</Text>
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
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder, height: 50 }]}
              placeholder="Group Description (optional)..."
              placeholderTextColor={theme.textMuted}
              multiline
              value={groupDesc}
              onChangeText={setGroupDesc}
            />

            {/* Selected Members Chips */}
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 6, marginBottom: 4 }}>
              Add Members by List ({selectedGroupMembers.length} selected)
            </Text>

            {selectedGroupMembers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36, marginBottom: 8 }}>
                {selectedGroupMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggleSelectGroupMember(m)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: `${theme.waTeal}20`,
                      borderColor: theme.waTeal,
                      borderWidth: 1,
                      borderRadius: 14,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      marginRight: 6,
                    }}
                  >
                    <Text style={{ color: theme.waTeal, fontSize: 11, fontWeight: '600' }}>
                      {m.username ? `@${m.username}` : (m.name || 'Scholar')}
                    </Text>
                    <Text style={{ color: theme.waTeal, marginLeft: 4, fontSize: 11 }}>✕</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Search Classmates to Add */}
            <TextInput
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Search classmates to add..."
              placeholderTextColor={theme.textMuted}
              value={groupUserSearchQuery}
              onChangeText={handleSearchGroupUsers}
            />

            <ScrollView style={{ maxHeight: 110, marginBottom: 10 }}>
              {searchingGroupUsers ? (
                <ActivityIndicator color={theme.waTeal} style={{ marginVertical: 8 }} />
              ) : (
                groupUserSearchResults.map((usr) => {
                  const isSelected = selectedGroupMembers.some((m) => m.id === usr.id);
                  return (
                    <TouchableOpacity
                      key={usr.id}
                      onPress={() => toggleSelectGroupMember(usr)}
                      style={[
                        styles.searchUserRow,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: isSelected ? `${theme.waTeal}15` : 'transparent',
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.searchUserName, { color: theme.text }]}>
                          {usr.name || usr.username}
                        </Text>
                        <Text style={[styles.searchUserMeta, { color: theme.textMuted }]}>
                          {usr.username ? `@${usr.username}` : usr.email}
                        </Text>
                      </View>
                      <Text style={{ color: isSelected ? theme.waTeal : theme.textMuted, fontSize: 12, fontWeight: '700' }}>
                        {isSelected ? '✓ Added' : '+ Add'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              disabled={creatingGroup || !groupName.trim()}
              onPress={handleCreateGroup}
              style={[styles.createGroupBtn, { backgroundColor: theme.waTeal, opacity: !groupName.trim() ? 0.5 : 1 }]}
            >
              {creatingGroup ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.createGroupBtnText}>Create Group & Add Participants</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Join Group via Code / Invite Link */}
      <Modal visible={joinModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>Join Private Study Circle</Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubheading, { color: theme.textMuted }]}>
              Enter the 6-character group invite code or paste an invite link:
            </Text>

            <TextInput
              style={[
                styles.userSearchInput,
                {
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  borderColor: theme.inputBorder,
                  fontSize: 16,
                  letterSpacing: 2,
                  textAlign: 'center',
                  fontWeight: '700',
                },
              ]}
              placeholder="e.g. 7A4F82"
              placeholderTextColor={theme.textMuted}
              value={joinCodeInput}
              onChangeText={setJoinCodeInput}
              autoCapitalize="characters"
              autoFocus
            />

            <TouchableOpacity
              disabled={joiningGroup || !joinCodeInput.trim()}
              onPress={handleJoinByCode}
              style={[
                styles.createGroupBtn,
                {
                  backgroundColor: theme.waTeal,
                  opacity: !joinCodeInput.trim() ? 0.5 : 1,
                  marginTop: 14,
                },
              ]}
            >
              {joiningGroup ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.createGroupBtnText}>Join Study Circle 🚀</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Group Info & Invite Link Drawer */}
      <Modal visible={groupInfoModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder, maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalHeading, { color: theme.text }]}>
                  {groupDetails?.name || activeRoom?.data?.name || 'Study Circle'}
                </Text>
                <Text style={[styles.modalSubheading, { color: theme.textMuted, marginTop: 2 }]}>
                  {groupDetails?.subject || activeRoom?.data?.subject || 'General'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setGroupInfoModalVisible(false)}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingGroupInfo ? (
              <ActivityIndicator color={theme.waTeal} style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView style={{ marginVertical: 10 }}>
                {/* Description */}
                {Boolean(groupDetails?.description) && (
                  <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>
                    {groupDetails.description}
                  </Text>
                )}

                {/* Invite Link & Code Card */}
                <View
                  style={{
                    backgroundColor: `${theme.waTeal}15`,
                    borderColor: `${theme.waTeal}40`,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ color: theme.waTeal, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                    Group Invite Code & Link
                  </Text>
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 20,
                      fontWeight: '800',
                      letterSpacing: 2,
                      marginVertical: 6,
                    }}
                  >
                    {groupDetails?.joinCode || activeRoom?.data?.joinCode || 'STUDIFY'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => {
                        const code = groupDetails?.joinCode || activeRoom?.data?.joinCode;
                        triggerHaptic('success');
                        Alert.alert('Invite Code', `Share this code with your classmates: ${code}`);
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: theme.waTeal,
                        paddingVertical: 8,
                        borderRadius: 6,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Share Code</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        const code = groupDetails?.joinCode || activeRoom?.data?.joinCode;
                        triggerHaptic('success');
                        Alert.alert(
                          'Invite Link',
                          `Share this link: https://studify-dcq6.onrender.com/join-group/${code}`
                        );
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: `${theme.waTeal}30`,
                        borderColor: theme.waTeal,
                        borderWidth: 1,
                        paddingVertical: 8,
                        borderRadius: 6,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: theme.waTeal, fontSize: 12, fontWeight: '700' }}>Copy Link</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Add Participants Button for Owner/Mod */}
                {(groupDetails?.ownerId === user?.id ||
                  groupMembersList.some((m) => (m.userId === user?.id || m.user?.id === user?.id) && m.role === 'MODERATOR')) && (
                  <TouchableOpacity
                    onPress={() => {
                      setGroupInfoModalVisible(false);
                      setAddMembersModalVisible(true);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}15`,
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
                      + Add Participants to Circle
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Enrolled Participants List */}
                <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 }}>
                  Participants ({groupMembersList.length})
                </Text>
                {groupMembersList.map((mem) => {
                  const u = mem.user || mem;
                  const isOwner = mem.role === 'OWNER' || groupDetails?.ownerId === u.id;
                  return (
                    <View
                      key={mem.id || u.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomColor: theme.cardBorder,
                        borderBottomWidth: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: `${theme.primary}20`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}
                      >
                        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>
                          {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                          {u.name || u.username} {u.id === user?.id ? '(You)' : ''}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                          {u.username ? `@${u.username}` : (u.email || 'Participant')}
                        </Text>
                      </View>
                      {isOwner && (
                        <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: '#EAB308', fontSize: 10, fontWeight: '800' }}>OWNER</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Leave Group Action */}
                <TouchableOpacity
                  onPress={() => {
                    setGroupInfoModalVisible(false);
                    Alert.alert('Leave Circle', 'Are you sure you want to leave this circle?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Leave',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await apiClient.delete(`/groups/${activeRoom.data.id}/members/${user?.id}`);
                            setActiveRoom(null);
                            loadAllChats();
                          } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Could not leave circle.');
                          }
                        },
                      },
                    ]);
                  }}
                  style={{
                    paddingVertical: 12,
                    alignItems: 'center',
                    marginTop: 20,
                  }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>
                    Exit Study Circle
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Add Members to Existing Group */}
      <Modal visible={addMembersModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>Add Participants</Text>
              <TouchableOpacity onPress={() => setAddMembersModalVisible(false)}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.userSearchInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
              placeholder="Search classmates to add..."
              placeholderTextColor={theme.textMuted}
              value={groupUserSearchQuery}
              onChangeText={handleSearchGroupUsers}
            />

            <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
              {searchingGroupUsers ? (
                <ActivityIndicator color={theme.waTeal} style={{ marginVertical: 8 }} />
              ) : (
                groupUserSearchResults.map((usr) => {
                  const isSelected = addMembersSelected.some((m) => m.id === usr.id);
                  return (
                    <TouchableOpacity
                      key={usr.id}
                      onPress={() => {
                        setAddMembersSelected((prev) =>
                          prev.some((m) => m.id === usr.id)
                            ? prev.filter((m) => m.id !== usr.id)
                            : [...prev, usr]
                        );
                      }}
                      style={[
                        styles.searchUserRow,
                        {
                          borderColor: theme.cardBorder,
                          backgroundColor: isSelected ? `${theme.waTeal}15` : 'transparent',
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.searchUserName, { color: theme.text }]}>
                          {usr.name || usr.username}
                        </Text>
                        <Text style={[styles.searchUserMeta, { color: theme.textMuted }]}>
                          {usr.username ? `@${usr.username}` : usr.email}
                        </Text>
                      </View>
                      <Text style={{ color: isSelected ? theme.waTeal : theme.textMuted, fontSize: 12, fontWeight: '700' }}>
                        {isSelected ? '✓ Added' : '+ Add'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              disabled={addingMembers || addMembersSelected.length === 0}
              onPress={handleAddMembersToExistingGroup}
              style={[
                styles.createGroupBtn,
                {
                  backgroundColor: theme.waTeal,
                  opacity: addMembersSelected.length === 0 ? 0.5 : 1,
                },
              ]}
            >
              {addingMembers ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.createGroupBtnText}>
                  Confirm Add ({addMembersSelected.length})
                </Text>
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
  roomOnlineBadge: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: 0,
    right: 0,
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
  roomMoreBtn: {
    padding: 6,
    marginLeft: 6,
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
