import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function MaterialsScreen({ onBack }) {
  const { theme } = useTheme();

  // Screen modes: 'list' | 'detail' | 'chat'
  const [viewMode, setViewMode] = useState('list');

  // Materials List State
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Active Selected Material
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [summary, setSummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);

  // Document Grounded Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  // Load Materials from API
  const loadMaterials = useCallback(async () => {
    try {
      const res = await apiClient.get('/materials');
      setMaterials(res.data?.data?.materials || []);
    } catch (err) {
      console.warn('[Materials] Error fetching list:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Pick Document & Upload
  const handlePickAndUpload = async () => {
    try {
      triggerHaptic('light');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      setUploading(true);

      const formData = new FormData();
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('category', 'Study Notes');

      // Native FormData file representation
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/pdf',
      });

      await apiClient.post('/materials', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      triggerHaptic('success');
      Alert.alert('Upload Complete', `${file.name} has been processed and is ready for AI analysis.`);
      loadMaterials();
    } catch (err) {
      Alert.alert('Upload Error', err.response?.data?.message || 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  // Select Material to View Details
  const handleSelectMaterial = (item) => {
    triggerHaptic('selection');
    setSelectedMaterial(item);
    setSummary(null);
    setChatMessages([]);
    setConversationId(null);
    setViewMode('detail');
  };

  // Generate AI Summary
  const handleGenerateSummary = async () => {
    if (!selectedMaterial) return;
    try {
      triggerHaptic('medium');
      setGeneratingSummary(true);
      const res = await apiClient.post('/ai/summarize', {
        materialId: selectedMaterial.id,
      });
      setSummary(res.data?.data?.summary);
      triggerHaptic('success');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not generate summary.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Generate Flashcards from Document
  const handleGenerateFlashcards = async () => {
    if (!selectedMaterial) return;
    try {
      triggerHaptic('medium');
      setGeneratingFlashcards(true);
      await apiClient.post('/ai/generate-flashcards', {
        materialId: selectedMaterial.id,
        topic: selectedMaterial.title,
        numCards: 10,
      });
      triggerHaptic('success');
      Alert.alert('Success! 🗂️', `Created a new 10-card Flashcard deck from "${selectedMaterial.title}". You can study it in the Flashcards section.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to generate flashcards.');
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  // Generate Practice Quiz from Document
  const handleGenerateQuiz = async () => {
    if (!selectedMaterial) return;
    try {
      triggerHaptic('medium');
      setGeneratingQuiz(true);
      await apiClient.post('/ai/generate-quiz', {
        materialId: selectedMaterial.id,
        topic: selectedMaterial.title,
        difficulty: 'MEDIUM',
        numQuestions: 10,
      });
      triggerHaptic('success');
      Alert.alert('Quiz Ready! 📝', `Created a 10-question test from "${selectedMaterial.title}". Available in your practice pool.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to generate quiz.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // Send message in Grounded Document Chat
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || sendingChat) return;
    const userText = chatInput.trim();
    setChatInput('');
    triggerHaptic('light');

    const tempMsg = {
      id: String(Date.now()),
      role: 'user',
      content: userText,
    };
    setChatMessages((prev) => [...prev, tempMsg]);
    setSendingChat(true);

    try {
      const res = await apiClient.post('/ai/chat', {
        conversationId,
        materialId: selectedMaterial?.id,
        message: userText,
      });

      const reply = res.data?.data?.message;
      if (res.data?.data?.conversationId) {
        setConversationId(res.data.data.conversationId);
      }

      if (reply) {
        setChatMessages((prev) => [...prev, reply]);
        triggerHaptic('selection');
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'I could not process this document query right now. Please try again.',
        },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Document Q&A Chat
  // ----------------------------------------------------
  if (viewMode === 'chat' && selectedMaterial) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Document Q&A"
          subtitle={selectedMaterial.title}
          showBack
          onBack={() => setViewMode('detail')}
        />

        <ScrollView contentContainerStyle={styles.chatScroll}>
          {chatMessages.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={[styles.emptyHeadline, { color: theme.text }]}>Chat Grounded on Document</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Ask any question about the concepts, formulas, or facts in "{selectedMaterial.title}".
              </Text>
            </View>
          ) : (
            chatMessages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <View
                  key={m.id}
                  style={[
                    styles.chatBubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: theme.primary }]
                      : [styles.assistantBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
                  ]}
                >
                  <Text style={[styles.chatText, { color: isUser ? '#FFF' : theme.text }]}>{m.content}</Text>
                </View>
              );
            })
          )}
          {sendingChat && (
            <View style={[styles.chatBubble, styles.assistantBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          )}
        </ScrollView>

        <View style={[styles.chatInputBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.inputField, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.inputBorder }]}
            placeholder="Ask about this document..."
            placeholderTextColor={theme.textMuted}
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleSendChatMessage}
          />
          <TouchableOpacity
            disabled={!chatInput.trim() || sendingChat}
            onPress={handleSendChatMessage}
            style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: !chatInput.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Material Detail & AI Actions
  // ----------------------------------------------------
  if (viewMode === 'detail' && selectedMaterial) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={selectedMaterial.title}
          subtitle="Document AI Intelligence"
          showBack
          onBack={() => setViewMode('list')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Document Info Card */}
          <View style={[styles.docHeroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>📄</Text>
            <Text style={[styles.docHeroTitle, { color: theme.text }]}>{selectedMaterial.title}</Text>
            <Text style={[styles.docHeroCategory, { color: theme.primary }]}>
              {selectedMaterial.category || 'Study Material'}
            </Text>
            <Text style={[styles.docHeroDate, { color: theme.textMuted }]}>
              Uploaded {new Date(selectedMaterial.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {/* AI Capabilities Hub */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>AI Document Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              disabled={generatingSummary}
              onPress={handleGenerateSummary}
              style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Text style={styles.actionIcon}>💡</Text>
              <Text style={[styles.actionTitle, { color: theme.text }]}>AI Summary</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>Key takeaways & bulleted review</Text>
              {generatingSummary && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 8 }} />}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={generatingFlashcards}
              onPress={handleGenerateFlashcards}
              style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Text style={styles.actionIcon}>🗂️</Text>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Make Flashcards</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>Auto-generate SRS study cards</Text>
              {generatingFlashcards && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 8 }} />}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={generatingQuiz}
              onPress={handleGenerateQuiz}
              style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Generate Quiz</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>10-question practice test</Text>
              {generatingQuiz && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 8 }} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('chat')}
              style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Document Q&A</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>Chat directly with this file</Text>
            </TouchableOpacity>
          </View>

          {/* Render Summary if generated */}
          {summary && (
            <View style={[styles.summaryBox, { backgroundColor: theme.card, borderColor: `${theme.primary}50` }]}>
              <Text style={[styles.summaryTitle, { color: theme.primary }]}>📋 AI Executive Summary</Text>
              <Text style={[styles.summaryBody, { color: theme.textSecondary }]}>{summary}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Materials List (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Study Materials"
        subtitle="Notes, Handouts & AI Intelligence"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity
            disabled={uploading}
            onPress={handlePickAndUpload}
            style={[styles.uploadHeaderBtn, { backgroundColor: theme.primary }]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.uploadHeaderBtnText}>+ Upload</Text>
            )}
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
              loadMaterials();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Upload Callout Hero */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={uploading}
          onPress={handlePickAndUpload}
          style={[styles.uploadHero, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}40` }]}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📤</Text>
          <Text style={[styles.uploadHeroTitle, { color: theme.text }]}>Upload Class Notes or PDFs</Text>
          <Text style={[styles.uploadHeroSub, { color: theme.textMuted }]}>
            Supports PDF, DOCX, TXT files. AI extracts notes, creates flashcards, and builds custom quizzes.
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeading, { color: theme.text }]}>Your Uploaded Documents</Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : materials.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📚</Text>
            <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Study Materials Yet</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Tap the "+ Upload" button above to upload lecture slides, PDF chapters, or handwritten notes.
            </Text>
          </View>
        ) : (
          materials.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => handleSelectMaterial(item)}
              style={[styles.materialCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={[styles.fileIconBox, { backgroundColor: `${theme.primary}20` }]}>
                <Text style={styles.fileIcon}>📄</Text>
              </View>
              <View style={styles.materialInfo}>
                <Text style={[styles.materialTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.materialMeta, { color: theme.textMuted }]}>
                  {item.category || 'General Notes'} • {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.arrowIcon, { color: theme.textMuted }]}>→</Text>
            </TouchableOpacity>
          ))
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
  uploadHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  uploadHeaderBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadHero: {
    padding: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  uploadHeroSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  fileIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIcon: {
    fontSize: 20,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  materialMeta: {
    fontSize: 11,
  },
  arrowIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
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

  // Detail & Action Styles
  docHeroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  docHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  docHeroCategory: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  docHeroDate: {
    fontSize: 11,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  summaryBox: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  summaryBody: {
    fontSize: 13,
    lineHeight: 20,
  },

  // Chat Styles
  chatScroll: {
    padding: 16,
    paddingBottom: 24,
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
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
  chatText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatInputBar: {
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
