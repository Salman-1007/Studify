import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordTopicResult } from '../services/adaptiveLearningService.js';
import { evaluateAndAwardAchievements, applyStreak, POINTS } from '../services/gamificationService.js';

export const listQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { creatorId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, topic: true, subject: true, difficulty: true, createdAt: true, _count: { select: { questions: true } } },
  });
  ok(res, { quizzes });
});

export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id }, include: { questions: true } });
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  // Hide correct answers from the take-quiz view; results are revealed after submission.
  const sanitized = {
    ...quiz,
    questions: quiz.questions.map(({ correctAnswer, explanation, ...q }) => q),
  };
  ok(res, { quiz: sanitized });
});

export const submitAttempt = asyncHandler(async (req, res) => {
  const { answers, timeTakenSecs } = req.body;
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id }, include: { questions: true } });
  if (!quiz) throw new ApiError(404, 'Quiz not found');

  let score = 0;
  const questionAttemptsData = [];
  for (const q of quiz.questions) {
    const given = answers.find((a) => a.questionId === q.id);
    const isCorrect = given && given.answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    if (isCorrect) score += 1;
    questionAttemptsData.push({ questionId: q.id, givenAnswer: given?.answer ?? '', isCorrect: Boolean(isCorrect) });
    await recordTopicResult(req.user.id, quiz.topic, quiz.subject, Boolean(isCorrect));
  }

  const percentage = (score / quiz.questions.length) * 100;
  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id, userId: req.user.id, score, totalQuestions: quiz.questions.length,
      percentage, timeTakenSecs,
      questionAttempts: { create: questionAttemptsData },
    },
    include: { questionAttempts: { include: { question: true } } },
  });

  let pointsEarned = POINTS.QUIZ_COMPLETE;
  if (percentage >= 80) pointsEarned += POINTS.HIGH_SCORE_BONUS;
  const streakCount = await applyStreak(req.user.id);
  if (streakCount % 7 === 0) pointsEarned += POINTS.STREAK_MILESTONE;
  await prisma.user.update({ where: { id: req.user.id }, data: { points: { increment: pointsEarned } } });

  const quizzesCompleted = await prisma.quizAttempt.count({ where: { userId: req.user.id } });
  const groupQuizzesJoined = await prisma.groupQuizParticipant.count({ where: { userId: req.user.id, submittedAt: { not: null } } });
  const awarded = await evaluateAndAwardAchievements(req.user.id, {
    quizzesCompleted, streakCount, hasPerfectScore: percentage === 100, groupQuizzesJoined,
  });

  ok(res, { attempt, pointsEarned, achievementsAwarded: awarded }, 201);
});

export const myAttempts = asyncHandler(async (req, res) => {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: req.user.id },
    include: { quiz: { select: { title: true, topic: true, difficulty: true } } },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { attempts });
});
