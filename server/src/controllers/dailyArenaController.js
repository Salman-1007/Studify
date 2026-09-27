import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

// Deterministic Pseudo-Random Generator (LCG) based on string seed
const createSeededRandom = (seedStr) => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  let s = Math.abs(hash) || 123456789;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const getPktDateString = () => {
  const now = new Date();
  const pktTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return pktTime.toISOString().split('T')[0];
};

const getSecondsUntilPktMidnight = () => {
  const now = new Date();
  const pktTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const midnightPkt = new Date(pktTime);
  midnightPkt.setUTCHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((midnightPkt.getTime() - pktTime.getTime()) / 1000));
};

export const getDailyStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const dateStr = getPktDateString();
  const secondsUntilReset = getSecondsUntilPktMidnight();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, points: true, streakCount: true, grade: true, lastStudyDate: true },
  });

  // Check if user completed a daily arena test today
  const attemptsToday = await prisma.standardTestAttempt.findMany({
    where: {
      userId,
      isSubmitted: true,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
    orderBy: { score: 'desc' },
    select: {
      id: true,
      score: true,
      percentage: true,
      totalQuestions: true,
      timeTakenSecs: true,
      telemetry: true,
      createdAt: true,
    },
  });

  const dailyAttempt = attemptsToday.find(
    (a) => a.telemetry && typeof a.telemetry === 'object' && a.telemetry.isDailyArena
  );

  ok(res, {
    date: dateStr,
    secondsUntilReset,
    streakCount: user?.streakCount || 0,
    hasCompletedToday: !!dailyAttempt,
    todayAttempt: dailyAttempt || null,
    userClass: user?.grade || '9',
  });
});

export const generateDailyChallenge = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const dateStr = getPktDateString();
  const { track = '9', mode = 'GRAND', subjectIds = [], questionCount = 10 } = req.body;

  const targetTrack = String(track || '9');
  const rng = createSeededRandom(`${dateStr}-${targetTrack}-${mode}`);

  // 1. Fetch subjects for this track
  let subjects = await prisma.curriculumSubject.findMany({
    where: { classGrade: targetTrack },
    include: { board: true },
  });

  if (subjects.length === 0) {
    subjects = await prisma.curriculumSubject.findMany({
      where: { classGrade: '9' },
      include: { board: true },
    });
  }

  // Filter subjects based on mode
  let selectedSubjects = subjects;
  if (mode === 'SOLO' && subjectIds.length > 0) {
    selectedSubjects = subjects.filter((s) => s.id === subjectIds[0]);
    if (selectedSubjects.length === 0) selectedSubjects = [subjects[0]];
  } else if (mode === 'MULTI' && subjectIds.length > 0) {
    selectedSubjects = subjects.filter((s) => subjectIds.includes(s.id));
    if (selectedSubjects.length === 0) selectedSubjects = subjects.slice(0, 2);
  }

  const selectedSubjectIds = selectedSubjects.map((s) => s.id);

  // 2. Fetch approved questions directly
  let allEligible = await prisma.questionBankItem.findMany({
    where: {
      subjectId: selectedSubjectIds.length === 1 ? selectedSubjectIds[0] : { in: selectedSubjectIds },
      status: 'APPROVED',
    },
    include: {
      subject: true,
      chapter: true,
    },
  });

  // Fallback to any approved questions if chosen subject has no questions yet
  if (allEligible.length === 0) {
    allEligible = await prisma.questionBankItem.findMany({
      where: { status: 'APPROVED' },
      take: 25,
      include: {
        subject: true,
        chapter: true,
      },
    });
  }

  if (allEligible.length === 0) {
    throw new ApiError(404, 'No approved questions available for daily challenge');
  }

  // Deterministic shuffle with daily seed
  const shuffled = [...allEligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const targetCount = Math.min(Math.max(5, Number(questionCount) || 10), 25);
  const picked = shuffled.slice(0, Math.min(targetCount, shuffled.length));
  const firstQ = picked[0];

  const attempt = await prisma.standardTestAttempt.create({
    data: {
      userId,
      boardId: firstQ.boardId || firstQ.subject?.boardId || selectedSubjects[0]?.boardId,
      classGrade: firstQ.classGrade || firstQ.subject?.classGrade || targetTrack,
      subjectId: firstQ.subjectId || selectedSubjects[0]?.id,
      chapterId: firstQ.chapterId,
      questionCount: picked.length,
      difficulty: 'MIXED',
      totalQuestions: picked.length,
      isSubmitted: false,
      telemetry: {
        isDailyArena: true,
        dailyArenaDate: dateStr,
        mode,
        track: targetTrack,
        subjectNames: selectedSubjects.map((s) => s.subjectName),
      },
      questionAttempts: {
        create: picked.map((q, idx) => ({
          questionId: q.id,
          order: idx,
        })),
      },
    },
  });

  const sanitizedQuestions = picked.map((q, idx) => ({
    order: idx,
    questionId: q.id,
    subjectName: q.subjectName,
    chapterName: q.chapterName,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    difficulty: q.difficulty,
  }));

  ok(res, {
    attemptId: attempt.id,
    date: dateStr,
    track: targetTrack,
    mode,
    totalQuestions: picked.length,
    durationSeconds: picked.length * 60, // 60s per question
    questions: sanitizedQuestions,
  });
});

export const submitDailyChallenge = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { attemptId, durationSeconds = 0, responses = [] } = req.body;

  if (!attemptId) throw new ApiError(400, 'attemptId is required');

  const attempt = await prisma.standardTestAttempt.findUnique({
    where: { id: attemptId },
    include: {
      questionAttempts: {
        include: {
          question: {
            include: {
              subject: { select: { subjectName: true } },
              chapter: { select: { chapterName: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt) throw new ApiError(404, 'Daily Arena attempt not found');
  if (attempt.userId !== userId) throw new ApiError(403, 'Forbidden');
  if (attempt.isSubmitted) throw new ApiError(400, 'Attempt has already been submitted');

  const responseMap = new Map();
  for (const r of responses) {
    responseMap.set(r.questionId, r);
  }

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const subjectStats = {};
  const questionUpdates = [];

  for (const qa of attempt.questionAttempts) {
    const q = qa.question;
    const r = responseMap.get(q.id);
    const selectedOption = r?.selectedOption ? String(r.selectedOption).toUpperCase() : null;
    const timeSpentSeconds = Number(r?.timeSpentSeconds) || 0;
    const isCorrect = selectedOption === q.correctAnswer;

    if (!selectedOption) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }

    const subName = q.subject?.subjectName || 'General';
    if (!subjectStats[subName]) {
      subjectStats[subName] = { total: 0, correct: 0, wrong: 0, percentage: 0 };
    }
    subjectStats[subName].total++;
    if (isCorrect) subjectStats[subName].correct++;
    else subjectStats[subName].wrong++;

    questionUpdates.push(
      prisma.standardQuestionAttempt.update({
        where: { id: qa.id },
        data: {
          selectedOption,
          isCorrect,
          timeSpentSeconds,
        },
      })
    );
  }

  // Calculate subject accuracies
  for (const key of Object.keys(subjectStats)) {
    const s = subjectStats[key];
    s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  }

  await prisma.$transaction(questionUpdates);

  const totalQuestions = attempt.questionAttempts.length;
  const score = correctCount;
  const percentage = totalQuestions > 0 ? Number(((score / totalQuestions) * 100).toFixed(1)) : 0;

  // Streak & Bonus XP award
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, streakCount: true, lastStudyDate: true },
  });

  const bonusXp = 50; // Daily Arena bonus XP
  const earnedXp = score * 10 + bonusXp;

  let newStreak = user?.streakCount || 0;
  const lastStudy = user?.lastStudyDate ? new Date(user.lastStudyDate) : null;
  const isDifferentDay = !lastStudy || lastStudy.toDateString() !== now.toDateString();

  if (isDifferentDay) {
    newStreak += 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: earnedXp },
      streakCount: newStreak,
      lastStudyDate: now,
    },
  });

  const updatedAttempt = await prisma.standardTestAttempt.update({
    where: { id: attemptId },
    data: {
      score,
      percentage,
      correctCount,
      wrongCount,
      unansweredCount,
      timeTakenSecs: Number(durationSeconds) || 0,
      isSubmitted: true,
      submittedAt: now,
      chapterMastery: subjectStats,
    },
  });

  const reviewQuestions = attempt.questionAttempts.map((qa) => {
    const q = qa.question;
    const r = responseMap.get(q.id);
    return {
      questionId: q.id,
      questionText: q.questionText,
      subjectName: q.subject?.subjectName,
      chapterName: q.chapter?.chapterName,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      selectedOption: r?.selectedOption || null,
      correctAnswer: q.correctAnswer,
      isCorrect: r?.selectedOption === q.correctAnswer,
      explanation: q.explanation,
    };
  });

  ok(res, {
    attemptId: updatedAttempt.id,
    score,
    totalQuestions,
    percentage,
    correctCount,
    wrongCount,
    unansweredCount,
    timeTakenSecs: updatedAttempt.timeTakenSecs,
    earnedXp,
    bonusXp,
    newStreak,
    subjectBreakdown: subjectStats,
    reviewQuestions,
  });
});

export const getDailyLeaderboard = asyncHandler(async (req, res) => {
  const dateStr = getPktDateString();

  const attempts = await prisma.standardTestAttempt.findMany({
    where: {
      isSubmitted: true,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
    orderBy: [{ score: 'desc' }, { timeTakenSecs: 'asc' }],
    take: 20,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          level: true,
        },
      },
    },
  });

  // Filter daily arena attempts and deduplicate by user (take top score)
  const userMap = new Map();
  for (const a of attempts) {
    if (a.telemetry && typeof a.telemetry === 'object' && a.telemetry.isDailyArena) {
      if (!userMap.has(a.userId)) {
        userMap.set(a.userId, a);
      }
    }
  }

  const leaderboard = Array.from(userMap.values()).map((a, idx) => ({
    rank: idx + 1,
    userId: a.user.id,
    name: a.user.name,
    username: a.user.username,
    avatarUrl: a.user.avatarUrl,
    level: a.user.level,
    score: a.score,
    totalQuestions: a.totalQuestions,
    percentage: a.percentage,
    timeTakenSecs: a.timeTakenSecs,
  }));

  ok(res, {
    date: dateStr,
    leaderboard,
  });
});
