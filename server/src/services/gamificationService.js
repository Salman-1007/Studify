import { prisma } from '../config/db.js';
import { POINTS } from '../utils/points.js';

const ACHIEVEMENTS = [
  { code: 'FIRST_QUIZ', title: 'First Quiz', description: 'Completed your first quiz', check: (s) => s.quizzesCompleted >= 1 },
  { code: 'TEN_QUIZZES', title: '10 Quizzes', description: 'Completed 10 quizzes', check: (s) => s.quizzesCompleted >= 10 },
  { code: 'SEVEN_DAY_STREAK', title: '7 Day Streak', description: 'Studied 7 days in a row', check: (s) => s.streakCount >= 7 },
  { code: 'PERFECT_SCORE', title: 'Perfect Score', description: 'Scored 100% on a quiz', check: (s) => s.hasPerfectScore },
  { code: 'GROUP_CHALLENGER', title: 'Group Challenger', description: 'Participated in a group quiz competition', check: (s) => s.groupQuizzesJoined >= 1 },
];

export const ensureAchievementsSeeded = async () => {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: { title: a.title, description: a.description },
      create: { code: a.code, title: a.title, description: a.description },
    });
  }
};

export const evaluateAndAwardAchievements = async (userId, signals) => {
  const awarded = [];
  for (const a of ACHIEVEMENTS) {
    if (!a.check(signals)) continue;
    const achievement = await prisma.achievement.findUnique({ where: { code: a.code } });
    if (!achievement) continue;
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
    }).catch(() => null);
    if (existing) continue;
    await prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } });
    await prisma.notification.create({
      data: { userId, type: 'ACHIEVEMENT', message: `Achievement unlocked: ${a.title}` },
    });
    awarded.push(a.code);
  }
  return awarded;
};

export const applyStreak = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const today = new Date();
  const last = user.lastStudyDate;
  let streakCount = user.streakCount;
  if (!last) {
    streakCount = 1;
  } else {
    const diffDays = Math.floor((today - new Date(last)) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // already counted today
    } else if (diffDays === 1) {
      streakCount += 1;
    } else {
      streakCount = 1;
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { streakCount, lastStudyDate: today } });
  return streakCount;
};

export { POINTS };
