import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const globalLeaderboard = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { points: 'desc' },
    take: 50,
    select: { id: true, name: true, username: true, avatarUrl: true, points: true, streakCount: true },
  });
  ok(res, { leaderboard: users.map((u, i) => ({ rank: i + 1, ...u })) });
});

export const groupLeaderboard = asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.user.id } } });
  if (!membership) throw new ApiError(403, 'Not a member of this group');

  const participants = await prisma.groupQuizParticipant.findMany({
    where: { groupQuiz: { groupId }, submittedAt: { not: null } },
    include: { user: { select: { id: true, name: true, username: true } } },
  });

  const totals = {};
  for (const p of participants) {
    const key = p.userId;
    if (!totals[key]) totals[key] = { user: p.user, score: 0, timeTakenSecs: 0 };
    totals[key].score += p.score || 0;
    totals[key].timeTakenSecs += p.timeTakenSecs || 0;
  }
  const ranked = Object.values(totals).sort((a, b) => b.score - a.score || a.timeTakenSecs - b.timeTakenSecs);
  ok(res, { leaderboard: ranked.map((r, i) => ({ rank: i + 1, ...r })) });
});

export const quizLeaderboard = asyncHandler(async (req, res) => {
  const groupQuiz = await prisma.groupQuiz.findUnique({
    where: { id: req.params.groupQuizId },
    include: { participants: { include: { user: { select: { id: true, name: true, username: true } } }, orderBy: { score: 'desc' } } },
  });
  if (!groupQuiz) throw new ApiError(404, 'Group quiz not found');
  const ranked = groupQuiz.participants
    .filter((p) => p.submittedAt)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.timeTakenSecs || 0) - (b.timeTakenSecs || 0))
    .map((p, i) => ({ rank: i + 1, user: p.user, score: p.score, timeTakenSecs: p.timeTakenSecs }));
  ok(res, { leaderboard: ranked });
});
