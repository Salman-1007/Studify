import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function DailyArenaScreen({ onBack }) {
  const { theme } = useTheme();

  // Screen modes: 'overview' | 'runner' | 'results' | 'leaderboard'
  const [viewMode, setViewMode] = useState('overview');

  // Overview Data
  const [arenaStatus, setArenaStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Active Challenge Runner Data
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(900); // 15 minutes default
  const [tabSwitches, setTabSwitches] = useState(0);
  const [questionTimes, setQuestionTimes] = useState({});
  const [startingChallenge, setStartingChallenge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Results & Review Data
  const [submitResult, setSubmitResult] = useState(null);

  // Leaderboard Data
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const timerRef = useRef(null);
  const currentQuestionStartTime = useRef(Date.now());
  const appStateRef = useRef(AppState.currentState);

  // Fetch status on mount
  const loadStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/daily-arena/status');
      const data = res.data?.data;
      setArenaStatus(data);
      if (data?.secondsUntilReset) {
        setCountdown(data.secondsUntilReset);
      }
    } catch (err) {
      console.warn('[DailyArena] Status error:', err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Countdown timer to midnight PKT
  useEffect(() => {
    const cdTimer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cdTimer);
  }, []);

  // Format seconds into HH:MM:SS
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Anti-cheat tab switch listener during active test
  useEffect(() => {
    if (viewMode !== 'runner') return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        setTabSwitches((prev) => {
          const updated = prev + 1;
          triggerHaptic('warning');
          return updated;
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [viewMode]);

  // Challenge countdown timer
  useEffect(() => {
    if (viewMode === 'runner' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            handleSubmitChallenge();
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

  // Start Daily Challenge
  const handleStartDailyChallenge = async (mode = 'GRAND') => {
    try {
      triggerHaptic('medium');
      setStartingChallenge(true);
      const res = await apiClient.post('/daily-arena/generate', {
        track: arenaStatus?.userClass || '9',
        mode,
        questionCount: 15,
      });

      const data = res.data?.data;
      if (data?.questions?.length) {
        setActiveAttempt(data);
        setQuestions(data.questions);
        setCurrentIndex(0);
        setSelectedAnswers({});
        setFlaggedQuestions({});
        setTabSwitches(0);
        setQuestionTimes({});
        setTimeRemaining((data.durationMinutes || 15) * 60);
        currentQuestionStartTime.current = Date.now();
        setViewMode('runner');
        triggerHaptic('success');
      } else {
        Alert.alert('Notice', 'No questions available for today yet. Please try again shortly.');
      }
    } catch (err) {
      Alert.alert(
        'Unable to Start',
        err.response?.data?.message || 'Could not connect to Daily Arena. Check your internet connection.'
      );
    } finally {
      setStartingChallenge(false);
    }
  };

  // Select option for current question
  const handleSelectOption = (key) => {
    triggerHaptic('light');
    const now = Date.now();
    const timeSpentOnCurrent = Math.round((now - currentQuestionStartTime.current) / 1000);

    setQuestionTimes((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || 0) + timeSpentOnCurrent,
    }));
    currentQuestionStartTime.current = now;

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: key,
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

  // Navigate to specific question index
  const handleJumpToQuestion = (index) => {
    triggerHaptic('selection');
    const now = Date.now();
    const timeSpentOnCurrent = Math.round((now - currentQuestionStartTime.current) / 1000);
    setQuestionTimes((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || 0) + timeSpentOnCurrent,
    }));
    currentQuestionStartTime.current = now;
    setCurrentIndex(index);
  };

  // Submit Daily Challenge
  const handleSubmitChallenge = async () => {
    if (submitting) return;
    try {
      triggerHaptic('warning');
      setSubmitting(true);

      const totalTimeTaken = Math.max(
        1,
        (activeAttempt?.durationMinutes || 15) * 60 - timeRemaining
      );

      const formattedAnswers = questions.map((q, idx) => ({
        questionId: q.id,
        selectedOption: selectedAnswers[idx] || null,
        timeSpentSeconds: questionTimes[idx] || 10,
      }));

      const res = await apiClient.post('/daily-arena/submit', {
        attemptId: activeAttempt?.attemptId,
        answers: formattedAnswers,
        timeTakenSecs: totalTimeTaken,
        tabSwitches,
      });

      const resultData = res.data?.data;
      setSubmitResult(resultData);
      setViewMode('results');
      triggerHaptic('success');
      loadStatus(); // refresh streak & completion status
    } catch (err) {
      Alert.alert(
        'Submission Error',
        err.response?.data?.message || 'Could not submit challenge. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Load Leaderboard
  const handleLoadLeaderboard = async () => {
    try {
      triggerHaptic('light');
      setViewMode('leaderboard');
      setLoadingLeaderboard(true);
      const res = await apiClient.get('/daily-arena/leaderboard');
      setLeaderboard(res.data?.data?.leaderboard || []);
    } catch (err) {
      console.warn('[DailyArena] Leaderboard error:', err.message);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Active Question Runner View
  // ----------------------------------------------------
  if (viewMode === 'runner' && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const totalQ = questions.length;
    const answeredCount = Object.keys(selectedAnswers).length;
    const isFlagged = !!flaggedQuestions[currentIndex];

    // Options can be string array or object array [{key, text}]
    const options = Array.isArray(currentQ?.options)
      ? currentQ.options.map((opt, i) => {
          if (typeof opt === 'string') {
            const letter = String.fromCharCode(65 + i);
            return { key: letter, text: opt };
          }
          return { key: opt.key || String.fromCharCode(65 + i), text: opt.text || opt.label || '' };
        })
      : [];

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Runner Header */}
        <View style={[styles.runnerHeader, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => {
              Alert.alert(
                'Quit Daily Arena?',
                'Your progress will be submitted as-is. Are you sure you want to exit?',
                [
                  { text: 'Resume', style: 'cancel' },
                  { text: 'Submit & Exit', style: 'destructive', onPress: handleSubmitChallenge },
                ]
              );
            }}
          >
            <Text style={[styles.backIconText, { color: theme.text }]}>✕</Text>
          </TouchableOpacity>

          <View style={styles.timerBadge}>
            <Text style={styles.timerFire}>⏳</Text>
            <Text
              style={[
                styles.timerText,
                { color: timeRemaining < 120 ? theme.error : theme.accentGold },
              ]}
            >
              {formatTime(timeRemaining)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              Alert.alert('Submit Test', `You have answered ${answeredCount}/${totalQ} questions. Submit now?`, [
                { text: 'Keep Reviewing', style: 'cancel' },
                { text: 'Submit Now', onPress: handleSubmitChallenge },
              ]);
            }}
          >
            <Text style={styles.finishBtnText}>Submit</Text>
          </TouchableOpacity>
        </View>

        {/* Tab switch anti-cheat warning banner */}
        {tabSwitches > 0 && (
          <View style={[styles.antiCheatBanner, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
            <Text style={[styles.antiCheatText, { color: theme.error }]}>
              ⚠️ Tab switches recorded: {tabSwitches}. Focus on your exam!
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.runnerContent}>
          {/* Progress bar */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressCountText, { color: theme.textMuted }]}>
              Question {currentIndex + 1} of {totalQ}
            </Text>
            <TouchableOpacity onPress={handleToggleFlag} style={styles.flagBtn}>
              <Text style={styles.flagIcon}>{isFlagged ? '🚩' : '🏳️'}</Text>
              <Text style={[styles.flagText, { color: isFlagged ? theme.accent : theme.textMuted }]}>
                {isFlagged ? 'Flagged' : 'Flag'}
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

          {/* Question Card */}
          <View style={[styles.questionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.questionPrompt, { color: theme.text }]}>
              {currentQ?.question}
            </Text>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = selectedAnswers[currentIndex] === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.7}
                  onPress={() => handleSelectOption(opt.key)}
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
                      {
                        backgroundColor: isSelected ? theme.primary : theme.cardHover,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionKeyText,
                        { color: isSelected ? '#FFF' : theme.textMuted },
                      ]}
                    >
                      {opt.key}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionContentText,
                      {
                        color: isSelected ? theme.text : theme.textSecondary,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Question Palette Navigation Matrix */}
          <Text style={[styles.paletteHeader, { color: theme.textMuted }]}>Question Matrix</Text>
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
                  onPress={() => handleJumpToQuestion(idx)}
                  style={[
                    styles.paletteDot,
                    {
                      backgroundColor: bg,
                      borderColor: border,
                    },
                  ]}
                >
                  <Text style={[styles.paletteDotText, { color: txt }]}>{idx + 1}</Text>
                  {isFlg && <View style={[styles.paletteFlagBadge, { backgroundColor: theme.accent }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Bottom Nav Controller */}
        <View style={[styles.runnerFooter, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
          <TouchableOpacity
            disabled={currentIndex === 0}
            onPress={() => handleJumpToQuestion(currentIndex - 1)}
            style={[
              styles.navBtn,
              {
                backgroundColor: theme.cardHover,
                opacity: currentIndex === 0 ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.navBtnText, { color: theme.text }]}>← Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={currentIndex === totalQ - 1}
            onPress={() => handleJumpToQuestion(currentIndex + 1)}
            style={[
              styles.navBtn,
              {
                backgroundColor: theme.primary,
                opacity: currentIndex === totalQ - 1 ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.navBtnText, { color: '#FFF' }]}>Next →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Results & Review Mode
  // ----------------------------------------------------
  if (viewMode === 'results' && submitResult) {
    const score = submitResult.score || 0;
    const total = submitResult.totalQuestions || questions.length || 15;
    const percentage = submitResult.percentage || Math.round((score / total) * 100);
    const pointsAwarded = submitResult.pointsAwarded || 50;
    const streak = submitResult.streakCount || arenaStatus?.streakCount || 1;
    const reviewItems = submitResult.review || [];

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Daily Arena Results"
          subtitle="Challenge Complete"
          showBack
          onBack={() => setViewMode('overview')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Hero Celebration Card */}
          <View style={[styles.heroResultCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.scoreBadgeCircle, { backgroundColor: `${theme.primary}18`, borderColor: theme.primary }]}>
              <Text style={[styles.scorePctText, { color: theme.primary }]}>{percentage}%</Text>
              <Text style={[styles.scoreFractionText, { color: theme.textMuted }]}>
                {score} / {total} Correct
              </Text>
            </View>

            <Text style={[styles.resultHeadline, { color: theme.text }]}>
              {percentage >= 80 ? 'Outstanding Mastery! 🏆' : percentage >= 50 ? 'Great Practice! 🎯' : 'Keep Practicing! 📚'}
            </Text>

            {/* Rewards Banner */}
            <View style={styles.rewardsRow}>
              <View style={[styles.rewardChip, { backgroundColor: `${theme.accentGold}18` }]}>
                <Text style={styles.rewardIcon}>⚡</Text>
                <Text style={[styles.rewardLabel, { color: theme.accentGold }]}>+{pointsAwarded} XP Earned</Text>
              </View>
              <View style={[styles.rewardChip, { backgroundColor: `${theme.accent}18` }]}>
                <Text style={styles.rewardIcon}>🔥</Text>
                <Text style={[styles.rewardLabel, { color: theme.accent }]}>{streak}-Day Streak</Text>
              </View>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.resultActionsRow}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
              onPress={() => setViewMode('overview')}
            >
              <Text style={styles.primaryActionBtnText}>Back to Daily Arena</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryActionBtn, { backgroundColor: theme.cardHover }]}
              onPress={handleLoadLeaderboard}
            >
              <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>View Leaderboard</Text>
            </TouchableOpacity>
          </View>

          {/* Detailed Question Review */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Detailed Answer Review</Text>

          {reviewItems.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No individual question review data returned.</Text>
            </View>
          ) : (
            reviewItems.map((item, idx) => {
              const isCorrect = item.isCorrect || item.selectedOption === item.correctAnswer;
              return (
                <View
                  key={idx}
                  style={[
                    styles.reviewCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: isCorrect ? `${theme.success}50` : `${theme.error}50`,
                    },
                  ]}
                >
                  <View style={styles.reviewHeaderRow}>
                    <View
                      style={[
                        styles.reviewStatusTag,
                        { backgroundColor: isCorrect ? `${theme.success}18` : `${theme.error}18` },
                      ]}
                    >
                      <Text style={{ color: isCorrect ? theme.success : theme.error, fontWeight: '700', fontSize: 12 }}>
                        {isCorrect ? '✓ CORRECT' : '✕ INCORRECT'}
                      </Text>
                    </View>
                    <Text style={[styles.reviewIndexText, { color: theme.textMuted }]}>Q{idx + 1}</Text>
                  </View>

                  <Text style={[styles.reviewQuestionText, { color: theme.text }]}>{item.question}</Text>

                  <View style={styles.reviewAnswersGrid}>
                    <Text style={[styles.answerLabel, { color: theme.textMuted }]}>
                      Your Choice: <Text style={{ color: isCorrect ? theme.success : theme.error, fontWeight: '700' }}>{item.selectedOption || 'None'}</Text>
                    </Text>
                    {!isCorrect && (
                      <Text style={[styles.answerLabel, { color: theme.textMuted }]}>
                        Correct Answer: <Text style={{ color: theme.success, fontWeight: '700' }}>{item.correctAnswer}</Text>
                      </Text>
                    )}
                  </View>

                  {item.explanation ? (
                    <View style={[styles.explanationBox, { backgroundColor: theme.cardHover }]}>
                      <Text style={[styles.explanationTitle, { color: theme.primary }]}>💡 Explanation</Text>
                      <Text style={[styles.explanationText, { color: theme.textSecondary }]}>{item.explanation}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Leaderboard View
  // ----------------------------------------------------
  if (viewMode === 'leaderboard') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Header
          title="Arena Leaderboard"
          subtitle="Top Daily Champions"
          showBack
          onBack={() => setViewMode('overview')}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {loadingLeaderboard ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
          ) : leaderboard.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
              <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🏆</Text>
              <Text style={[styles.emptyHeadline, { color: theme.text }]}>No Arena Submissions Yet</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Be the first to finish today's Daily Arena and take the #1 spot on the leaderboard!
              </Text>
            </View>
          ) : (
            leaderboard.map((item, idx) => {
              const isTop3 = idx < 3;
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <View
                  key={item.userId || idx}
                  style={[
                    styles.leaderboardCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: isTop3 ? `${theme.accentGold}40` : theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.leaderboardRank, { color: isTop3 ? theme.accentGold : theme.textMuted }]}>
                    {medal}
                  </Text>
                  <View style={[styles.avatarCircle, { backgroundColor: `${theme.primary}25` }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>
                      {item.name ? item.name.charAt(0).toUpperCase() : 'S'}
                    </Text>
                  </View>
                  <View style={styles.leaderboardInfo}>
                    <Text style={[styles.leaderboardName, { color: theme.text }]}>{item.name || item.username}</Text>
                    <Text style={[styles.leaderboardMeta, { color: theme.textMuted }]}>
                      Accuracy: {item.percentage}% • {item.timeTakenSecs}s
                    </Text>
                  </View>
                  <View style={styles.leaderboardScoreBox}>
                    <Text style={[styles.leaderboardScoreText, { color: theme.primary }]}>
                      {item.score}/{item.totalQuestions}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER: Default Overview Screen
  // ----------------------------------------------------
  const streak = arenaStatus?.streakCount || 0;
  const hasCompleted = arenaStatus?.hasCompletedToday;
  const todayAttempt = arenaStatus?.todayAttempt;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Daily Mock Arena"
        subtitle="15 Daily Timed Questions"
        showBack={Boolean(onBack)}
        onBack={onBack}
        rightElement={
          <View style={[styles.streakBadge, { backgroundColor: `${theme.accent}18` }]}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={[styles.streakCount, { color: theme.accent }]}>{streak}d</Text>
          </View>
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
              loadStatus();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Countdown & Status Banner */}
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.liveTag, { backgroundColor: `${theme.accent}20` }]}>
              <Text style={[styles.liveText, { color: theme.accent }]}>🔥 DAILY ARENA</Text>
            </View>
            <Text style={[styles.bonusTag, { color: theme.accentGold }]}>+50 XP BONUS</Text>
          </View>

          <Text style={[styles.heroTitle, { color: theme.text }]}>Today's Curriculum Challenge</Text>
          <Text style={[styles.heroDescription, { color: theme.textSecondary }]}>
            Complete 15 daily questions matched to your grade ({arenaStatus?.userClass || '9'}th Class / Board). Maintain your study streak!
          </Text>

          {/* Countdown Clock Box */}
          <View style={[styles.clockBox, { backgroundColor: theme.cardHover }]}>
            <Text style={[styles.clockLabel, { color: theme.textMuted }]}>RESETS IN</Text>
            <Text style={[styles.clockDigits, { color: theme.accentGold }]}>
              {formatTime(countdown)}
            </Text>
          </View>

          {/* Completion Status or Start Button */}
          {hasCompleted ? (
            <View style={[styles.completedBanner, { backgroundColor: `${theme.success}18`, borderColor: theme.success }]}>
              <Text style={[styles.completedTitle, { color: theme.success }]}>✓ Completed Today!</Text>
              {todayAttempt && (
                <Text style={[styles.completedSub, { color: theme.textSecondary }]}>
                  Score: {todayAttempt.score}/{todayAttempt.totalQuestions} ({todayAttempt.percentage}%) • Streak Extended!
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              disabled={startingChallenge}
              activeOpacity={0.8}
              onPress={() => handleStartDailyChallenge('GRAND')}
              style={[styles.startBtn, { backgroundColor: theme.primary }]}
            >
              {startingChallenge ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.startBtnText}>Start Daily Challenge →</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Solo & 1v1 Room Battles */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Battle Modes</Text>

        <View style={styles.modesGrid}>
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => handleStartDailyChallenge('SOLO')}
          >
            <Text style={styles.modeIcon}>⚡</Text>
            <Text style={[styles.modeTitle, { color: theme.text }]}>Solo Speed Run</Text>
            <Text style={[styles.modeSub, { color: theme.textMuted }]}>
              Instant 10-question sprint to test your reflexes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={handleLoadLeaderboard}
          >
            <Text style={styles.modeIcon}>🏆</Text>
            <Text style={[styles.modeTitle, { color: theme.text }]}>Arena Champions</Text>
            <Text style={[styles.modeSub, { color: theme.textMuted }]}>
              View today's top streaks and highest accuracy scores
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rules & Anti-Cheat Notice */}
        <View style={[styles.noticeCard, { backgroundColor: theme.cardHover, borderColor: theme.cardBorder }]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>🛡️ Fair Play & Anti-Cheat</Text>
          <Text style={[styles.noticeText, { color: theme.textMuted }]}>
            • 15 timed questions with instant verification{'\n'}
            • Tab-switch and backgrounding telemetry is recorded{'\n'}
            • Full answer explanations unlock immediately after submission
          </Text>
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  streakFire: {
    fontSize: 14,
    marginRight: 4,
  },
  streakCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bonusTag: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  clockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  clockLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clockDigits: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  startBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  completedBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  completedTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  completedSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  modesGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modeCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  modeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  noticeCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
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
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  timerFire: {
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
  antiCheatBanner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  antiCheatText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
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

  // Results Styles
  heroResultCard: {
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
  resultHeadline: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  rewardIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  rewardLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  primaryActionBtn: {
    flex: 1,
    paddingVertical: 12,
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewIndexText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reviewQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 10,
  },
  reviewAnswersGrid: {
    gap: 4,
    marginBottom: 10,
  },
  answerLabel: {
    fontSize: 12,
  },
  explanationBox: {
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Leaderboard Styles
  leaderboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  leaderboardRank: {
    width: 32,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  leaderboardMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  leaderboardScoreBox: {
    alignItems: 'flex-end',
  },
  leaderboardScoreText: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
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
