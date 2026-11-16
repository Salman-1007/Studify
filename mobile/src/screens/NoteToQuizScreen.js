import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';
import { normalizeQuestion } from '../utils/quizUtils';

export default function NoteToQuizScreen({ onQuizCreated, onBack }) {
  const { theme } = useTheme();

  const [pickedFile, setPickedFile] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [numQuestions, setNumQuestions] = useState(10);
  const [generating, setGenerating] = useState(false);

  // Generated Quiz state
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // Fetch teacher classrooms to allow direct assigning
  useEffect(() => {
    apiClient
      .get('/teacher/classrooms')
      .then((res) => {
        const clsList = res.data?.data?.classrooms || res.data?.data || [];
        setClassrooms(clsList);
        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // 1. Pick PDF / DOCX / TXT Document
  const handlePickDocument = async () => {
    try {
      triggerHaptic('light');
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setPickedFile(file);
        if (!topic) {
          setTopic(file.name.replace(/\.[^/.]+$/, ''));
        }
        triggerHaptic('success');
      }
    } catch (err) {
      console.warn('Doc picker error:', err);
    }
  };

  // 2. Generate Quiz using live backend AI
  const handleGenerateQuiz = async () => {
    if (!pickedFile && !noteText.trim() && !topic.trim()) {
      Alert.alert('Content Required', 'Please pick a file, paste notes, or enter a topic.');
      triggerHaptic('warning');
      return;
    }

    try {
      setGenerating(true);
      triggerHaptic('medium');

      let res;
      if (pickedFile) {
        const formData = new FormData();
        formData.append('file', {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType || 'application/pdf',
        });
        formData.append('topic', topic || pickedFile.name);
        formData.append('subject', subject);
        formData.append('difficulty', difficulty);
        formData.append('numQuestions', String(numQuestions));

        res = await apiClient.post('/teacher/quizzes/generate-from-notes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await apiClient.post('/teacher/quizzes/generate-from-notes', {
          materialText: noteText,
          topic: topic || 'Classroom Review',
          subject,
          difficulty,
          numQuestions,
        });
      }

      const quizData = res.data?.data?.quiz || res.data?.data;
      setGeneratedQuiz(quizData);
      triggerHaptic('success');
      Alert.alert('Quiz Generated! ✨', `AI created ${quizData?.questions?.length || numQuestions} verified questions.`);
    } catch (err) {
      Alert.alert('Generation Error', err.response?.data?.message || 'Could not generate quiz from notes.');
    } finally {
      setGenerating(false);
    }
  };

  // 3. Assign Quiz to Classroom
  const handleAssignToClass = async () => {
    if (!generatedQuiz?.id || !selectedClassId) return;
    try {
      setAssigning(true);
      triggerHaptic('medium');

      await apiClient.post(`/teacher/quizzes/${generatedQuiz.id}/assign`, {
        classroomIds: [selectedClassId],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        passingScore: 50,
      });

      triggerHaptic('success');
      Alert.alert('Assigned! 📢', 'The quiz has been assigned to your classroom with push notifications sent to students.');
      if (onQuizCreated) onQuizCreated();
    } catch (err) {
      Alert.alert('Assign Error', err.response?.data?.message || 'Failed to assign quiz to class.');
    } finally {
      setAssigning(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Generated Quiz Preview & Publish
  // ----------------------------------------------------
  if (generatedQuiz) {
    const qList = generatedQuiz.questions || [];
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Generated Quiz Preview"
          subtitle={`${qList.length} Questions Created`}
          showBack
          onBack={() => setGeneratedQuiz(null)}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Quiz Header Card */}
          <View style={[styles.quizHeroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.quizHeroTitle, { color: theme.text }]}>{generatedQuiz.title}</Text>
            <Text style={[styles.quizHeroMeta, { color: theme.textMuted }]}>
              {generatedQuiz.subject || subject} • {generatedQuiz.difficulty || difficulty} • {qList.length} MCQs
            </Text>
          </View>

          {/* Assign to Classroom Box */}
          {classrooms.length > 0 && (
            <View style={[styles.assignBox, { backgroundColor: theme.card, borderColor: `${theme.primary}50` }]}>
              <Text style={[styles.assignTitle, { color: theme.text }]}>Assign to Classroom</Text>
              <Text style={[styles.assignSub, { color: theme.textMuted }]}>
                Select which digital class will receive this assessment:
              </Text>

              <View style={styles.classChipsRow}>
                {classrooms.map((cls) => {
                  const isSelected = selectedClassId === cls.id;
                  return (
                    <TouchableOpacity
                      key={cls.id}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSelectedClassId(cls.id);
                      }}
                      style={[
                        styles.classChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.cardHover,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.classChipText, { color: isSelected ? '#FFF' : theme.textSecondary }]}>
                        {cls.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                disabled={assigning}
                onPress={handleAssignToClass}
                style={[styles.assignSubmitBtn, { backgroundColor: theme.primary }]}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.assignSubmitBtnText}>Publish to Classroom & Alert Students →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Questions Preview List */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Questions Breakdown</Text>

          {qList.map((rawQ, idx) => {
            const q = normalizeQuestion(rawQ);
            return (
              <View
                key={q.id || idx}
                style={[styles.questionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <Text style={[styles.questionNumber, { color: theme.primary }]}>Question {idx + 1}</Text>
                <Text style={[styles.questionText, { color: theme.text }]}>{q.questionText || q.question}</Text>

                <View style={styles.optionsGrid}>
                  {(q.options || []).map((opt) => {
                    const optText = opt.text || opt;
                    const optKey = opt.key;
                    const isCorrect = String(optKey) === String(q.correctAnswer) || String(optText) === String(q.correctAnswer);
                    return (
                      <View
                        key={optKey}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: isCorrect ? `${theme.success}18` : theme.cardHover,
                            borderColor: isCorrect ? theme.success : theme.cardBorder,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, color: isCorrect ? theme.success : theme.textSecondary, fontWeight: isCorrect ? '700' : '400' }}>
                          {optKey}. {optText} {isCorrect ? '✓' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {q.explanation ? (
                  <Text style={[styles.explanationText, { color: theme.textMuted }]}>
                    💡 {q.explanation}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Input Form (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Note-to-Quiz AI"
        subtitle="Turn Teacher Notes into Verified Tests"
        showBack={Boolean(onBack)}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Document Upload Hero */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePickDocument}
          style={[styles.pickDocHero, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📄</Text>
          <Text style={[styles.pickDocTitle, { color: theme.text }]}>
            {pickedFile ? pickedFile.name : 'Upload Lecture Notes or Textbook Chapter'}
          </Text>
          <Text style={[styles.pickDocSub, { color: theme.textMuted }]}>
            {pickedFile ? 'Document attached. Ready to extract MCQs.' : 'Tap to pick PDF, DOCX, or TXT file'}
          </Text>
        </TouchableOpacity>

        {/* Or Paste Raw Notes */}
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Or Paste Raw Lecture / Syllabus Notes</Text>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
          ]}
          placeholder="Paste lecture key points, definitions, or textbook paragraphs here..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={5}
          value={noteText}
          onChangeText={setNoteText}
        />

        {/* Configuration Row */}
        <View style={styles.configRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Topic / Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Newton Laws of Motion"
              placeholderTextColor={theme.textMuted}
              value={topic}
              onChangeText={setTopic}
            />
          </View>
        </View>

        <View style={styles.configRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Subject</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="Physics, Chemistry, Biology..."
              placeholderTextColor={theme.textMuted}
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={{ width: 120 }}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Questions</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, textAlign: 'center' }]}
              keyboardType="number-pad"
              value={String(numQuestions)}
              onChangeText={(v) => setNumQuestions(Number(v) || 10)}
            />
          </View>
        </View>

        {/* Difficulty Chips */}
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Target Difficulty</Text>
        <View style={styles.diffRow}>
          {['EASY', 'MEDIUM', 'HARD'].map((d) => {
            const isSel = difficulty === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  triggerHaptic('selection');
                  setDifficulty(d);
                }}
                style={[
                  styles.diffChip,
                  {
                    backgroundColor: isSel ? theme.primary : theme.card,
                    borderColor: isSel ? theme.primary : theme.cardBorder,
                  },
                ]}
              >
                <Text style={{ color: isSel ? '#FFF' : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          disabled={generating}
          activeOpacity={0.8}
          onPress={handleGenerateQuiz}
          style={[styles.generateBtn, { backgroundColor: theme.primary }]}
        >
          {generating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.generateBtnText}>Extracting Concepts & Generating MCQs...</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>Generate Assessment with AI ✨</Text>
          )}
        </TouchableOpacity>
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
  pickDocHero: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  pickDocTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  pickDocSub: {
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textArea: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  configRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  diffRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  diffChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  generateBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Preview Styles
  quizHeroCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  quizHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  quizHeroMeta: {
    fontSize: 12,
  },
  assignBox: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  assignTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  assignSub: {
    fontSize: 12,
    marginBottom: 12,
  },
  classChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assignSubmitBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  assignSubmitBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  questionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionsGrid: {
    gap: 6,
    marginBottom: 8,
  },
  optionPill: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});
