import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function MentorScreen({ onBack }) {
  const { theme } = useTheme();

  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'As-salamu alaykum! I am your 24/7 Studify AI Mentor, trained on the Pakistani Federal (FBISE), Punjab Board (PTB), and National MDCAT & ECAT syllabi. How can I help your studies today?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  const scrollViewRef = useRef(null);

  const promptSuggestions = [
    { label: '🩺 MDCAT Biology', text: 'Explain the high-yield stages of the Krebs Cycle and ATP yield.' },
    { label: '⚡ 10th/12th Physics', text: 'Derive the formula for Lenz’s law and electromagnetic induction with examples.' },
    { label: '🧪 Organic Chemistry', text: 'Explain the difference in oxidation between Aldehydes and Ketones.' },
    { label: '📐 ECAT Mathematics', text: 'Show step-by-step methods to solve Integration by Parts quickly.' },
  ];

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    setInputText('');
    triggerHaptic('light');

    const userMsg = {
      id: String(Date.now()),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', {
        conversationId,
        message: query,
      });

      const reply = res.data?.data?.message;
      if (res.data?.data?.conversationId) {
        setConversationId(res.data.data.conversationId);
      }

      if (reply) {
        setMessages((prev) => [...prev, reply]);
        triggerHaptic('selection');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'I could not generate a response at this moment. Please check your connection and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    triggerHaptic('selection');
    setMessages([
      {
        id: String(Date.now()),
        role: 'assistant',
        content: 'Conversation reset. What Pakistani board or entry test topic would you like to explore next?',
      },
    ]);
    setConversationId(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="AI Mentor"
        subtitle="24/7 Pakistan Curriculum Tutor"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity onPress={handleClearChat} style={[styles.clearBtn, { backgroundColor: theme.cardHover }]}>
            <Text style={[styles.clearBtnText, { color: theme.textMuted }]}>Reset</Text>
          </TouchableOpacity>
        }
      />

      {/* Suggestion Chips */}
      <View style={[styles.suggestionsContainer, { backgroundColor: theme.cardHover }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {promptSuggestions.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSendMessage(item.text)}
              style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Text style={[styles.chipText, { color: theme.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesScroll}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                isUser
                  ? [styles.userBubble, { backgroundColor: theme.primary }]
                  : [styles.assistantBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
              ]}
            >
              {!isUser && (
                <View style={styles.assistantHeader}>
                  <Text style={styles.mentorIcon}>🤖</Text>
                  <Text style={[styles.mentorName, { color: theme.primary }]}>Studify Mentor</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, { color: isUser ? '#FFF' : theme.text }]}>{m.content}</Text>
            </View>
          );
        })}

        {loading && (
          <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>Thinking step-by-step...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
        <TextInput
          style={[styles.inputField, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
          placeholder="Ask a question or explain a formula..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSendMessage()}
        />
        <TouchableOpacity
          disabled={!inputText.trim() || loading}
          onPress={() => handleSendMessage()}
          style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: !inputText.trim() ? 0.5 : 1 }]}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionsContainer: {
    paddingVertical: 8,
  },
  chipsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messagesScroll: {
    padding: 16,
    paddingBottom: 24,
  },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  mentorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  mentorName: {
    fontSize: 12,
    fontWeight: '800',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
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
