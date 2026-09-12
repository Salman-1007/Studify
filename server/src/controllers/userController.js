import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveLocalFile } from '../services/storageService.js';

export const getProfile = asyncHandler(async (req, res) => {
  const [quizAttempts, achievements, groups, weakTopics] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { userId: req.user.id } }),
    prisma.userAchievement.findMany({ where: { userId: req.user.id }, include: { achievement: true } }),
    prisma.groupMember.findMany({ where: { userId: req.user.id }, include: { group: true } }),
    prisma.userTopicPerformance.findMany({ where: { userId: req.user.id, isWeak: true } }),
  ]);
  const quizzesCompleted = quizAttempts.length;
  const avgAccuracy = quizzesCompleted
    ? quizAttempts.reduce((sum, a) => sum + a.percentage, 0) / quizzesCompleted
    : 0;

  ok(res, {
    user: {
      id: req.user.id, name: req.user.name, username: req.user.username, email: req.user.email,
      educationLevel: req.user.educationLevel, grade: req.user.grade, institution: req.user.institution,
      avatarUrl: req.user.avatarUrl, points: req.user.points, streakCount: req.user.streakCount,
    },
    stats: { quizzesCompleted, avgAccuracy: Math.round(avgAccuracy) },
    achievements: achievements.map((a) => a.achievement),
    groups: groups.map((g) => g.group),
    weakTopics: weakTopics.map((w) => w.topic),
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, grade, institution, educationLevel } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, grade, institution, educationLevel },
  });
  ok(res, { user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'currentPassword and a newPassword of at least 8 characters are required');
  }
  const match = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!match) throw new ApiError(401, 'Current password is incorrect');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  ok(res, { changed: true });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const url = saveLocalFile(req.file);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
  ok(res, { avatarUrl: user.avatarUrl });
});
