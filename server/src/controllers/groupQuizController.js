import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireMembership } from './groupController.js';
import { evaluateAndAwardAchievements } from '../services/gamificationService.js';
import { POINTS } from '../utils/points.js';

export const createGroupQuiz = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const { quizId, subjectId, chapterId, title } = req.body;

    let actualQuizId = quizId;

    // If question bank subject/chapter provided, auto-create a standard quiz for this group competition
    if (!actualQuizId && (subjectId || chapterId)) {
        const chapter = chapterId ? await prisma.curriculumChapter.findUnique({
            where: { id: chapterId },
            include: { subject: true, questions: { where: { status: 'APPROVED' }, take: 10 } },
        }) : null;

        if (chapter && chapter.questions.length > 0) {
            const createdQuiz = await prisma.quiz.create({
                data: {
                    title: title || `${chapter.chapterName} Group Challenge`,
                    topic: chapter.chapterName,
                    subject: chapter.subject?.subjectName || 'Curriculum',
                    creatorId: req.user.id,
                    source: 'bank',
                    questions: {
                        create: chapter.questions.map((q, idx) => ({
                            question: q.questionText,
                            type: 'MCQ',
                            options: [q.optionA, q.optionB, q.optionC, q.optionD],
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                            order: idx,
                        })),
                    },
                },
            });
            actualQuizId = createdQuiz.id;
        }
    }

    if (!actualQuizId) throw new ApiError(400, 'Quiz ID or curriculum chapter is required');

    const groupQuiz = await prisma.groupQuiz.create({
        data: { groupId: req.params.id, quizId: actualQuizId, status: 'pending' },
    });
    ok(res, { groupQuiz }, 201);
});

export const listGroupQuizzes = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const groupQuizzes = await prisma.groupQuiz.findMany({
        where: { groupId: req.params.id },
        include: { quiz: { select: { title: true, topic: true, difficulty: true } }, _count: { select: { participants: true } } },
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { groupQuizzes });
});

export const startGroupQuiz = asyncHandler(async(req, res) => {
    await requireMembership(req.params.id, req.user.id);
    const groupQuiz = await prisma.groupQuiz.findUnique({ where: { id: req.params.groupQuizId } });
    if (!groupQuiz || groupQuiz.groupId !== req.params.id) throw new ApiError(404, 'Group quiz not found');
    const updated = await prisma.groupQuiz.update({ where: { id: groupQuiz.id }, data: { status: 'active', startedAt: new Date() } });
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
        if (given && given.answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) score += 1;
    }

    const participant = await prisma.groupQuizParticipant.upsert({
        where: { groupQuizId_userId: { groupQuizId: groupQuiz.id, userId: req.user.id } },
        update: { score, timeTakenSecs, submittedAt: new Date() },
        create: { groupQuizId: groupQuiz.id, userId: req.user.id, score, timeTakenSecs, submittedAt: new Date() },
    });

    await prisma.user.update({ where: { id: req.user.id }, data: { points: { increment: POINTS.GROUP_QUIZ_PARTICIPATE } } });

    const allParticipants = await prisma.groupQuizParticipant.findMany({ where: { groupQuizId: groupQuiz.id, submittedAt: { not: null } } });
    const topScore = Math.max(...allParticipants.map((p) => p.score || 0));
    if (score === topScore) {
        await prisma.user.update({ where: { id: req.user.id }, data: { points: { increment: POINTS.GROUP_QUIZ_WINNER } } });
    }

    const groupQuizzesJoined = await prisma.groupQuizParticipant.count({ where: { userId: req.user.id, submittedAt: { not: null } } });
    await evaluateAndAwardAchievements(req.user.id, { quizzesCompleted: 0, streakCount: 0, hasPerfectScore: false, groupQuizzesJoined });

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