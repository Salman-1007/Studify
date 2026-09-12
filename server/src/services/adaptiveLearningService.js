import { prisma } from '../config/db.js';

// Deterministic weak-topic detection: if a topic's running accuracy falls
// below WEAK_THRESHOLD (with a minimum sample size), it's flagged weak.
// This is intentionally simple — the AI team can later replace this
// function with a real adaptive model without touching callers.
const WEAK_THRESHOLD = 0.6;
const MIN_SAMPLE = 3;

export const recordTopicResult = async (userId, topic, subject, isCorrect) => {
  const existing = await prisma.userTopicPerformance.findUnique({
    where: { userId_topic: { userId, topic } },
  });
  const correctCount = (existing?.correctCount || 0) + (isCorrect ? 1 : 0);
  const totalCount = (existing?.totalCount || 0) + 1;
  const isWeak = totalCount >= MIN_SAMPLE && correctCount / totalCount < WEAK_THRESHOLD;

  await prisma.userTopicPerformance.upsert({
    where: { userId_topic: { userId, topic } },
    update: { correctCount, totalCount, isWeak, subject: subject ?? existing?.subject },
    create: { userId, topic, subject, correctCount, totalCount, isWeak },
  });
};

export const getWeakTopics = async (userId) => {
  return prisma.userTopicPerformance.findMany({ where: { userId, isWeak: true } });
};
