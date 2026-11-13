import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import { SOCKET_URL } from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function ChatScreen({ targetClassroom = null, onBack }) {
  const { user, token } = useAuth();
  const { theme } = useTheme();

  const [messages, setMessages] = useState([
    {
      id: 'm1',
      senderId: 'bot',
      senderName: 'Studify Bot',
      content: 'Welcome to the classroom discussion! All announcements and questions will appear here.',
      createdAt: new Date().toISOString(),
      isMe: false,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    try {
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        if (targetClassroom?.groupId) {
          socket.emit('group:join', { groupId: targetClassroom.groupId });
        }
      });

      socket.on('disconnect', () => {
        setConnected(false);
      });

      socket.on('group:message', (newMsg) => {
        setMessages((prev) => [
          ...prev,
          {
            id: newMsg.id || String(Date.now()),
            senderId: newMsg.senderId,
            senderName: newMsg.sender?.name || 'Class Member',
            content: newMsg.content,
            createdAt: newMsg.createdAt,
            isMe: newMsg.senderId === user?.id,
          },
        ]);
        triggerHaptic('selection');
      });

      return () => {
        socket.disconnect();
      };
    } catch {
      // Fallback
    }
  }, [token, targetClassroom, user]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    triggerHaptic('light');

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      senderId: user?.id,
      senderName: user?.name || 'Me',
      content: trimmed,
      createdAt: new Date().toISOString(),
      isMe: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');

    if (socketRef.current?.connected && targetClassroom?.groupId) {
      socketRef.current.emit(
        'group:message',
        {
          groupId: targetClassroom.groupId,
          content: trimmed,
          messageType: 'TEXT',
        },
        (ack) => {
          if (!ack?.success) {
            console.warn('Socket message ack failed:', ack?.message);
          }
        }
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Header
        title={targetClassroom ? targetClassroom.name : 'Classroom Discussion'}
        subtitle={connected ? '🟢 Connected Live' : '⚪ Offline Discussion Mode'}
        rightElement={
          onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={[styles.backBtn, { backgroundColor: theme.cardBorder }]}
            >
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          return (
            <View
              style={[
                styles.messageRow,
                item.isMe ? styles.messageRowMe : styles.messageRowOther,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  item.isMe
                    ? [styles.bubbleMe, { backgroundColor: theme.primary }]
                    : [
                        styles.bubbleOther,
                        { backgroundColor: theme.card, borderColor: theme.cardBorder },
                      ],
                ]}
              >
                {!item.isMe ? (
                  <Text style={[styles.senderLabel, { color: theme.primary }]}>
                    {item.senderName}
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.messageText,
                    { color: item.isMe ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {item.content}
                </Text>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: item.isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted },
                  ]}
                >
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.cardBorder,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              color: theme.text,
            },
          ]}
          placeholder="Ask a question or reply..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() ? theme.primary : theme.cardBorder },
          ]}
          disabled={!inputText.trim()}
          onPress={handleSend}
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeLabel: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
