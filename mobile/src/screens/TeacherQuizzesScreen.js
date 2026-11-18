import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';
import {
  BookOpenIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  SparklesIcon,
  KeyIcon,
} from '../components/Icons';

const createEmptyQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 'A',
  explanation: '',
});

export default function TeacherQuizzesScreen({ onBack, onNavigateClassrooms: _onNavigateClassrooms, onNavigateBank }) {
  const { theme } = useTheme();

  // Primary mode: 'library' | 'builder'
  const [activeView, setActiveView] = useState('library');

  // Library State
  const [quizzes, setQuizzes] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'DRAFT' | 'PUBLISHED'

  // Assign Modal State
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [targetClassroomIds, setTargetClassroomIds] = useState([]);
  const [assignDuration, setAssignDuration] = useState('15');
  const [assignMaxAttempts, setAssignMaxAttempts] = useState('1');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Builder State
  const [builderMode, setBuilderMode] = useState('MANUAL'); // 'MANUAL' | 'BANK' | 'AI'
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderSubject, setBuilderSubject] = useState('');
  const [builderTopic, setBuilderTopic] = useState('');
  const [builderDifficulty, setBuilderDifficulty] = useState('MEDIUM');
  const [builderQuestions, setBuilderQuestions] = useState([createEmptyQuestion()]);
  const [savingQuiz, setSavingQuiz] = useState(false);

  // Bank Generator State
  const [bankGrade, setBankGrade] = useState('10');
  const [bankSubjects, setBankSubjects] = useState([]);
  const [selectedBankSubject, setSelectedBankSubject] = useState(null);
  const [loadingBankSubjects, setLoadingBankSubjects] = useState(false);
  const [bankChapters, setBankChapters] = useState([]);
  const [selectedBankChapter, setSelectedBankChapter] = useState(null);
  const [loadingBankChapters, setLoadingBankChapters] = useState(false);
  const [bankCount, setBankCount] = useState('10');
  const [bankDifficulty, setBankDifficulty] = useState('MIXED');
  const [generatingBank, setGeneratingBank] = useState(false);

  // AI Generator State
  const [aiNotesText, setAiNotesText] = useState('');
  const [aiCount] = useState('8');
  const [generatingAI, setGeneratingAI] = useState(false);

  // ----------------------------------------------------
  // Load Quizzes and Classrooms
  // ----------------------------------------------------
  const loadData = useCallback(async () => {
    try {
      const [quizRes, clsRes] = await Promise.allSettled([
        apiClient.get('/teacher/quizzes'),
        apiClient.get('/teacher/classrooms'),
      ]);

      if (quizRes.status === 'fulfilled') {
        const list = quizRes.value.data?.data?.quizzes || quizRes.value.data?.data || [];
        setQuizzes(list);
      }

      if (clsRes.status === 'fulfilled') {
        const clsList = clsRes.value.data?.data?.classrooms || clsRes.value.data?.data || [];
        setClassrooms(clsList);
      }
    } catch (err) {
      console.warn('[TeacherQuizzes] Load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    triggerHaptic('light');
    setRefreshing(true);
    loadData();
  };

  // ----------------------------------------------------
  // Load Curriculum Bank Subjects & Chapters
  // ----------------------------------------------------
  const loadBankChapters = useCallback(async (subjectId) => {
    if (!subjectId) {
      setBankChapters([]);
      setSelectedBankChapter(null);
      return;
    }
    try {
      setLoadingBankChapters(true);
      const res = await apiClient.get('/curriculum/chapters', { params: { subjectId } });
      const chs = res.data?.data?.chapters || res.data?.data || [];
      setBankChapters(chs);
      setSelectedBankChapter(null);
    } catch {
      setBankChapters([]);
      setSelectedBankChapter(null);
    } finally {
      setLoadingBankChapters(false);
    }
  }, []);

  const loadBankSubjects = useCallback(async (grade) => {
    try {
      setLoadingBankSubjects(true);
      const res = await apiClient.get('/curriculum/subjects', { params: { classGrade: grade || '10' } });
      const subs = res.data?.data?.subjects || res.data?.data || [];
      setBankSubjects(subs);
      if (subs.length > 0) {
        setSelectedBankSubject(subs[0]);
        loadBankChapters(subs[0].id);
      } else {
        setSelectedBankSubject(null);
        setBankChapters([]);
      }
    } catch (err) {
      console.warn('[TeacherQuizzes] Could not fetch bank subjects:', err.message);
      const fallback = [
        { id: 'sub-phy', name: 'Physics', subjectName: 'Physics' },
        { id: 'sub-chem', name: 'Chemistry', subjectName: 'Chemistry' },
        { id: 'sub-bio', name: 'Biology', subjectName: 'Biology' },
        { id: 'sub-math', name: 'Mathematics', subjectName: 'Mathematics' },
        { id: 'sub-eng', name: 'English', subjectName: 'English' },
      ];
      setBankSubjects(fallback);
      setSelectedBankSubject(fallback[0]);
      setBankChapters([]);
    } finally {
      setLoadingBankSubjects(false);
    }
  }, [loadBankChapters]);

  // Sync bank subjects whenever entering builder in BANK mode
  useEffect(() => {
    if (activeView === 'builder' && builderMode === 'BANK') {
      loadBankSubjects(bankGrade);
    }
  }, [activeView, builderMode, bankGrade, loadBankSubjects]);

  // ----------------------------------------------------
  // Assign Quiz to Classroom
  // ----------------------------------------------------
  const handleOpenAssignModal = (quiz) => {
    triggerHaptic('selection');
    setSelectedQuiz(quiz);
    setTargetClassroomIds(classrooms.slice(0, 1).map((c) => c.id));
    setAssignDuration('15');
    setAssignMaxAttempts('1');
    setAssignInstructions('');
    setAssignModalVisible(true);
  };

  const handleExecuteAssign = async () => {
    if (!selectedQuiz || targetClassroomIds.length === 0) {
      Alert.alert('Required', 'Please select at least one classroom.');
      return;
    }

    try {
      setAssigning(true);
      triggerHaptic('medium');
      const payload = {
        classroomIds: targetClassroomIds,
        title: selectedQuiz.title,
        instructions: assignInstructions.trim(),
        durationMins: parseInt(assignDuration, 10) || 15,
        maxAttempts: parseInt(assignMaxAttempts, 10) || 1,
        publishNow: true,
      };

      await apiClient.post(`/teacher/quizzes/${selectedQuiz.id}/assign`, payload);
      triggerHaptic('success');
      Alert.alert(
        'Quiz Assigned! 🚀',
        `Assigned successfully to ${targetClassroomIds.length} classroom(s). Students can now take the assessment.`
      );
      setAssignModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert('Assign Error', err.response?.data?.message || 'Failed to assign quiz.');
    } finally {
      setAssigning(false);
    }
  };

  // ----------------------------------------------------
  // Delete Quiz
  // ----------------------------------------------------
  const handleDeleteQuiz = (quiz) => {
    Alert.alert('Delete Quiz', `Are you sure you want to delete "${quiz.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            triggerHaptic('warning');
            await apiClient.delete(`/teacher/quizzes/${quiz.id}`);
            triggerHaptic('success');
            setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not delete quiz.');
          }
        },
      },
    ]);
  };

  // ----------------------------------------------------
  // Edit Existing Quiz
  // ----------------------------------------------------
  const handleStartEditQuiz = (quiz) => {
    triggerHaptic('selection');
    setEditingQuizId(quiz.id);
    setBuilderTitle(quiz.title || '');
    setBuilderSubject(quiz.subject || '');
    setBuilderTopic(quiz.topic || '');
    setBuilderDifficulty(quiz.difficulty || 'MEDIUM');

    if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      setBuilderQuestions(
        quiz.questions.map((q) => ({
          question: q.questionText || q.question || '',
          options: [
            q.optionA || q.options?.[0] || '',
            q.optionB || q.options?.[1] || '',
            q.optionC || q.options?.[2] || '',
            q.optionD || q.options?.[3] || '',
          ],
          correctAnswer: q.correctAnswer || 'A',
          explanation: q.explanation || '',
        }))
      );
    } else {
      setBuilderQuestions([createEmptyQuestion()]);
    }
    setActiveView('builder');
    setBuilderMode('MANUAL');
  };

  // ----------------------------------------------------
  // Builder: Add Question
  // ----------------------------------------------------
  const handleAddQuestion = () => {
    triggerHaptic('light');
    setBuilderQuestions((prev) => [...prev, createEmptyQuestion()]);
  };

  const handleUpdateQuestion = (index, field, value) => {
    setBuilderQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateOption = (qIdx, optIdx, val) => {
    setBuilderQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIdx].options];
      opts[optIdx] = val;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const handleRemoveQuestion = (index) => {
    if (builderQuestions.length <= 1) {
      Alert.alert('Notice', 'A quiz must have at least one question.');
      return;
    }
    triggerHaptic('warning');
    setBuilderQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // ----------------------------------------------------
  // Builder: Save / Publish Quiz
  // ----------------------------------------------------
  const handleSaveQuiz = async (status = 'DRAFT') => {
    if (!builderTitle.trim()) {
      Alert.alert('Required', 'Please enter a quiz title.');
      return;
    }

    const validQuestions = builderQuestions.filter((q) => q.question.trim().length > 0);
    if (validQuestions.length === 0) {
      Alert.alert('Required', 'Please add at least one question prompt.');
      return;
    }

    try {
      setSavingQuiz(true);
      triggerHaptic('medium');

      const payload = {
        title: builderTitle.trim(),
        subject: builderSubject.trim() || 'General Studies',
        topic: builderTopic.trim() || builderTitle.trim(),
        difficulty: builderDifficulty,
        status,
        questions: validQuestions.map((q) => ({
          question: q.question.trim(),
          type: 'MCQ',
          options: q.options.map((opt, i) => opt.trim() || `Option ${String.fromCharCode(65 + i)}`),
          correctAnswer: q.correctAnswer || 'A',
          explanation: q.explanation?.trim() || '',
        })),
      };

      if (editingQuizId) {
        await apiClient.put(`/teacher/quizzes/${editingQuizId}`, payload);
        Alert.alert('Updated!', `Quiz successfully updated as ${status}.`);
      } else {
        await apiClient.post('/teacher/quizzes', payload);
        Alert.alert('Saved! 🎓', `Quiz created and saved as ${status}.`);
      }

      triggerHaptic('success');
      setEditingQuizId(null);
      setBuilderTitle('');
      setBuilderSubject('');
      setBuilderTopic('');
      setBuilderQuestions([createEmptyQuestion()]);
      setActiveView('library');
      loadData();
    } catch (err) {
      Alert.alert('Save Error', err.response?.data?.message || 'Failed to save quiz.');
    } finally {
      setSavingQuiz(false);
    }
  };

  // ----------------------------------------------------
  // Bank Generator: Create from Question Bank
  // ----------------------------------------------------
  const handleGenerateFromBank = async () => {
    try {
      setGeneratingBank(true);
      triggerHaptic('medium');

      const subjectName = selectedBankSubject?.subjectName || selectedBankSubject?.name || 'Curriculum';
      const defaultTitle = `${subjectName} Grade ${bankGrade} Diagnostic Assessment`;
      const finalTitle = builderTitle.trim() || defaultTitle;

      let generatedQuiz = null;

      try {
        const res = await apiClient.post('/teacher/quizzes/generate-from-bank', {
          chapterId: selectedBankChapter?.id || undefined,
          subjectId: selectedBankSubject?.id || undefined,
          count: parseInt(bankCount, 10) || 10,
          difficulty: bankDifficulty,
          title: finalTitle,
        });
        generatedQuiz = res.data?.data?.quiz || res.data?.data;
      } catch (bankErr) {
        console.log('[TeacherQuizzes] Bank generator fallback to /tests:', bankErr.message);
        // Fallback: Fetch standard test bank questions and save as quiz draft
        const testRes = await apiClient.post('/tests', {
          classGrade: bankGrade,
          subjectId: selectedBankSubject?.id,
          chapterId: selectedBankChapter?.id || undefined,
          questionCount: parseInt(bankCount, 10) || 10,
          difficulty: bankDifficulty,
        }).catch(() => apiClient.post('/standard-tests', {
          classGrade: bankGrade,
          subjectId: selectedBankSubject?.id,
          chapterId: selectedBankChapter?.id || undefined,
          questionCount: parseInt(bankCount, 10) || 10,
          difficulty: bankDifficulty,
        })).catch(() => null);

        const testData = testRes?.data?.data?.attempt || testRes?.data?.data;
        const rawQs = testData?.questions || testData?.attempt?.questions || [];
        if (rawQs.length > 0) {
          const createPayload = {
            title: finalTitle,
            subject: subjectName,
            topic: selectedBankChapter?.chapterName || selectedBankChapter?.name || 'Curriculum Review',
            difficulty: bankDifficulty === 'MIXED' ? 'MEDIUM' : bankDifficulty,
            status: 'DRAFT',
            questions: rawQs.map((q) => ({
              question: q.questionText || q.question || 'Curriculum Question',
              type: 'MCQ',
              options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean).length === 4
                ? [q.optionA, q.optionB, q.optionC, q.optionD]
                : Array.isArray(q.options) && q.options.length === 4
                ? q.options
                : ['Option A', 'Option B', 'Option C', 'Option D'],
              correctAnswer: q.correctAnswer || 'A',
              explanation: q.explanation || '',
            })),
          };
          const createdRes = await apiClient.post('/teacher/quizzes', createPayload);
          generatedQuiz = createdRes.data?.data?.quiz || createdRes.data?.data;
        } else {
          throw new Error('No approved questions found for this subject/chapter in the bank. Please select another subject or chapter.');
        }
      }

      if (generatedQuiz) {
        triggerHaptic('success');
        const qCount = generatedQuiz.questions?.length || bankCount;
        Alert.alert(
          'Assessment Generated! 🏛️',
          `Created "${generatedQuiz.title}" with ${qCount} verified questions from the Question Bank.`,
          [
            {
              text: 'Edit in Builder',
              onPress: () => {
                handleStartEditQuiz(generatedQuiz);
              },
            },
            {
              text: 'View in Library',
              onPress: () => {
                setActiveView('library');
                loadData();
              },
            },
          ]
        );
      }
    } catch (err) {
      triggerHaptic('error');
      Alert.alert(
        'Notice',
        err.response?.data?.message || err.message || 'Please select a different grade or subject with active questions.'
      );
    } finally {
      setGeneratingBank(false);
    }
  };

  // ----------------------------------------------------
  // AI Generator: Note-to-Quiz
  // ----------------------------------------------------
  const handleGenerateFromAI = async () => {
    if (!aiNotesText.trim() || aiNotesText.trim().length < 20) {
      Alert.alert('Required', 'Please enter at least 20 characters of lecture notes.');
      return;
    }

    try {
      setGeneratingAI(true);
      triggerHaptic('medium');
      const res = await apiClient.post('/ai/notes-to-quiz', {
        title: builderTitle.trim() || 'AI Generated Assessment',
        topic: builderTopic.trim() || 'Curriculum Revision',
        subject: builderSubject.trim() || 'General Science',
        materialText: aiNotesText.trim(),
        numQuestions: parseInt(aiCount, 10) || 8,
        difficulty: builderDifficulty,
      });

      const quizData = res.data?.data?.quiz || res.data?.data;
      if (quizData?.questions?.length > 0) {
        setBuilderQuestions(
          quizData.questions.map((q) => ({
            question: q.questionText || q.question || '',
            options: Array.isArray(q.options)
              ? q.options
              : [q.optionA || '', q.optionB || '', q.optionC || '', q.optionD || ''],
            correctAnswer: q.correctAnswer || 'A',
            explanation: q.explanation || '',
          }))
        );
        setBuilderMode('MANUAL');
        Alert.alert('AI Success! ✨', 'Questions drafted from notes. You can now review and publish.');
      } else {
        Alert.alert('AI Generated', 'Questions generated into library.');
        setActiveView('library');
        loadData();
      }
    } catch (err) {
      Alert.alert('AI Error', err.response?.data?.message || 'Failed to generate quiz from notes.');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Filtered Quiz List
  const filteredQuizzes = quizzes.filter((q) => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (filterQuery.trim()) {
      const qText = `${q.title} ${q.subject} ${q.topic}`.toLowerCase();
      return qText.includes(filterQuery.toLowerCase());
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Teacher Assessments"
        subtitle="Quiz Library & Builder"
        showBack={Boolean(onBack)}
        onBack={onBack}
      />

      {/* Primary Sub-Tab Switcher (Library vs Builder) */}
      <View style={[styles.tabBarRow, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            triggerHaptic('selection');
            setActiveView('library');
          }}
          style={[
            styles.tabItem,
            activeView === 'library' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
        >
          <BookOpenIcon size={18} color={activeView === 'library' ? theme.primary : theme.textMuted} />
          <Text
            style={[
              styles.tabItemText,
              { color: activeView === 'library' ? theme.primary : theme.textMuted },
              activeView === 'library' && { fontWeight: '700' },
            ]}
          >
            Quiz Library ({quizzes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            triggerHaptic('selection');
            setActiveView('builder');
          }}
          style={[
            styles.tabItem,
            activeView === 'builder' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
        >
          <PlusIcon size={18} color={activeView === 'builder' ? theme.primary : theme.textMuted} />
          <Text
            style={[
              styles.tabItemText,
              { color: activeView === 'builder' ? theme.primary : theme.textMuted },
              activeView === 'builder' && { fontWeight: '700' },
            ]}
          >
            {editingQuizId ? 'Edit Quiz' : 'New Assessment'}
          </Text>
        </TouchableOpacity>

        {Boolean(onNavigateBank) && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('selection');
              onNavigateBank();
            }}
            style={styles.tabItem}
          >
            <KeyIcon size={18} color={theme.textMuted} />
            <Text style={[styles.tabItemText, { color: theme.textMuted }]}>
              Q-Bank ↗
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ==================================================== */}
      {/* VIEW 1: QUIZ LIBRARY                                  */}
      {/* ==================================================== */}
      {activeView === 'library' && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {/* Search & Filter Bar */}
          <View style={styles.searchRow}>
            <TextInput
              style={[
                styles.searchInput,
                { backgroundColor: theme.card, color: theme.text, borderColor: theme.cardBorder },
              ]}
              placeholder="Search assessments by title, subject..."
              placeholderTextColor={theme.textMuted}
              value={filterQuery}
              onChangeText={setFilterQuery}
            />
          </View>

          {/* Status Filter Chips */}
          <View style={styles.filterChipRow}>
            {['ALL', 'PUBLISHED', 'DRAFT'].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  triggerHaptic('selection');
                  setStatusFilter(s);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: statusFilter === s ? `${theme.primary}25` : theme.card,
                    borderColor: statusFilter === s ? theme.primary : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: statusFilter === s ? theme.primary : theme.textMuted },
                    statusFilter === s && { fontWeight: '700' },
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : filteredQuizzes.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: theme.cardBorder }]}>
              <BookOpenIcon size={40} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Assessments Found</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Create assessments using the Quiz Builder or generate drafts from question banks.
              </Text>
              <TouchableOpacity
                style={[styles.createFirstBtn, { backgroundColor: theme.primary }]}
                onPress={() => setActiveView('builder')}
              >
                <PlusIcon size={16} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>Create New Quiz</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredQuizzes.map((quiz) => {
              const qCount = quiz.questions?.length || quiz._count?.questions || 0;
              const isPublished = quiz.status === 'PUBLISHED';
              const assignedCount = quiz._count?.assignments || quiz.assignments?.length || 0;

              return (
                <View
                  key={quiz.id}
                  style={[
                    styles.quizCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.quizCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quizTitle, { color: theme.text }]}>{quiz.title}</Text>
                      <Text style={[styles.quizMeta, { color: theme.textMuted }]}>
                        {quiz.subject || 'General'} · {quiz.topic || 'Class Assessment'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isPublished ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: isPublished ? '#22C55E' : '#EAB308' },
                        ]}
                      >
                        {quiz.status || 'DRAFT'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.quizStatsRow}>
                    <View style={styles.statPill}>
                      <Text style={[styles.statVal, { color: theme.text }]}>{qCount}</Text>
                      <Text style={[styles.statLbl, { color: theme.textMuted }]}>Questions</Text>
                    </View>
                    <View style={styles.statPill}>
                      <Text style={[styles.statVal, { color: theme.primary }]}>{assignedCount}</Text>
                      <Text style={[styles.statLbl, { color: theme.textMuted }]}>Classes Assigned</Text>
                    </View>
                    <View style={styles.statPill}>
                      <Text style={[styles.statVal, { color: theme.accent }]}>{quiz.difficulty || 'MED'}</Text>
                      <Text style={[styles.statLbl, { color: theme.textMuted }]}>Difficulty</Text>
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View style={[styles.actionsRow, { borderTopColor: theme.cardBorder }]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleOpenAssignModal(quiz)}
                      style={[styles.assignBtn, { backgroundColor: theme.primary }]}
                    >
                      <KeyIcon size={14} color="#FFF" />
                      <Text style={styles.assignBtnText}>Assign to Class</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleStartEditQuiz(quiz)}
                      style={[styles.iconActionBtn, { backgroundColor: `${theme.primary}15` }]}
                    >
                      <EditIcon size={16} color={theme.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleDeleteQuiz(quiz)}
                      style={[styles.iconActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
                    >
                      <TrashIcon size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* VIEW 2: QUIZ BUILDER                                  */}
      {/* ==================================================== */}
      {activeView === 'builder' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Builder Method Selector */}
          <View style={[styles.builderModeRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {[
              { id: 'MANUAL', label: '✍️ Manual' },
              { id: 'BANK', label: '🏛️ Question Bank' },
              { id: 'AI', label: '✨ AI Notes' },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => {
                  triggerHaptic('selection');
                  setBuilderMode(m.id);
                }}
                style={[
                  styles.builderModeBtn,
                  builderMode === m.id && { backgroundColor: theme.primary },
                ]}
              >
                <Text
                  style={[
                    styles.builderModeText,
                    { color: builderMode === m.id ? '#FFF' : theme.textMuted },
                    builderMode === m.id && { fontWeight: '700' },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* MODE A: QUESTION BANK GENERATOR */}
          {builderMode === 'BANK' && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardHeading, { color: theme.text }]}>Generate from Curriculum Bank</Text>
              <Text style={[styles.cardSub, { color: theme.textMuted }]}>
                Create an instant assessment using FBISE, Punjab Board, MDCAT and ECAT verified questions.
              </Text>

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Target Class / Track</Text>
              <View style={styles.chipsRow}>
                {['9', '10', '11', '12', 'MDCAT', 'ECAT'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => {
                      setBankGrade(g);
                      loadBankSubjects(g);
                    }}
                    style={[
                      styles.smallChip,
                      {
                        backgroundColor: bankGrade === g ? theme.primary : theme.inputBg,
                        borderColor: bankGrade === g ? theme.primary : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: bankGrade === g ? '#FFF' : theme.text, fontSize: 12, fontWeight: bankGrade === g ? '700' : '400' }}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Subject</Text>
              {loadingBankSubjects ? (
                <ActivityIndicator color={theme.primary} size="small" style={{ marginVertical: 8 }} />
              ) : (
                <View style={styles.chipsRow}>
                  {bankSubjects.map((sub) => {
                    const isSelected = selectedBankSubject?.id === sub.id;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => {
                          setSelectedBankSubject(sub);
                          loadBankChapters(sub.id);
                        }}
                        style={[
                          styles.smallChip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.inputBg,
                            borderColor: isSelected ? theme.primary : theme.cardBorder,
                          },
                        ]}
                      >
                        <Text style={{ color: isSelected ? '#FFF' : theme.text, fontSize: 12, fontWeight: isSelected ? '700' : '400' }}>
                          {sub.subjectName || sub.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Chapter / Module</Text>
              {loadingBankChapters ? (
                <ActivityIndicator color={theme.primary} size="small" style={{ marginVertical: 8 }} />
              ) : (
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    onPress={() => setSelectedBankChapter(null)}
                    style={[
                      styles.smallChip,
                      {
                        backgroundColor: selectedBankChapter === null ? theme.primary : theme.inputBg,
                        borderColor: selectedBankChapter === null ? theme.primary : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: selectedBankChapter === null ? '#FFF' : theme.text, fontSize: 12, fontWeight: selectedBankChapter === null ? '700' : '400' }}>
                      All Chapters
                    </Text>
                  </TouchableOpacity>
                  {bankChapters.map((ch) => {
                    const isSelected = selectedBankChapter?.id === ch.id;
                    return (
                      <TouchableOpacity
                        key={ch.id}
                        onPress={() => setSelectedBankChapter(ch)}
                        style={[
                          styles.smallChip,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.inputBg,
                            borderColor: isSelected ? theme.primary : theme.cardBorder,
                          },
                        ]}
                      >
                        <Text style={{ color: isSelected ? '#FFF' : theme.text, fontSize: 12, fontWeight: isSelected ? '700' : '400' }}>
                          {ch.chapterName || ch.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Difficulty</Text>
              <View style={styles.chipsRow}>
                {['MIXED', 'EASY', 'MEDIUM', 'HARD'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setBankDifficulty(d)}
                    style={[
                      styles.smallChip,
                      {
                        backgroundColor: bankDifficulty === d ? theme.accentGold : theme.inputBg,
                        borderColor: bankDifficulty === d ? theme.accentGold : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: bankDifficulty === d ? '#FFF' : theme.text, fontSize: 12, fontWeight: bankDifficulty === d ? '700' : '400' }}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Question Count</Text>
              <View style={styles.chipsRow}>
                {['5', '10', '15', '20', '25'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setBankCount(c)}
                    style={[
                      styles.smallChip,
                      {
                        backgroundColor: bankCount === c ? theme.primary : theme.inputBg,
                        borderColor: bankCount === c ? theme.primary : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: bankCount === c ? '#FFF' : theme.text, fontSize: 12, fontWeight: bankCount === c ? '700' : '400' }}>
                      {c} Questions
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Assessment Title (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                value={builderTitle}
                onChangeText={setBuilderTitle}
                placeholder={`${selectedBankSubject?.subjectName || selectedBankSubject?.name || 'Curriculum'} Grade ${bankGrade} Diagnostic Assessment`}
                placeholderTextColor={theme.textMuted}
              />

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={handleGenerateFromBank}
                disabled={generatingBank}
              >
                {generatingBank ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Generate Assessment Draft 🚀</Text>
                )}
              </TouchableOpacity>

              {Boolean(onNavigateBank) && (
                <TouchableOpacity
                  style={[styles.outlineActionBtn, { borderColor: theme.cardBorder, marginTop: 10 }]}
                  onPress={() => {
                    triggerHaptic('light');
                    onNavigateBank();
                  }}
                >
                  <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                    🏛️ Or Browse Full Interactive Question Bank →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* MODE B: AI NOTE-TO-QUIZ */}
          {builderMode === 'AI' && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardHeading, { color: theme.text }]}>Generate from Lecture Notes</Text>
              <Text style={[styles.cardSub, { color: theme.textMuted }]}>
                Paste lecture transcripts or notes. Our AI generator will automatically extract concepts into structured MCQs.
              </Text>

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Assessment Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                value={builderTitle}
                onChangeText={setBuilderTitle}
                placeholder="e.g. Chapter 4 Motion Dynamics Assessment"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Lecture Notes & Text Content</Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder },
                ]}
                value={aiNotesText}
                onChangeText={setAiNotesText}
                multiline
                numberOfLines={6}
                placeholder="Paste key notes, chapter summary, or textbook concepts here..."
                placeholderTextColor={theme.textMuted}
              />

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={handleGenerateFromAI}
                disabled={generatingAI}
              >
                {generatingAI ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <SparklesIcon size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>
                      Generate with AI ✨
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* MODE C: MANUAL QUESTION EDITOR */}
          {builderMode === 'MANUAL' && (
            <View>
              {/* Quiz Metadata Card */}
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Text style={[styles.cardHeading, { color: theme.text }]}>Assessment Details</Text>

                <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Title *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                  value={builderTitle}
                  onChangeText={setBuilderTitle}
                  placeholder="e.g. Midterm Physics Mock"
                  placeholderTextColor={theme.textMuted}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Subject</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                      value={builderSubject}
                      onChangeText={setBuilderSubject}
                      placeholder="e.g. Physics"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Topic</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                      value={builderTopic}
                      onChangeText={setBuilderTopic}
                      placeholder="e.g. Kinematics"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Difficulty</Text>
                <View style={styles.chipsRow}>
                  {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setBuilderDifficulty(d)}
                      style={[
                        styles.smallChip,
                        {
                          backgroundColor: builderDifficulty === d ? theme.primary : theme.inputBg,
                          borderColor: builderDifficulty === d ? theme.primary : theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={{ color: builderDifficulty === d ? '#FFF' : theme.text, fontSize: 12 }}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dynamic Questions List */}
              <View style={styles.questionsHeaderRow}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  Questions ({builderQuestions.length})
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleAddQuestion}
                  style={[styles.addQBtn, { backgroundColor: `${theme.primary}20` }]}
                >
                  <PlusIcon size={14} color={theme.primary} />
                  <Text style={[styles.addQBtnText, { color: theme.primary }]}>Add Question</Text>
                </TouchableOpacity>
              </View>

              {builderQuestions.map((q, qIdx) => (
                <View
                  key={qIdx}
                  style={[
                    styles.qCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.qCardHeader}>
                    <Text style={[styles.qCardNumber, { color: theme.primary }]}>
                      Question #{qIdx + 1}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveQuestion(qIdx)}
                      style={styles.deleteQBtn}
                    >
                      <TrashIcon size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[
                      styles.qInput,
                      { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder },
                    ]}
                    value={q.question}
                    onChangeText={(val) => handleUpdateQuestion(qIdx, 'question', val)}
                    placeholder="Enter question prompt..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                  />

                  {/* Options A, B, C, D */}
                  <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>
                    Options & Correct Answer
                  </Text>
                  {['A', 'B', 'C', 'D'].map((optKey, optIdx) => {
                    const isCorrect = q.correctAnswer === optKey;
                    return (
                      <View key={optKey} style={styles.optionInputRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleUpdateQuestion(qIdx, 'correctAnswer', optKey)}
                          style={[
                            styles.correctBadgeBtn,
                            {
                              backgroundColor: isCorrect ? theme.success : theme.inputBg,
                              borderColor: isCorrect ? theme.success : theme.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: isCorrect ? '#FFF' : theme.textMuted,
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {optKey}
                          </Text>
                        </TouchableOpacity>

                        <TextInput
                          style={[
                            styles.optionInput,
                            {
                              backgroundColor: theme.inputBg,
                              color: theme.text,
                              borderColor: isCorrect ? theme.success : theme.cardBorder,
                            },
                          ]}
                          value={q.options[optIdx]}
                          onChangeText={(val) => handleUpdateOption(qIdx, optIdx, val)}
                          placeholder={`Option ${optKey}`}
                          placeholderTextColor={theme.textMuted}
                        />
                      </View>
                    );
                  })}

                  <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 8 }]}>
                    Explanation (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.explanationInput,
                      { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder },
                    ]}
                    value={q.explanation}
                    onChangeText={(val) => handleUpdateQuestion(qIdx, 'explanation', val)}
                    placeholder="Explanation shown after attempt..."
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              ))}

              {/* Builder Action Buttons */}
              <View style={styles.builderBtnRow}>
                <TouchableOpacity
                  style={[styles.saveDraftBtn, { borderColor: theme.cardBorder }]}
                  onPress={() => handleSaveQuiz('DRAFT')}
                  disabled={savingQuiz}
                >
                  <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Save Draft</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.publishBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleSaveQuiz('PUBLISHED')}
                  disabled={savingQuiz}
                >
                  {savingQuiz ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Publish to Library 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* ASSIGN QUIZ MODAL                                     */}
      {/* ==================================================== */}
      <Modal visible={assignModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Assign Assessment</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>
              "{selectedQuiz?.title}"
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 14 }]}>
              Target Classrooms
            </Text>
            {classrooms.length === 0 ? (
              <Text style={{ color: theme.accent, fontSize: 12, marginVertical: 8 }}>
                No active classrooms. Create a classroom first.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 120 }}>
                {classrooms.map((cls) => {
                  const isSelected = targetClassroomIds.includes(cls.id);
                  return (
                    <TouchableOpacity
                      key={cls.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        setTargetClassroomIds((prev) =>
                          prev.includes(cls.id)
                            ? prev.filter((x) => x !== cls.id)
                            : [...prev, cls.id]
                        );
                      }}
                      style={[
                        styles.classroomSelectRow,
                        {
                          backgroundColor: isSelected ? `${theme.primary}15` : theme.inputBg,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.clsName, { color: theme.text }]}>{cls.name}</Text>
                        <Text style={[styles.clsSubject, { color: theme.textMuted }]}>
                          {cls.subject || 'All Subjects'}
                        </Text>
                      </View>
                      {isSelected && <CheckIcon size={16} color={theme.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Duration (Mins)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                  value={assignDuration}
                  onChangeText={setAssignDuration}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Max Attempts</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
                  value={assignMaxAttempts}
                  onChangeText={setAssignMaxAttempts}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 10 }]}>Special Instructions</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
              value={assignInstructions}
              onChangeText={setAssignInstructions}
              placeholder="e.g. Complete before Friday 5:00 PM"
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.cardBorder }]}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={{ color: theme.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.assignSubmitBtn, { backgroundColor: theme.primary }]}
                onPress={handleExecuteAssign}
                disabled={assigning}
              >
                {assigning ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Confirm Assignment</Text>
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
  tabBarRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabItemText: {
    fontSize: 13,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  searchRow: {
    marginBottom: 10,
  },
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
  },
  quizCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  quizCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  quizMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  quizStatsRow: {
    flexDirection: 'row',
    marginVertical: 12,
    gap: 8,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLbl: {
    fontSize: 9,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  assignBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  assignBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  builderModeRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  builderModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  builderModeText: {
    fontSize: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  textArea: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  formRow: {
    flexDirection: 'row',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  outlineActionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  addQBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  addQBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  qCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  qCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qCardNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteQBtn: {
    padding: 4,
  },
  qInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    fontSize: 13,
    minHeight: 50,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  correctBadgeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  explanationInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  builderBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 30,
  },
  saveDraftBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  publishBtn: {
    flex: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  classroomSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  clsName: {
    fontSize: 13,
    fontWeight: '600',
  },
  clsSubject: {
    fontSize: 11,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  assignSubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});
