import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [attempts, sessions, topicPerf, groups, deckCount] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { userId }, include: { quiz: true }, orderBy: { createdAt: 'desc' } }),
    prisma.studySession.findMany({ where: { userId } }),
    prisma.userTopicPerformance.findMany({ where: { userId } }),
    prisma.groupMember.count({ where: { userId } }),
    prisma.flashcardDeck.count({ where: { userId } }),
  ]);

  const quizzesCompleted = attempts.length;
  const avgAccuracy = quizzesCompleted ? attempts.reduce((s, a) => s + a.percentage, 0) / quizzesCompleted : 0;
  const totalStudyMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
  const weakTopics = topicPerf.filter((t) => t.isWeak).map((t) => t.topic);

  const bySubject = {};
  for (const a of attempts) {
    const key = a.quiz.subject || a.quiz.topic;
    if (!bySubject[key]) bySubject[key] = { subject: key, attempts: 0, avgPercentage: 0, totalPercentage: 0 };
    bySubject[key].attempts += 1;
    bySubject[key].totalPercentage += a.percentage;
  }
  const subjectPerformance = Object.values(bySubject).map((s) => ({
    subject: s.subject, attempts: s.attempts, avgPercentage: Math.round(s.totalPercentage / s.attempts),
  }));

  ok(res, {
    quizzesCompleted,
    avgAccuracy: Math.round(avgAccuracy),
    totalStudyMinutes,
    streakCount: req.user.streakCount,
    weakTopics,
    subjectPerformance,
    groupsJoined: groups,
    flashcardDecks: deckCount,
    recentAttempts: attempts.slice(0, 10),
  });
});
