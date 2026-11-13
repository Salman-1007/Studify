import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function QuizzesScreen({ initialTrack = null }) {
  const { theme } = useTheme();

  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes

  // Default mock question pool if offline or demo
  const sampleQuestions = [
    {
      id: 'q1',
      question: 'What is the SI unit of electric current in physics?',
      options: ['Volt', 'Ampere', 'Coulomb', 'Ohm'],
      correctAnswer: 'Ampere',
      explanation: 'Electric current is measured in Amperes (A), defined as coulombs per second.',
    },
    {
      id: 'q2',
      question: 'Which organelle is universally referred to as the powerhouse of the cell?',
      options: ['Ribosome', 'Mitochondria', 'Golgi Apparatus', 'Endoplasmic Reticulum'],
      correctAnswer: 'Mitochondria',
      explanation: 'Mitochondria generate most of the chemical energy needed to power the cell’s biochemical reactions via ATP.',
    },
    {
      id: 'q3',
      question: 'In chemistry, what is the chemical formula for heavy water?',
      options: ['H2O', 'D2O', 'H2O2', 'T2O'],
      correctAnswer: 'D2O',
      explanation: 'Heavy water is deuterium oxide (D2O), where hydrogen atoms are replaced with deuterium isotopes.',
    },
    {
      id: 'q4',
      question: 'Newton’s first law of motion is also widely recognized as the Law of:',
      options: ['Momentum', 'Inertia', 'Action and Reaction', 'Gravitation'],
      correctAnswer: 'Inertia',
      explanation: 'Newton’s first law states that an object remains at rest or in uniform motion unless acted upon by a net force.',
    },
  ];

  const startQuiz = async (subject = 'Physics') => {
    try {
      triggerHaptic('medium');
      const res = await apiClient.get('/daily-arena/questions').catch(() => null);

      const qs = res?.data?.data?.questions?.length ? res.data.data.questions : sampleQuestions;
      setActiveQuiz({
        title: initialTrack ? `${initialTrack.name} Exam` : `${subject} Board Mock`,
        questions: qs,
      });
      setCurrentIndex(0);
      setSelectedAnswers({});
      setResults(null);
      setTimeLeft(qs.length * 60);
    } catch {
      setActiveQuiz({
        title: 'Curriculum Practice Mock',
        questions: sampleQuestions,
      });
      setCurrentIndex(0);
      setSelectedAnswers({});
      setResults(null);
    }
  };

  useEffect(() => {
    let timer;
    if (activeQuiz && !results && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeQuiz, results, timeLeft]);

  const handleSelectOption = (option) => {
    triggerHaptic('light');
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: option,
    }));
  };

  const handleSubmit = () => {
    triggerHaptic('success');
    const questions = activeQuiz.questions;
    let score = 0;
    const mistakes = [];

    questions.forEach((q, idx) => {
      const chosen = selectedAnswers[idx];
      const isCorrect = chosen === q.correctAnswer;
      if (isCorrect) {
        score++;
      } else {
        mistakes.push({
          question: q.question,
          chosen: chosen || 'Skipped',
          correct: q.correctAnswer,
          explanation: q.explanation,
        });
      }
    });

    setResults({
      score,
      total: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      mistakes,
    });
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Results View
  if (results) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header title="Exam Assessment" subtitle={activeQuiz.title} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View
            style={[
              styles.resultsCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.resultsBadge}>🏆</Text>
            <Text style={[styles.resultsTitle, { color: theme.text }]}>Exam Completed!</Text>
            <Text style={[styles.scoreBig, { color: theme.primary }]}>
              {results.score} / {results.total}
            </Text>
            <Text style={[styles.percentageText, { color: theme.textMuted }]}>
              {results.percentage}% Accuracy · {results.percentage >= 60 ? 'Passing' : 'Needs Review'}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                triggerHaptic('light');
                setActiveQuiz(null);
                setResults(null);
              }}
            >
              <Text style={styles.primaryButtonText}>Return to Quiz Hub</Text>
            </TouchableOpacity>
          </View>

          {results.mistakes.length > 0 ? (
            <View style={styles.mistakesSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Mistake Diagnostics ({results.mistakes.length})
              </Text>
              {results.mistakes.map((m, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.mistakeCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <Text style={[styles.mistakeQuestion, { color: theme.text }]}>
                    {idx + 1}. {m.question}
                  </Text>
                  <View style={styles.answerComparison}>
                    <Text style={[styles.wrongAnswer, { color: theme.error }]}>
                      Your Answer: {m.chosen}
                    </Text>
                    <Text style={[styles.correctAnswer, { color: theme.success }]}>
                      Correct: {m.correct}
                    </Text>
                  </View>
                  {m.explanation ? (
                    <Text style={[styles.explanationText, { color: theme.textMuted }]}>
                      💡 {m.explanation}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // 2. Quiz Runner View
  if (activeQuiz) {
    const q = activeQuiz.questions[currentIndex];
    const isAnswered = selectedAnswers[currentIndex] !== undefined;
    const isLast = currentIndex === activeQuiz.questions.length - 1;

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title={activeQuiz.title}
          subtitle={`Question ${currentIndex + 1} of ${activeQuiz.questions.length}`}
          rightElement={
            <View style={[styles.timerBadge, { backgroundColor: `${theme.accent}15` }]}>
              <Text style={[styles.timerText, { color: theme.accent }]}>
                ⏱️ {formatTimer(timeLeft)}
              </Text>
            </View>
          }
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Progress Bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: theme.cardBorder }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: theme.primary,
                  width: `${((currentIndex + 1) / activeQuiz.questions.length) * 100}%`,
                },
              ]}
            />
          </View>

          {/* Question Card */}
          <View
            style={[
              styles.questionCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.questionText, { color: theme.text }]}>{q.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsList}>
            {q.options.map((opt, idx) => {
              const isSelected = selectedAnswers[currentIndex] === opt;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  onPress={() => handleSelectOption(opt)}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isSelected ? `${theme.primary}20` : theme.card,
                      borderColor: isSelected ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionCircle,
                      {
                        borderColor: isSelected ? theme.primary : theme.textMuted,
                        backgroundColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionIndex,
                        { color: isSelected ? '#FFF' : theme.textMuted },
                      ]}
                    >
                      {String.fromCharCode(65 + idx)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isSelected ? theme.primary : theme.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Nav Controls */}
          <View style={styles.controlsRow}>
            {currentIndex > 0 ? (
              <TouchableOpacity
                style={[styles.navButton, { borderColor: theme.cardBorder }]}
                onPress={() => {
                  triggerHaptic('light');
                  setCurrentIndex((i) => i - 1);
                }}
              >
                <Text style={[styles.navButtonText, { color: theme.textSecondary }]}>
                  ← Previous
                </Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            {isLast ? (
              <TouchableOpacity
                style={[
                  styles.navButtonPrimary,
                  { backgroundColor: isAnswered ? theme.success : theme.cardBorder },
                ]}
                disabled={!isAnswered}
                onPress={handleSubmit}
              >
                <Text style={styles.navButtonPrimaryText}>Submit Exam ✓</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.navButtonPrimary, { backgroundColor: theme.primary }]}
                onPress={() => {
                  triggerHaptic('light');
                  setCurrentIndex((i) => i + 1);
                }}
              >
                <Text style={styles.navButtonPrimaryText}>Next Question →</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // 3. Quiz Hub / Selection View
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Assessment Hub"
        subtitle="Timed Mock Tests & Entry Exam Simulations"
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={[
            styles.bannerCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.bannerTitle, { color: theme.text }]}>
            Standard Mock Exams
          </Text>
          <Text style={[styles.bannerDesc, { color: theme.textMuted }]}>
            Strictly patterned after PMDC, UET, and FBISE examination criteria with instant AI analytics.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose Track to Begin</Text>

        {[
          { title: 'PMDC MDCAT Full Mock', desc: 'Biology, Chemistry, Physics & English', icon: '🩺' },
          { title: 'UET ECAT Engineering Mock', desc: 'Math, Physics, Chemistry / Comp Science', icon: '⚙️' },
          { title: 'FBISE Class 10 Physics Mock', desc: 'Complete Board Examination Format', icon: '⚡' },
          { title: 'Punjab Board Chemistry Mock', desc: 'Organic & Inorganic Chapter Tests', icon: '🧪' },
        ].map((item, idx) => (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.7}
            onPress={() => startQuiz(item.title)}
            style={[
              styles.hubCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={styles.hubIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hubTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.hubDesc, { color: theme.textMuted }]}>{item.desc}</Text>
            </View>
            <Text style={[styles.hubStart, { color: theme.primary }]}>Start →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 18,
    paddingBottom: 32,
  },
  bannerCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  bannerDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  hubIcon: {
    fontSize: 26,
  },
  hubTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  hubDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  hubStart: {
    fontSize: 13,
    fontWeight: '700',
  },
  timerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 18,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
  },
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIndex: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  navButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navButtonPrimary: {
    flex: 1.5,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resultsCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  resultsBadge: {
    fontSize: 48,
    marginBottom: 8,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreBig: {
    fontSize: 38,
    fontWeight: '900',
    marginVertical: 10,
  },
  percentageText: {
    fontSize: 13,
    marginBottom: 18,
  },
  primaryButton: {
    paddingHorizontal: 24,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mistakesSection: {
    marginTop: 10,
  },
  mistakeCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  mistakeQuestion: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  answerComparison: {
    gap: 3,
    marginBottom: 6,
  },
  wrongAnswer: {
    fontSize: 12,
    fontWeight: '600',
  },
  correctAnswer: {
    fontSize: 12,
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
