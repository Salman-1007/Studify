import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient, { SOCKET_URL } from '../api/client';
import { triggerHaptic } from '../utils/haptics';

import { getChatPartner } from './WhatsAppChatsScreen';

export default function DirectChatScreen({ onBack }) {
  const { user, token } = useAuth();
  const { theme } = useTheme();

  // Screen modes: 'inbox' | 'search' | 'room'
  const [viewMode, setViewMode] = useState('inbox');

  // Inbox state
  const [conversations, setConversations] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search users state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Active chat room state
  const [activeChat, setActiveChat] = useState(null);
  const [partnerUser, setPartnerUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const socketRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Load active 1-on-1 conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await apiClient.get('/direct-chats');
      setConversations(res.data?.data?.chats || res.data?.data || []);
    } catch (err) {
      console.warn('[DirectChat] Inbox error:', err.message);
    } finally {
      setLoadingInbox(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Connect socket for real-time messages
  useEffect(() => {
    if (!token) return;

    try {
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('direct:message', (newMsg) => {
        if (activeChat && newMsg.chatId === activeChat.id) {
          setMessages((prev) => [...prev, newMsg]);
          triggerHaptic('selection');
        }
        // Update inbox preview in background
        loadConversations();
      });

      return () => {
        socket.disconnect();
      };
    } catch {
      // Fallback to REST polling
    }
  }, [token, activeChat, loadConversations]);

  // Search platform users
  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const res = await apiClient.get('/direct-chats/search-users', {
        params: { q: query },
      });
      setSearchResults(res.data?.data?.users || res.data?.data || []);
    } catch (err) {
      console.warn('[DirectChat] Search error:', err.message);
    } finally {
      setSearching(false);
    }
  };

  // Start chat with user from search
  const handleInitiateChat = async (targetUser) => {
    try {
      triggerHaptic('medium');
      const res = await apiClient.post('/direct-chats/request', {
        recipientId: targetUser.id,
        targetUserId: targetUser.id,
      });

      const chatData = res.data?.data?.chat || res.data?.data;
      const partner = getChatPartner({ ...chatData, partner: targetUser }, user?.id);
      setPartnerUser(partner);
      setActiveChat(chatData);
      setMessages([]);
      setViewMode('room');

      // Fetch messages for this chat
      if (chatData?.id) {
        const msgRes = await apiClient.get(`/direct-chats/${chatData.id}/messages`).catch(() => null);
        if (msgRes?.data?.data?.messages) {
          setMessages(msgRes.data.data.messages);
        }
      }
    } catch (err) {
      console.warn('[DirectChat] Initiate chat error:', err.message);
    }
  };

  // Open existing chat room
  const handleOpenChat = async (chat) => {
    try {
      triggerHaptic('selection');
      const otherUser = getChatPartner(chat, user?.id);

      setPartnerUser(otherUser);
      setActiveChat(chat);
      setViewMode('room');

      const res = await apiClient.get(`/direct-chats/${chat.id}/messages`);
      setMessages(res.data?.data?.messages || []);

      // Mark read
      apiClient.post(`/direct-chats/${chat.id}/read`).catch(() => {});
    } catch (err) {
      console.warn('[DirectChat] Open chat error:', err.message);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || sendingMessage || !activeChat) return;
    const content = inputText.trim();
    setInputText('');
    triggerHaptic('light');

    const optimisticMsg = {
      id: String(Date.now()),
      senderId: user?.id,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSendingMessage(true);

    try {
      await apiClient.post(`/direct-chats/${activeChat.id}/messages`, { content });
    } catch (err) {
      console.warn('[DirectChat] Send error:', err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Active Chat Room
  // ----------------------------------------------------
  if (viewMode === 'room' && partnerUser) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header
          title={partnerUser.name || 'Direct Chat'}
          subtitle={partnerUser.institution || partnerUser.grade ? `Class ${partnerUser.grade || ''}` : 'Active Conversation'}
          showBack
          onBack={() => {
            setViewMode('inbox');
            loadConversations();
          }}
        />

        <ScrollView
          ref={chatScrollRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>👋</Text>
              <Text style={[styles.emptyHeadline, { color: theme.text }]}>Say Hello!</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Messages are private and push notifications are delivered instantly.
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === user?.id;
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
                  <Text style={[styles.msgText, { color: isMe ? '#FFF' : theme.text }]}>{m.content}</Text>
                  <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.inputField, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            disabled={!inputText.trim() || sendingMessage}
            onPress={handleSendMessage}
            style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: !inputText.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ----------------------------------------------------
  // RENDER: Search Users View
  // ----------------------------------------------------
  if (viewMode === 'search') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="New Direct Message"
          subtitle="Search Students & Teachers"
          showBack
          onBack={() => setViewMode('inbox')}
        />

        <View style={styles.searchBarContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.cardBorder }]}
            placeholder="Search by name or email..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={handleSearchUsers}
            autoFocus
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {searching ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Users Found</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Try searching with another spelling or full email address.
              </Text>
            </View>
          ) : (
            searchResults.map((usr) => (
              <TouchableOpacity
                key={usr.id}
                onPress={() => handleInitiateChat(usr)}
                style={[styles.userResultCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: `${theme.primary}25` }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {(usr.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.text }]}>{usr.name}</Text>
                  <Text style={[styles.userMeta, { color: theme.textMuted }]}>
                    {usr.institution || `Class ${usr.grade || 'Student'}`}
                  </Text>
                </View>
                <Text style={[styles.chatActionIcon, { color: theme.primary }]}>💬</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Conversations Inbox (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Direct Messages"
        subtitle="1-on-1 Discussions & Push Alerts"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity
            onPress={() => setViewMode('search')}
            style={[styles.newChatBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.newChatBtnText}>+ New Chat</Text>
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
              loadConversations();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {loadingInbox ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : conversations.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>💬</Text>
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Conversations Yet</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Connect with classmates or teachers to discuss MDCAT, ECAT, or board exam preparation.
            </Text>
            <TouchableOpacity
              onPress={() => setViewMode('search')}
              style={[styles.startChatBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.startChatBtnText}>Start a Conversation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          conversations.map((chat) => {
            const otherUser = getChatPartner(chat, user?.id);

            const lastMessage = chat.lastMessage || chat.messages?.[0];

            return (
              <TouchableOpacity
                key={chat.id}
                activeOpacity={0.7}
                onPress={() => handleOpenChat(chat)}
                style={[styles.convCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: `${theme.primary}25` }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {otherUser.fallbackInitial}
                  </Text>
                </View>

                <View style={styles.convInfo}>
                  <View style={styles.convHeaderRow}>
                    <Text style={[styles.convName, { color: theme.text }]}>{otherUser.displayName}</Text>
                    {lastMessage && (
                      <Text style={[styles.convTime, { color: theme.textMuted }]}>
                        {new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                  <Text numberOfLines={1} style={[styles.convLastMsg, { color: theme.textSecondary }]}>
                    {lastMessage?.content || 'Tap to start conversation'}
                  </Text>
                </View>

                {chat.unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.unreadBadgeText}>{chat.unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
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
  newChatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newChatBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  userResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  chatActionIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  convInfo: {
    flex: 1,
  },
  convHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: {
    fontSize: 15,
    fontWeight: '700',
  },
  convTime: {
    fontSize: 11,
  },
  convLastMsg: {
    fontSize: 13,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 18,
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
    marginBottom: 20,
  },
  startChatBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startChatBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Room Styles
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
});
