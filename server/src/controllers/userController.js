import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveLocalFile } from '../services/storageService.js';
import { SUPPORTED_CLASSES, SUPPORTED_BOARDS } from '../validators/authValidators.js';

export const getProfile = asyncHandler(async(req, res) => {
    const [quizAttempts, achievements, groups, weakTopics] = await Promise.all([
        prisma.quizAttempt.findMany({ where: { userId: req.user.id } }),
        prisma.userAchievement.findMany({ where: { userId: req.user.id }, include: { achievement: true } }),
        prisma.groupMember.findMany({ where: { userId: req.user.id }, include: { group: true } }),
        prisma.userTopicPerformance.findMany({ where: { userId: req.user.id, isWeak: true } }),
    ]);
    const quizzesCompleted = quizAttempts.length;
    const avgAccuracy = quizzesCompleted ?
        quizAttempts.reduce((sum, a) => sum + a.percentage, 0) / quizzesCompleted :
        0;

    ok(res, {
        user: {
            id: req.user.id,
            name: req.user.name,
            username: req.user.username,
            email: req.user.email,
            educationLevel: req.user.educationLevel,
            grade: req.user.grade,
            class: req.user.grade,
            board: req.user.board || 'Punjab',
            level: req.user.level || 1,
            xp: req.user.points || 0,
            points: req.user.points || 0,
            streak: req.user.streakCount || 0,
            streakCount: req.user.streakCount || 0,
            institution: req.user.institution,
            avatarUrl: req.user.avatarUrl,
        },
        stats: { quizzesCompleted, avgAccuracy: Math.round(avgAccuracy) },
        achievements: achievements.map((a) => a.achievement),
        groups: groups.map((g) => g.group),
        weakTopics: weakTopics.map((w) => w.topic),
    });
});

export const updateProfile = asyncHandler(async(req, res) => {
    const { name, grade, class: classVal, board, institution, educationLevel } = req.body;

    const updateData = {};
    if (name !== undefined) {
        if (!name || name.trim().length < 2) throw new ApiError(400, 'Name must be at least 2 characters');
        updateData.name = name.trim();
    }

    const rawGrade = classVal !== undefined ? String(classVal) : (grade !== undefined ? String(grade) : undefined);
    if (rawGrade !== undefined) {
        if (!SUPPORTED_CLASSES.includes(rawGrade)) {
            throw new ApiError(400, 'Class must be 9, 10, 11, or 12');
        }
        updateData.grade = rawGrade;
    }

    if (board !== undefined) {
        const norm = board.trim().toLowerCase();
        const matched = SUPPORTED_BOARDS.find((b) => b.toLowerCase() === norm);
        if (!matched) {
            throw new ApiError(400, 'Board must be Punjab, Federal/FBISE, Sindh, or KPK');
        }
        updateData.board = matched;
    }

    if (institution !== undefined) updateData.institution = institution ? institution.trim() : null;
    if (educationLevel !== undefined) updateData.educationLevel = educationLevel;

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
    });

    ok(res, {
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            educationLevel: user.educationLevel,
            grade: user.grade,
            class: user.grade,
            board: user.board || 'Punjab',
            level: user.level || 1,
            xp: user.points || 0,
            points: user.points || 0,
            streak: user.streakCount || 0,
            streakCount: user.streakCount || 0,
            institution: user.institution,
            avatarUrl: user.avatarUrl,
        },
    });
});

export const changePassword = asyncHandler(async(req, res) => {
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

export const uploadAvatar = asyncHandler(async(req, res) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded');
    const url = saveLocalFile(req.file);
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    ok(res, { avatarUrl: user.avatarUrl });
});