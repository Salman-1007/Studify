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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';
import { normalizeQuestionList, normalizeQuestion } from '../utils/quizUtils';
import {
  TestsIcon,
  ClassroomsIcon,
  DocumentIcon,
  HubIcon,
  ClockIcon,
} from '../components/Icons';

export default function StandardTestsScreen({ onBack }) {
  const { theme } = useTheme();

  // Screen modes: 'catalog' | 'config' | 'runner' | 'diagnostic' | 'history'
  const [viewMode, setViewMode] = useState('catalog');

  // Catalog Data
  const [selectedTrack, setSelectedTrack] = useState(null); // 'MDCAT' | 'ECAT' | 'FBISE' | 'PTB'
  const [selectedGrade, setSelectedGrade] = useState('9');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [chaptersList, setChaptersList] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [questionCount, setQuestionCount] = useState(15);
  const [difficulty, setDifficulty] = useState('MIXED'); // 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED'

  // Subjects & Catalog from API
  const [subjectsList, setSubjectsList] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Active Test Runner Data
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(900); // in seconds
  const [startingTest, setStartingTest] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);

  // Diagnostic Results Data
  const [testResult, setTestResult] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);

  // Test History Data
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const timerRef = useRef(null);

  // Standard exam tracks definition
  const examTracks = [
    {
      id: 'MDCAT',
      name: 'PMDC MDCAT',
      badge: 'National Medical',
      IconComp: TestsIcon,
      color: theme.primary,
      description: 'Biology, Chemistry, Physics, English & Logical Reasoning',
      defaultGrade: '12',
    },
    {
      id: 'ECAT',
      name: 'UET ECAT',
      badge: 'National Engineering',
      IconComp: HubIcon,
      color: theme.accent,
      description: 'Mathematics, Physics, Chemistry & English',
      defaultGrade: '12',
    },
    {
      id: 'FBISE',
      name: 'Federal Board (FBISE)',
      badge: 'Federal Islamabad',
      IconComp: ClassroomsIcon,
      color: theme.success,
      description: 'Class 9, 10, 11 (HSSC-I) & Class 12 (HSSC-II)',
      defaultGrade: '9',
    },
    {
      id: 'PTB',
      name: 'Punjab Board (PTB)',
      badge: 'Punjab Text Book',
      IconComp: DocumentIcon,
      color: theme.accentGold,
      description: 'Matric & Intermediate Science Curriculums',
      defaultGrade: '9',
    },
  ];

  // Fetch chapters for chosen subject
  const loadChapters = useCallback(async (subjectId) => {
    if (!subjectId) {
      setChaptersList([]);
      setSelectedChapter(null);
      return;
    }
    try {
      setLoadingChapters(true);
      const res = await apiClient.get('/curriculum/chapters', {
        params: { subjectId },
      });
      const chs = res.data?.data?.chapters || res.data?.data || [];
      setChaptersList(chs);
      setSelectedChapter(null); // 'All Chapters' by default
    } catch {
      setChaptersList([]);
      setSelectedChapter(null);
    } finally {
      setLoadingChapters(false);
    }
  }, []);

  // Fetch subjects for chosen grade/track
  const loadSubjects = useCallback(async (grade) => {
    try {
      setLoadingSubjects(true);
      const res = await apiClient.get('/curriculum/subjects', {
        params: { classGrade: grade || '9' },
      });
      const subs = res.data?.data?.subjects || res.data?.data || [];
      setSubjectsList(subs);
      if (subs.length > 0) {
        setSelectedSubject(subs[0]);
        loadChapters(subs[0].id);
      } else {
        setSelectedSubject(null);
        setChaptersList([]);
      }
    } catch (err) {
      console.warn('[StandardTests] Could not fetch subjects:', err.message);
      // Fallback subjects
      const fallback = [
        { id: 'sub-phy', name: 'Physics' },
        { id: 'sub-chem', name: 'Chemistry' },
        { id: 'sub-bio', name: 'Biology' },
        { id: 'sub-math', name: 'Mathematics' },
        { id: 'sub-eng', name: 'English' },
      ];
      setSubjectsList(fallback);
      setSelectedSubject(fallback[0]);
      setChaptersList([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, [loadChapters]);

  // Fetch past test history
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await apiClient
        .get('/tests/history')
        .catch(() => apiClient.get('/standard-tests/history'));
      setHistoryList(res.data?.data?.attempts || res.data?.data || []);
    } catch (err) {
      console.warn('[StandardTests] History error:', err.message);
    } finally {
      setLoadingHistory(false);
      setRefreshingHistory(false);
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (viewMode === 'runner' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            handleSubmitTest();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewMode, timeRemaining]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Open config for a chosen track
  const handleSelectTrack = (track) => {
    triggerHaptic('light');
    setSelectedTrack(track);
    setSelectedGrade(track.defaultGrade || '9');
    loadSubjects(track.defaultGrade || '9');
    setViewMode('config');
  };

  // Launch test attempt
  const handleStartTest = async () => {
    try {
      triggerHaptic('medium');
      setStartingTest(true);

      const payload = {
        classGrade: selectedGrade,
        subjectId: selectedSubject?.id,
        chapterId: selectedChapter?.id || undefined,
        questionCount,
        difficulty,
      };

      const res = await apiClient
        .post('/tests', payload)
        .catch(() => apiClient.post('/standard-tests', payload));
      const data = res.data?.data?.attempt || res.data?.data;
      const rawQs = data?.questions || data?.attempt?.questions || [];
      const normalizedQs = normalizeQuestionList(rawQs);

      if (normalizedQs.length) {
        setActiveAttempt(data);
        setQuestions(normalizedQs);
        setCurrentIndex(0);
        setSelectedAnswers({});
        setFlaggedQuestions({});
        setTimeRemaining(data.durationMinutes ? data.durationMinutes * 60 : questionCount * 60);
        setViewMode('runner');
        triggerHaptic('success');
      } else {
        Alert.alert('Notice', 'No questions available for this subject or chapter yet. Please select another subject.');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not start exam. Please try again.');
    } finally {
      setStartingTest(false);
    }
  };

  // Select answer
  const handleSelectAnswer = (optionKey) => {
    triggerHaptic('light');
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionKey,
    }));
  };

  // Toggle flag for review
  const handleToggleFlag = () => {
    triggerHaptic('selection');
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentIndex]: !prev[currentIndex],
    }));
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (submittingTest) return;
    try {
      triggerHaptic('warning');
      setSubmittingTest(true);

      const totalTimeTaken = Math.max(
        1,
        (activeAttempt?.durationMinutes ? activeAttempt.durationMinutes * 60 : questionCount * 60) - timeRemaining
      );

      const answersArray = questions.map((q, idx) => ({
        questionId: q.id || q.questionId,
        selectedOption: selectedAnswers[idx] || null,
        answer: selectedAnswers[idx] || null,
      }));

      const res = await apiClient
        .post('/tests/submit', {
          attemptId: activeAttempt?.attemptId || activeAttempt?.id,
          answers: answersArray,
          responses: answersArray,
          timeTakenSecs: totalTimeTaken,
          durationSeconds: totalTimeTaken,
        })
        .catch(() =>
          apiClient.post('/standard-tests/submit', {
            attemptId: activeAttempt?.attemptId || activeAttempt?.id,
            answers: answersArray,
            responses: answersArray,
            timeTakenSecs: totalTimeTaken,
            durationSeconds: totalTimeTaken,
          })
        );

      const resultData = res.data?.data;
      setTestResult(resultData);
      setViewMode('diagnostic');
      triggerHaptic('success');

      // Request AI Diagnostic report
      if (resultData?.attemptId || activeAttempt?.attemptId || activeAttempt?.id) {
        const attId = resultData?.attemptId || activeAttempt?.attemptId || activeAttempt?.id;
        fetchAiDiagnostic(attId);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit test.');
    } finally {
      setSubmittingTest(false);
    }
  };

  // Fetch AI Diagnostic Report
  const fetchAiDiagnostic = async (attemptId) => {
    try {
      setLoadingDiagnostic(true);
      const res = await apiClient
        .post(`/tests/${attemptId}/ai-diagnostic`)
        .catch(() => apiClient.post(`/standard-tests/${attemptId}/ai-diagnostic`));
      setDiagnostic(res.data?.data?.diagnostic || res.data?.data);
    } catch (err) {
      console.warn('[StandardTests] Diagnostic error:', err.message);
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Active Exam Runner
  // ----------------------------------------------------
  if (viewMode === 'runner' && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const totalQ = questions.length;
    const answeredCount = Object.keys(selectedAnswers).length;
    const isFlagged = Boolean(flaggedQuestions[currentIndex]);
    const options = currentQ?.options || [];

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Runner Header */}
        <View style={[styles.runnerHeader, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => {
              Alert.alert('Exit Exam?', 'Your progress will be submitted as-is. Are you sure?', [
                { text: 'Keep Going', style: 'cancel' },
                { text: 'Submit & Exit', style: 'destructive', onPress: handleSubmitTest },
              ]);
            }}
          >
            <Text style={[styles.backIconText, { color: theme.text }]}>✕</Text>
          </TouchableOpacity>

          <View style={styles.timerBadge}>
            <ClockIcon size={16} color={timeRemaining < 120 ? theme.error : theme.accentGold} />
            <Text style={[styles.timerText, { color: timeRemaining < 120 ? theme.error : theme.accentGold, marginLeft: 6 }]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              Alert.alert('Submit Test', `Answered ${answeredCount}/${totalQ} questions. Submit now?`, [
                { text: 'Review', style: 'cancel' },
                { text: 'Submit', onPress: handleSubmitTest },
              ]);
            }}
          >
            <Text style={styles.finishBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.runnerContent}>
          {/* Progress row */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressCountText, { color: theme.textMuted }]}>
              Question {currentIndex + 1} of {totalQ}
            </Text>
            <TouchableOpacity onPress={handleToggleFlag} style={styles.flagBtn}>
              <Text style={styles.flagIcon}>{isFlagged ? '🚩' : '🏳️'}</Text>
              <Text style={[styles.flagText, { color: isFlagged ? theme.accent : theme.textMuted }]}>
                {isFlagged ? 'Flagged' : 'Flag for Review'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.progressBarTrack, { backgroundColor: theme.cardHover }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: theme.primary,
                  width: `${((currentIndex + 1) / totalQ) * 100}%`,
                },
              ]}
            />
          </View>

          {/* Question Box */}
          <View style={[styles.questionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={[styles.optionKeyBadge, { backgroundColor: `${theme.primary}18`, width: 'auto', paddingHorizontal: 10, height: 26, borderRadius: 6 }]}>
                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>
                  Question {currentIndex + 1} of {totalQ}
                </Text>
              </View>
              {Boolean(currentQ?.difficulty) && (
                <View style={[styles.optionKeyBadge, { backgroundColor: theme.cardHover, width: 'auto', paddingHorizontal: 8, height: 24, borderRadius: 6 }]}>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    {currentQ.difficulty}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.questionPrompt, { color: theme.text }]}>
              {currentQ?.questionText || currentQ?.question || 'Question'}
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = selectedAnswers[currentIndex] === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.7}
                  onPress={() => handleSelectAnswer(opt.key)}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: isSelected ? `${theme.primary}18` : theme.card,
                      borderColor: isSelected ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionKeyBadge,
                      { backgroundColor: isSelected ? theme.primary : theme.cardHover },
                    ]}
                  >
                    <Text style={[styles.optionKeyText, { color: isSelected ? '#FFF' : theme.textMuted }]}>
                      {opt.key}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionContentText,
                      {
                        color: isSelected ? theme.text : theme.textSecondary,
                        fontWeight: isSelected ? '700' : '400',
                      },
                    ]}
                  >
                    {opt.text}
                  </Text>
                  {isSelected && (
                    <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Question Matrix */}
          <Text style={[styles.paletteHeader, { color: theme.textMuted }]}>Questions Palette</Text>
          <View style={styles.paletteGrid}>
            {questions.map((_, idx) => {
              const isAnswered = selectedAnswers[idx] !== undefined;
              const isCurr = idx === currentIndex;
              const isFlg = !!flaggedQuestions[idx];

              let bg = theme.card;
              let border = theme.cardBorder;
              let txt = theme.textMuted;

              if (isCurr) {
                border = theme.primary;
                txt = theme.primary;
              } else if (isAnswered) {
                bg = `${theme.success}20`;
                border = theme.success;
                txt = theme.success;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setCurrentIndex(idx)}
                  style={[styles.paletteDot, { backgroundColor: bg, borderColor: border }]}
                >
                  <Text style={[styles.paletteDotText, { color: txt }]}>{idx + 1}</Text>
                  {isFlg && <View style={[styles.paletteFlagBadge, { backgroundColor: theme.accent }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Runner Footer */}
        <View style={[styles.runnerFooter, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
          <TouchableOpacity
            disabled={currentIndex === 0}
            onPress={() => setCurrentIndex((c) => c - 1)}
            style={[styles.navBtn, { backgroundColor: theme.cardHover, opacity: currentIndex === 0 ? 0.4 : 1 }]}
          >
            <Text style={[styles.navBtnText, { color: theme.text }]}>← Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={currentIndex === totalQ - 1}
            onPress={() => setCurrentIndex((c) => c + 1)}
            style={[styles.navBtn, { backgroundColor: theme.primary, opacity: currentIndex === totalQ - 1 ? 0.4 : 1 }]}
          >
            <Text style={[styles.navBtnText, { color: '#FFF' }]}>Next →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: AI Diagnostic Report
  // ----------------------------------------------------
  if (viewMode === 'diagnostic' && testResult) {
    const score = testResult.score || 0;
    const total = testResult.totalQuestions || questions.length || questionCount;
    const percentage = testResult.percentage || Math.round((score / total) * 100);

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Exam Diagnostic Report"
          subtitle="AI Strength & Weakness Analysis"
          showBack
          onBack={() => setViewMode('catalog')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Summary Score Card */}
          <View style={[styles.diagnosticHeroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.scoreBadgeCircle, { backgroundColor: `${theme.primary}18`, borderColor: theme.primary }]}>
              <Text style={[styles.scorePctText, { color: theme.primary }]}>{percentage}%</Text>
              <Text style={[styles.scoreFractionText, { color: theme.textMuted }]}>
                {score} / {total} Correct
              </Text>
            </View>

            <Text style={[styles.diagnosticHeadline, { color: theme.text }]}>
              {diagnostic?.headline || (percentage >= 80 ? 'Distinction Level Performance!' : percentage >= 50 ? 'Passing Foundation Established' : 'Needs Targeted Revision')}
            </Text>
            <Text style={[styles.diagnosticSummaryText, { color: theme.textSecondary }]}>
              {diagnostic?.summary || `You scored ${score} out of ${total} on this mock examination.`}
            </Text>
          </View>

          {/* AI Recommendations Card */}
          <View style={[styles.aiCard, { backgroundColor: theme.card, borderColor: `${theme.primary}40` }]}>
            <View style={styles.aiCardHeader}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>🤖</Text>
              <Text style={[styles.aiCardTitle, { color: theme.text }]}>AI Revision Prescription</Text>
            </View>

            {loadingDiagnostic ? (
              <ActivityIndicator color={theme.primary} style={{ marginVertical: 16 }} />
            ) : diagnostic?.recommendations?.length ? (
              diagnostic.recommendations.map((rec, i) => (
                <View key={i} style={styles.recItem}>
                  <Text style={[styles.recBullet, { color: theme.primary }]}>•</Text>
                  <Text style={[styles.recText, { color: theme.textSecondary }]}>{rec}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.recText, { color: theme.textSecondary }]}>
                Focus your review on unanswered questions and high-yield topics before attempting the next full-length board paper.
              </Text>
            )}
          </View>

          {/* Detailed Question Review Breakdown */}
          {testResult?.questions?.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
                Detailed Question Review ({testResult.questions.length})
              </Text>
              {testResult.questions.map((rq, idx) => {
                const norm = normalizeQuestion(rq);
                const isCorrect = rq.isCorrect || (rq.selectedOption && rq.selectedOption === (rq.correctAnswer || rq.correctOption));
                const isSkipped = !rq.selectedOption;
                const statusColor = isSkipped ? theme.accentGold : isCorrect ? theme.success : theme.error;
                const statusLabel = isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect';

                return (
                  <View
                    key={rq.questionId || idx}
                    style={[
                      styles.questionCard,
                      { backgroundColor: theme.card, borderColor: theme.cardBorder, marginBottom: 14 },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>
                        Question {idx + 1}
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: `${statusColor}20` }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, lineHeight: 20, marginBottom: 10 }}>
                      {norm?.questionText}
                    </Text>

                    <View style={{ gap: 6, marginBottom: 8 }}>
                      {(norm?.options || []).map((opt) => {
                        const wasChosen = rq.selectedOption === opt.key;
                        const wasCorrect = (rq.correctAnswer || rq.correctOption) === opt.key;
                        let optBorder = theme.cardBorder;
                        let optBg = theme.cardHover;
                        if (wasCorrect) {
                          optBorder = theme.success;
                          optBg = `${theme.success}15`;
                        } else if (wasChosen && !isCorrect) {
                          optBorder = theme.error;
                          optBg = `${theme.error}15`;
                        }

                        return (
                          <View
                            key={opt.key}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 8,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: optBorder,
                              backgroundColor: optBg,
                              gap: 8,
                            }}
                          >
                            <Text style={{ fontWeight: '700', fontSize: 12, color: wasCorrect ? theme.success : theme.textMuted, width: 20 }}>
                              {opt.key}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 13, color: theme.text }}>
                              {opt.text}
                            </Text>
                            {wasCorrect && <Text style={{ color: theme.success, fontWeight: 'bold', fontSize: 12 }}>✓ Correct</Text>}
                            {wasChosen && !wasCorrect && <Text style={{ color: theme.error, fontWeight: 'bold', fontSize: 12 }}>✕ Chosen</Text>}
                          </View>
                        );
                      })}
                    </View>

                    {Boolean(rq.explanation) && (
                      <View style={{ padding: 8, borderRadius: 6, backgroundColor: `${theme.primary}10`, marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                          💡 <Text style={{ fontWeight: '700' }}>Explanation:</Text> {rq.explanation}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
              onPress={() => setViewMode('catalog')}
            >
              <Text style={styles.primaryActionBtnText}>Practice Another Subject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryActionBtn, { backgroundColor: theme.cardHover }]}
              onPress={() => {
                loadHistory();
                setViewMode('history');
              }}
            >
              <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>View All History</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Exam History View
  // ----------------------------------------------------
  if (viewMode === 'history') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Past Exam History"
          subtitle="All Standard Test Attempts"
          showBack
          onBack={() => setViewMode('catalog')}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHistory}
              onRefresh={() => {
                triggerHaptic('light');
                setRefreshingHistory(true);
                loadHistory();
              }}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {loadingHistory ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
          ) : historyList.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <View style={{ marginBottom: 12 }}>
                <TestsIcon size={36} color={theme.textMuted} />
              </View>
              <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Past Exam Attempts</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Complete full-length MDCAT, ECAT, or FBISE/PTB papers to track your long-term score trends.
              </Text>
            </View>
          ) : (
            historyList.map((item) => (
              <View
                key={item.id}
                style={[styles.historyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.historyRow}>
                  <Text style={[styles.historySubject, { color: theme.text }]}>
                    {item.subject?.name || item.track || 'Board Exam'}
                  </Text>
                  <Text style={[styles.historyPct, { color: item.percentage >= 60 ? theme.success : theme.error }]}>
                    {item.percentage}%
                  </Text>
                </View>
                <Text style={[styles.historyMeta, { color: theme.textMuted }]}>
                  Score: {item.score}/{item.totalQuestions} • {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Exam Configuration View
  // ----------------------------------------------------
  if (viewMode === 'config' && selectedTrack) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={selectedTrack.name}
          subtitle="Configure Exam Paper"
          showBack
          onBack={() => setViewMode('catalog')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Track Summary Banner */}
          <View style={[styles.configBanner, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: `${selectedTrack.color}18`, marginBottom: 10 }]}>
              <selectedTrack.IconComp size={30} color={selectedTrack.color} />
            </View>
            <Text style={[styles.configTrackName, { color: theme.text }]}>{selectedTrack.name}</Text>
            <Text style={[styles.configTrackDesc, { color: theme.textMuted }]}>{selectedTrack.description}</Text>
          </View>

          {/* Grade Selector (for FBISE / PTB) */}
          {selectedTrack.id === 'FBISE' || selectedTrack.id === 'PTB' ? (
            <View style={styles.configSection}>
              <Text style={[styles.configSectionTitle, { color: theme.text }]}>Select Class Grade</Text>
              <View style={styles.chipsRow}>
                {['9', '10', '11', '12'].map((gr) => (
                  <TouchableOpacity
                    key={gr}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSelectedGrade(gr);
                      loadSubjects(gr);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selectedGrade === gr ? theme.primary : theme.card,
                        borderColor: selectedGrade === gr ? theme.primary : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: selectedGrade === gr ? '#FFF' : theme.textSecondary }]}>
                      Class {gr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Subject Selector */}
          <View style={styles.configSection}>
            <Text style={[styles.configSectionTitle, { color: theme.text }]}>Select Subject</Text>
            {loadingSubjects ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <View style={styles.chipsRow}>
                {subjectsList.map((sub) => {
                  const isSelected = selectedSubject?.id === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSelectedSubject(sub);
                        loadChapters(sub.id);
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.card,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? '#FFF' : theme.textSecondary }]}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Chapter Selector */}
          <View style={styles.configSection}>
            <Text style={[styles.configSectionTitle, { color: theme.text }]}>Select Chapter</Text>
            {loadingChapters ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <View style={styles.chipsRow}>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedChapter(null);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedChapter === null ? theme.primary : theme.card,
                      borderColor: selectedChapter === null ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selectedChapter === null ? '#FFF' : theme.textSecondary }]}>
                    All Chapters (Subject Mock)
                  </Text>
                </TouchableOpacity>

                {chaptersList.map((ch) => {
                  const isSelected = selectedChapter?.id === ch.id;
                  const chLabel = `Ch ${ch.chapterNumber || ''}: ${ch.title || ch.chapterName || 'Chapter'}`;
                  return (
                    <TouchableOpacity
                      key={ch.id}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSelectedChapter(ch);
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.card,
                          borderColor: isSelected ? theme.primary : theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? '#FFF' : theme.textSecondary }]}>
                        {chLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Question Count Selector */}
          <View style={styles.configSection}>
            <Text style={[styles.configSectionTitle, { color: theme.text }]}>Question Count</Text>
            <View style={styles.chipsRow}>
              {[10, 15, 25, 30].map((count) => (
                <TouchableOpacity
                  key={count}
                  onPress={() => {
                    triggerHaptic('selection');
                    setQuestionCount(count);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: questionCount === count ? theme.primary : theme.card,
                      borderColor: questionCount === count ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: questionCount === count ? '#FFF' : theme.textSecondary }]}>
                    {count} MCQs
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Difficulty Selector */}
          <View style={styles.configSection}>
            <Text style={[styles.configSectionTitle, { color: theme.text }]}>Difficulty</Text>
            <View style={styles.chipsRow}>
              {['MIXED', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
                <TouchableOpacity
                  key={diff}
                  onPress={() => {
                    triggerHaptic('selection');
                    setDifficulty(diff);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: difficulty === diff ? theme.primary : theme.card,
                      borderColor: difficulty === diff ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: difficulty === diff ? '#FFF' : theme.textSecondary }]}>
                    {diff}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Launch Button */}
          <TouchableOpacity
            disabled={startingTest}
            activeOpacity={0.8}
            onPress={handleStartTest}
            style={[styles.startExamBtn, { backgroundColor: theme.primary }]}
          >
            {startingTest ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.startExamBtnText}>Begin Exam Paper →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Catalog View (Default)
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Curriculum & Tests"
        subtitle="MDCAT, ECAT & Board Mocks"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <TouchableOpacity
            onPress={() => {
              loadHistory();
              setViewMode('history');
            }}
            style={[styles.historyBtn, { backgroundColor: theme.cardHover }]}
          >
            <Text style={[styles.historyBtnText, { color: theme.text }]}>History</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>National Entrance Tests</Text>
        <View style={styles.tracksGrid}>
          {examTracks.slice(0, 2).map((track) => {
            const IconComp = track.IconComp;
            return (
              <TouchableOpacity
                key={track.id}
                activeOpacity={0.7}
                onPress={() => handleSelectTrack(track)}
                style={[styles.trackCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.trackCardHeader}>
                  <View style={[styles.trackIconBox, { backgroundColor: `${track.color}18` }]}>
                    <IconComp size={22} color={track.color} />
                  </View>
                  <View style={[styles.trackBadge, { backgroundColor: `${track.color}15` }]}>
                    <Text style={[styles.trackBadgeText, { color: track.color }]}>{track.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.trackName, { color: theme.text }]}>{track.name}</Text>
                <Text style={[styles.trackDesc, { color: theme.textMuted }]}>{track.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionHeading, { color: theme.text }]}>Provincial & Federal Boards</Text>
        <View style={styles.tracksGrid}>
          {examTracks.slice(2, 4).map((track) => {
            const IconComp = track.IconComp;
            return (
              <TouchableOpacity
                key={track.id}
                activeOpacity={0.7}
                onPress={() => handleSelectTrack(track)}
                style={[styles.trackCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={styles.trackCardHeader}>
                  <View style={[styles.trackIconBox, { backgroundColor: `${track.color}18` }]}>
                    <IconComp size={22} color={track.color} />
                  </View>
                  <View style={[styles.trackBadge, { backgroundColor: `${track.color}15` }]}>
                    <Text style={[styles.trackBadgeText, { color: track.color }]}>{track.badge}</Text>
                  </View>
                </View>
                <Text style={[styles.trackName, { color: theme.text }]}>{track.name}</Text>
                <Text style={[styles.trackDesc, { color: theme.textMuted }]}>{track.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  historyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  tracksGrid: {
    gap: 12,
    marginBottom: 24,
  },
  trackCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  trackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  trackBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  trackName: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  trackDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Config Styles
  configBanner: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  configTrackName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  configTrackDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  configSection: {
    marginBottom: 20,
  },
  configSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  startExamBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  startExamBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Runner Styles
  runnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  timerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  timerText: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  finishBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  runnerContent: {
    padding: 16,
    paddingBottom: 32,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  flagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  questionPrompt: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionKeyBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionKeyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionContentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  paletteHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paletteDot: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  paletteDotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paletteFlagBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 3,
    right: 3,
  },
  runnerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Diagnostic Styles
  diagnosticHeroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  scoreBadgeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scorePctText: {
    fontSize: 26,
    fontWeight: '900',
  },
  scoreFractionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  diagnosticHeadline: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  diagnosticSummaryText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  aiCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  recItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  recBullet: {
    fontSize: 14,
    marginRight: 8,
    fontWeight: '900',
  },
  recText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  primaryActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // History Styles
  historyCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historySubject: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyPct: {
    fontSize: 15,
    fontWeight: '800',
  },
  historyMeta: {
    fontSize: 12,
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
});
