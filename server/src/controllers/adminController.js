import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      grade: true,
      board: true,
      points: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { users });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  ok(res, { user });
});

export const listGroups = asyncHandler(async (req, res) => {
  const groups = await prisma.studyGroup.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, messages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { groups });
});

export const listMaterialsAudit = asyncHandler(async (req, res) => {
  const materials = await prisma.material.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { chunks: true, conversations: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  ok(res, { materials });
});

export const deleteMaterial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.material.delete({ where: { id } });
  ok(res, { deleted: true });
});

export const listChatsAudit = asyncHandler(async (req, res) => {
  const [directChats, groupMessages] = await Promise.all([
    prisma.directChat.findMany({
      include: {
        user1: { select: { id: true, name: true, email: true } },
        user2: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { sender: { select: { id: true, name: true } } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
    prisma.groupMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        sender: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
    }),
  ]);

  ok(res, { directChats, recentGroupMessages: groupMessages });
});

export const platformStats = asyncHandler(async (req, res) => {
  const [users, groups, quizzes, attempts, materials, bankQuestions, testAttempts, directChats] =
    await Promise.all([
      prisma.user.count(),
      prisma.studyGroup.count(),
      prisma.quiz.count(),
      prisma.quizAttempt.count(),
      prisma.material.count(),
      prisma.questionBankItem.count({ where: { status: 'APPROVED' } }),
      prisma.standardTestAttempt.count({ where: { isSubmitted: true } }),
      prisma.directChat.count(),
    ]);

  ok(res, {
    users,
    groups,
    quizzes,
    attempts,
    materials,
    bankQuestions,
    testAttempts,
    directChats,
  });
});
