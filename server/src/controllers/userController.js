import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveLocalFile } from '../services/storageService.js';
import { SUPPORTED_CLASSES, SUPPORTED_BOARDS } from '../validators/authValidators.js';

export const getProfile = asyncHandler(async(req, res) => {
    const [user, standardAttempts, quizAttempts, achievements, groups, allTopicPerf, deckCount, reviewCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: req.user.id } }),
        prisma.standardTestAttempt.findMany({
            where: { userId: req.user.id, isSubmitted: true },
            include: { subject: true, chapter: true },
            orderBy: { submittedAt: 'desc' },
        }),
        prisma.quizAttempt.findMany({
            where: { userId: req.user.id },
            include: { quiz: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.userAchievement.findMany({ where: { userId: req.user.id }, include: { achievement: true } }),
        prisma.groupMember.findMany({ where: { userId: req.user.id }, include: { group: true } }),
        prisma.userTopicPerformance.findMany({ where: { userId: req.user.id }, orderBy: { totalCount: 'desc' } }),
        prisma.flashcardDeck.count({ where: { userId: req.user.id } }),
        prisma.flashcardReview.count({ where: { flashcard: { deck: { userId: req.user.id } } } }),
    ]);

    if (!user) throw new ApiError(404, 'User not found');

    const standardTestsCount = standardAttempts.length;
    const customQuizzesCount = quizAttempts.length;
    const quizzesCompleted = standardTestsCount + customQuizzesCount;

    const totalQuestionsAttempted =
        standardAttempts.reduce((sum, a) => sum + (a.totalQuestions || 0), 0) +
        quizAttempts.reduce((sum, a) => sum + (a.totalQuestions || 0), 0);

    const totalQuestionsCorrect =
        standardAttempts.reduce((sum, a) => sum + (a.score || 0), 0) +
        quizAttempts.reduce((sum, a) => sum + (a.score || 0), 0);

    const avgAccuracy = totalQuestionsAttempted > 0 ?
        Math.round((totalQuestionsCorrect / totalQuestionsAttempted) * 100) :
        0;

    // Dynamic Level Calculation from Total XP (Points)
    const points = user.points || 0;
    const dynamicLevel = Math.max(1, Math.floor(points / 100) + 1);
    const levelProgress = points % 100;
    const xpToNextLevel = 100 - levelProgress;

    // Dynamic Weak Topics (accuracy < 60% with at least 1 mistake or flagged isWeak)
    const weakTopics = allTopicPerf
        .filter((t) => t.isWeak || (t.totalCount >= 1 && (t.correctCount / t.totalCount) < 0.6))
        .map((t) => ({
            topic: t.topic,
            subject: t.subject || 'Physics',
            correctCount: t.correctCount,
            totalCount: t.totalCount,
            accuracy: t.totalCount > 0 ? Math.round((t.correctCount / t.totalCount) * 100) : 0,
        }));

    // Dynamic Mastered Topics (accuracy >= 80% with at least 2 attempts)
    const masteredTopics = allTopicPerf
        .filter((t) => t.totalCount >= 2 && (t.correctCount / t.totalCount) >= 0.8)
        .map((t) => ({
            topic: t.topic,
            subject: t.subject || 'Physics',
            correctCount: t.correctCount,
            totalCount: t.totalCount,
            accuracy: Math.round((t.correctCount / t.totalCount) * 100),
        }));

    // Recent combined activity (Standard Tests + Custom Quizzes)
    const recentStandard = standardAttempts.slice(0, 5).map((a) => {
        const subjName = a.subject?.bookName || a.subject?.subjectName;
        const chapName = a.chapter?.chapterName || 'Chapter Test';
        return {
            id: a.id,
            title: subjName ? `${subjName} - ${chapName}` : 'Practice Test',
            score: a.score,
            totalQuestions: a.totalQuestions,
            percentage: Math.round(a.percentage),
            date: a.submittedAt || a.createdAt,
            type: 'Standard Test',
            url: `/tests/${a.id}/results`,
        };
    });

    const recentQuizzes = quizAttempts.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.quiz?.title || 'Practice Quiz',
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: Math.round(a.percentage),
        date: a.createdAt,
        type: 'Quiz',
        url: `/quizzes/${a.quizId}/results`,
    }));

    const recentActivity = [...recentStandard, ...recentQuizzes]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

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
            level: dynamicLevel,
            xp: points,
            points,
            streak: user.streakCount || 0,
            streakCount: user.streakCount || 0,
            institution: user.institution,
            avatarUrl: user.avatarUrl,
        },
        stats: {
            quizzesCompleted,
            standardTestsCount,
            customQuizzesCount,
            totalQuestionsAttempted,
            totalQuestionsCorrect,
            avgAccuracy,
            flashcardDecksCount: deckCount,
            flashcardReviewsCount: reviewCount,
            dynamicLevel,
            levelProgress,
            xpToNextLevel,
        },
        achievements: achievements.map((a) => a.achievement),
        groups: groups.map((g) => g.group),
        weakTopics,
        masteredTopics,
        recentActivity,
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