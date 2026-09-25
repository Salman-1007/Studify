import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireMembership } from './groupController.js';
import { evaluateAndAwardAchievements } from '../services/gamificationService.js';
import { POINTS } from '../utils/points.js';

export const createGroupQuiz = asyncHandler(async(req, res) => {
    // Allow any group member to initiate a group quiz
    await requireMembership(req.params.id, req.user.id);

    const { quizId, subjectId, chapterId, title, durationMinutes = 10, startDelaySecs = 0, numQuestions = 10, difficulty = 'MEDIUM' } = req.body;

    let targetQuizId = quizId;

    // If no existing quizId is provided, generate a quiz from the Curriculum Question Bank
    if (!targetQuizId) {
        let whereClause = { status: 'APPROVED' };
        if (chapterId) {
            whereClause.chapterId = chapterId;
        } else if (subjectId) {
            whereClause.chapter = { subjectId };
        }

        const availableQuestions = await prisma.curriculumQuestionBank.findMany({
            where: whereClause,
            take: 40,
        });

        if (availableQuestions.length === 0) {
            throw new ApiError(404, 'No approved questions found for the selected subject/chapter');
        }

        // Shuffle and pick
        const shuffled = availableQuestions.sort(() => 0.5 - Math.random()).slice(0, Math.min(numQuestions, availableQuestions.length));

        const newQuiz = await prisma.quiz.create({
            data: {
                title: title || 'Group Curriculum Challenge',
                topic: 'Punjab Textbook Board',
                subject: 'Physics',
                difficulty,
                creatorId: req.user.id,
                isPublic: true,
                questions: {
                    create: shuffled.map((q, idx) => ({
                        question: q.questionText,
                        type: 'MCQ',
                        options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation || 'Refer to Punjab Textbook Board syllabus.',
                        order: idx,
                    })),
                },
            },
        });

        targetQuizId = newQuiz.id;
    }

    const quiz = await prisma.quiz.findUnique({
        where: { id: targetQuizId },
        include: { questions: true },
    });
    if (!quiz) throw new ApiError(404, 'Quiz not found');

    const durMins = Number(durationMinutes) || 10;
    const delaySecs = Number(startDelaySecs) || 0;

    const now = Date.now();
    const startedAt = delaySecs > 0 ? new Date(now + delaySecs * 1000) : new Date(now);
    const endedAt = new Date(startedAt.getTime() + durMins * 60 * 1000);

    const groupQuiz = await prisma.groupQuiz.create({
        data: {
            groupId: req.params.id,
            quizId: targetQuizId,
            status: delaySecs > 0 ? 'countdown' : 'active',
            startedAt,
            endedAt,
        },
        include: {
            quiz: { select: { id: true, title: true, topic: true, difficulty: true, questions: true } },
        },
    });

    // Post system announcement in group chat
    try {
        const delayNotice = delaySecs > 0 ? ` (starts in ${Math.round(delaySecs / 60)} min)` : '';
        await prisma.groupMessage.create({
            data: {
                groupId: req.params.id,
                senderId: req.user.id,
                content: `🎯 New Group Quiz Challenge: "${quiz.title}" has been scheduled${delayNotice}! Time Limit: ${durMins} minutes. Join the competition!`,
            },
        });
    } catch {
        // Non-blocking chat announcement
    }

    ok(res, { groupQuiz }, 201);
});

export const listGroupQuizzes = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const groupQuizzes = await prisma.groupQuiz.findMany({
        where: { groupId: req.params.id },
        include: {
            quiz: {
                select: {
                    id: true,
                    title: true,
                    topic: true,
                    difficulty: true,
                    questions: { select: { id: true } },
                },
            },
            participants: {
                include: {
                    user: { select: { id: true, name: true, username: true, avatarUrl: true } },
                },
                orderBy: [{ score: 'desc' }, { timeTakenSecs: 'asc' }],
            },
            _count: { select: { participants: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { groupQuizzes });
});

export const startGroupQuiz = asyncHandler(async(req, res) => {
    // Any group member can start or kick off the quiz
    await requireMembership(req.params.id, req.user.id);
    const groupQuiz = await prisma.groupQuiz.findUnique({
        where: { id: req.params.groupQuizId },
        include: { quiz: true },
    });
    if (!groupQuiz || groupQuiz.groupId !== req.params.id) throw new ApiError(404, 'Group quiz not found');

    const { durationMinutes = 10 } = req.body;
    const durMins = Number(durationMinutes) || 10;
    const now = new Date();
    const endedAt = new Date(now.getTime() + durMins * 60 * 1000);

    const updated = await prisma.groupQuiz.update({
        where: { id: groupQuiz.id },
        data: {
            status: 'active',
            startedAt: now,
            endedAt,
        },
        include: { quiz: true },
    });

    try {
        await prisma.groupMessage.create({
            data: {
                groupId: req.params.id,
                senderId: req.user.id,
                content: `🚀 Group Quiz "${groupQuiz.quiz.title}" is NOW LIVE! Duration: ${durMins} minutes. Good luck to everyone!`,
            },
        });
    } catch {
        // Non-blocking
    }

    ok(res, { groupQuiz: updated });
});

export const joinGroupQuiz = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const groupQuiz = await prisma.groupQuiz.findUnique({ where: { id: req.params.groupQuizId } });
    if (!groupQuiz || groupQuiz.groupId !== req.params.id) throw new ApiError(404, 'Group quiz not found');

    const existing = await prisma.groupQuizParticipant.findUnique({
        where: { groupQuizId_userId: { groupQuizId: groupQuiz.id, userId: req.user.id } },
    });
    if (existing) return ok(res, { participant: existing });

    const participant = await prisma.groupQuizParticipant.create({
        data: { groupQuizId: groupQuiz.id, userId: req.user.id },
    });
    ok(res, { participant }, 201);
});

export const submitGroupQuiz = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { answers, timeTakenSecs } = req.body;
    const groupQuiz = await prisma.groupQuiz.findUnique({
        where: { id: req.params.groupQuizId },
        include: { quiz: { include: { questions: true } } },
    });
    if (!groupQuiz || groupQuiz.groupId !== req.params.id) throw new ApiError(404, 'Group quiz not found');

    let score = 0;
    for (const q of groupQuiz.quiz.questions) {
        const given = answers.find((a) => a.questionId === q.id);
        if (given && String(given.answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
            score += 1;
        }
    }

    const participant = await prisma.groupQuizParticipant.upsert({
        where: { groupQuizId_userId: { groupQuizId: groupQuiz.id, userId: req.user.id } },
        update: { score, timeTakenSecs, submittedAt: new Date() },
        create: { groupQuizId: groupQuiz.id, userId: req.user.id, score, timeTakenSecs, submittedAt: new Date() },
    });

    // Award participation XP
    await prisma.user.update({
        where: { id: req.user.id },
        data: { points: { increment: POINTS.GROUP_QUIZ_PARTICIPATE } },
    });

    const allParticipants = await prisma.groupQuizParticipant.findMany({
        where: { groupQuizId: groupQuiz.id, submittedAt: { not: null } },
    });
    const topScore = Math.max(...allParticipants.map((p) => p.score || 0));
    if (score === topScore) {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { points: { increment: POINTS.GROUP_QUIZ_WINNER } },
        });
    }

    const groupQuizzesJoined = await prisma.groupQuizParticipant.count({
        where: { userId: req.user.id, submittedAt: { not: null } },
    });
    await evaluateAndAwardAchievements(req.user.id, {
        quizzesCompleted: 0,
        streakCount: 0,
        hasPerfectScore: false,
        groupQuizzesJoined,
    });

    ok(res, { participant, score, total: groupQuiz.quiz.questions.length });
});

export const endGroupQuiz = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const groupQuiz = await prisma.groupQuiz.findUnique({
        where: { id: req.params.groupQuizId },
        include: {
            quiz: { include: { questions: true } },
            participants: {
                include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
                orderBy: [{ score: 'desc' }, { timeTakenSecs: 'asc' }],
            },
        },
    });
    if (!groupQuiz || groupQuiz.groupId !== req.params.id) throw new ApiError(404, 'Group quiz not found');

    const updated = await prisma.groupQuiz.update({
        where: { id: groupQuiz.id },
        data: {
            status: 'completed',
            endedAt: new Date(),
        },
        include: {
            quiz: true,
            participants: {
                include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
                orderBy: [{ score: 'desc' }, { timeTakenSecs: 'asc' }],
            },
        },
    });

    // Calculate podium and winner announcement
    const submittedParticipants = (updated.participants || []).filter((p) => p.submittedAt !== null);
    const totalQuestions = groupQuiz.quiz?.questions?.length || 10;
    const p1 = submittedParticipants[0];
    const p2 = submittedParticipants[1];
    const p3 = submittedParticipants[2];

    let announcement = `🏆 Group Quiz Competition Ended: "${groupQuiz.quiz?.title || 'Quiz'}"!\n`;
    if (p1 && p1.user) {
        announcement += `🥇 1st Place: ${p1.user.name} (${p1.score || 0}/${totalQuestions})\n`;
    }
    if (p2 && p2.user) {
        announcement += `🥈 2nd Place: ${p2.user.name} (${p2.score || 0}/${totalQuestions})\n`;
    }
    if (p3 && p3.user) {
        announcement += `🥉 3rd Place: ${p3.user.name} (${p3.score || 0}/${totalQuestions})\n`;
    }
    announcement += `\n👏 Congratulations to all ${submittedParticipants.length} students who participated!`;

    try {
        await prisma.groupMessage.create({
            data: {
                groupId: req.params.id,
                senderId: req.user.id,
                content: announcement,
            },
        });
    } catch {
        // Non-blocking
    }

    ok(res, {
        groupQuiz: updated,
        announcement,
        podium: {
            first: p1 || null,
            second: p2 || null,
            third: p3 || null,
        },
        leaderboard: submittedParticipants,
    });
});