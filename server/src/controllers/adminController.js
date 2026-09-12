import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, username: true, role: true, isActive: true, createdAt: true, points: true },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { users });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  ok(res, { user });
});

export const listGroups = asyncHandler(async (req, res) => {
  const groups = await prisma.studyGroup.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { groups });
});

export const platformStats = asyncHandler(async (req, res) => {
  const [users, groups, quizzes, attempts, materials] = await Promise.all([
    prisma.user.count(),
    prisma.studyGroup.count(),
    prisma.quiz.count(),
    prisma.quizAttempt.count(),
    prisma.material.count(),
  ]);
  ok(res, { users, groups, quizzes, attempts, materials });
});
