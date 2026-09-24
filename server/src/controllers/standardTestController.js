import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { createTestSchema, submitTestSchema } from '../validators/questionValidators.js';
import { generateMistakeDiagnostic } from '../services/aiService.js';
import { recordTopicResult } from '../services/adaptiveLearningService.js';

// Random Fisher-Yates shuffle
const shuffleArray = (arr) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export const generateTest = asyncHandler(async(req, res) => {
    const parsed = createTestSchema.parse(req.body);

    let chapter = null;
    if (parsed.chapterId) {
        chapter = await prisma.curriculumChapter.findUnique({
            where: { id: parsed.chapterId },
            include: { subject: { include: { board: true } } },
        });
        if (!chapter) throw new ApiError(404, 'Chapter not found');
    }

    const subjectId = parsed.subjectId || chapter?.subjectId;
    const subject = chapter?.subject || await prisma.curriculumSubject.findUnique({
        where: { id: subjectId },
        include: { board: true },
    });
    if (!subject) throw new ApiError(404, 'Subject not found');

    // Filter approved questions only!
    const where = {
        chapterId: chapter.id,
        status: 'APPROVED',
    };
    if (parsed.topicId) where.topicId = parsed.topicId;
    if (parsed.difficulty && parsed.difficulty !== 'MIXED') where.difficulty = parsed.difficulty;

    const eligibleQuestions = await prisma.questionBankItem.findMany({
        where,
        select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            difficulty: true,
            topicId: true,
            topic: { select: { topicName: true } },
        },
    });

    if (eligibleQuestions.length === 0) {
        throw new ApiError(404, 'No approved questions available for this chapter yet');
    }

    // Shuffle and pick requested number
    const shuffled = shuffleArray(eligibleQuestions);
    const selected = shuffled.slice(0, Math.min(parsed.questionCount, shuffled.length));

    // Create attempt in database
    const attempt = await prisma.standardTestAttempt.create({
        data: {
            userId: req.user.id,
            boardId: subject.boardId,
            classGrade: subject.classGrade,
            subjectId: subject.id,
            chapterId: chapter.id,
            questionCount: selected.length,
            difficulty: parsed.difficulty,
            totalQuestions: selected.length,
            isSubmitted: false,
            questionAttempts: {
                create: selected.map((q, idx) => ({
                    questionId: q.id,
                    order: idx,
                })),
            },
        },
        include: {
            board: { select: { id: true, name: true, code: true } },
            subject: { select: { id: true, subjectName: true, bookName: true } },
            chapter: { select: { id: true, chapterNumber: true, chapterName: true } },
            questionAttempts: {
                orderBy: { order: 'asc' },
                include: {
                    question: {
                        select: {
                            id: true,
                            questionText: true,
                            optionA: true,
                            optionB: true,
                            optionC: true,
                            optionD: true,
                            difficulty: true,
                            topic: { select: { topicName: true } },
                        },
                    },
                },
            },
        },
    });

    // Strict Sanitization: Strip any potential answer/explanation
    const sanitizedQuestions = selected.map((q, idx) => ({
        id: q.id,
        questionId: q.id,
        order: idx,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        difficulty: q.difficulty,
        topic: q.topic?.topicName || null,
    }));

    const testTitle = parsed.title || `${subject.bookName || subject.subjectName} Practice Test`;

    ok(
        res, {
            attempt: {
                id: attempt.id,
                title: testTitle,
                board: attempt.board || subject.board,
                classGrade: attempt.classGrade,
                subject: {...subject, name: subject.subjectName, title: subject.bookName },
                chapter: {...chapter, title: chapter.chapterName },
                questionCount: attempt.questionCount,
                difficulty: attempt.difficulty,
                startedAt: attempt.startedAt,
                questions: sanitizedQuestions,
            },
        },
        201
    );
});

export const submitTest = asyncHandler(async(req, res) => {
    const attemptId = req.params.attemptId || req.body.attemptId || req.body.testId;
    if (!attemptId) throw new ApiError(400, 'Attempt ID is required');

    const parsed = submitTestSchema.parse(req.body);

    const attempt = await prisma.standardTestAttempt.findUnique({
        where: { id: attemptId },
        include: {
            chapter: true,
            subject: true,
            board: true,
            questionAttempts: {
                include: {
                    question: {
                        include: {
                            topic: true,
                        },
                    },
                },
            },
        },
    });

    if (!attempt) throw new ApiError(404, 'Test attempt not found');
    if (attempt.userId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new ApiError(403, 'You are not authorized to submit this test attempt');
    }
    if (attempt.isSubmitted) {
        throw new ApiError(400, 'Test attempt has already been submitted');
    }

    // Answer map from client: questionId -> { selectedOption, timeSpentSeconds, isFlagged }
    const answerMap = new Map();
    for (const a of parsed.answers) {
        if (a.questionId) {
            const selected = a.selectedOption ? a.selectedOption.trim().toUpperCase() : null;
            answerMap.set(a.questionId, {
                selectedOption: selected,
                timeSpentSeconds: a.timeSpentSeconds || 0,
                isFlagged: Boolean(a.isFlagged),
            });
        }
    }

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const reviewQuestions = [];
    const topicStats = {};

    // Grade each question server-side
    for (const qa of attempt.questionAttempts) {
        const q = qa.question;
        const ansMeta = answerMap.get(q.id) || { selectedOption: null, timeSpentSeconds: 0, isFlagged: false };
        const selected = ansMeta.selectedOption;
        const isAnswered = selected && ['A', 'B', 'C', 'D'].includes(selected);
        const isCorrect = isAnswered && selected === q.correctAnswer.trim().toUpperCase();

        if (isCorrect) {
            correctCount++;
        } else if (isAnswered) {
            wrongCount++;
        } else {
            unansweredCount++;
        }

        // Track topic stats for chapter mastery breakdown
        const topicName = q.topic?.topicName || attempt.chapter?.chapterName || 'Key Concepts';
        if (!topicStats[topicName]) {
            topicStats[topicName] = { total: 0, correct: 0 };
        }
        topicStats[topicName].total++;
        if (isCorrect) {
            topicStats[topicName].correct++;
        }

        // Update individual question attempt with telemetry
        await prisma.standardQuestionAttempt.update({
            where: { id: qa.id },
            data: {
                selectedOption: selected,
                isCorrect: Boolean(isCorrect),
                timeSpentSeconds: ansMeta.timeSpentSeconds || 0,
                isFlagged: ansMeta.isFlagged || false,
            },
        });

        // Record topic performance for adaptive learning & weak topic detection
        try {
            await recordTopicResult(
                req.user.id,
                topicName,
                attempt.subject?.subjectName || 'Physics',
                Boolean(isCorrect)
            );
        } catch {
            // Ignore minor tracking issues to ensure submission always succeeds
        }

        reviewQuestions.push({
            id: qa.id,
            questionId: q.id,
            order: qa.order,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            selectedOption: selected,
            correctOption: q.correctAnswer,
            correctAnswer: q.correctAnswer,
            isCorrect: Boolean(isCorrect),
            explanation: q.explanation || null,
            difficulty: q.difficulty,
            timeSpentSeconds: ansMeta.timeSpentSeconds || 0,
            isFlagged: ansMeta.isFlagged || false,
            topic: topicName,
        });
    }

    const totalQuestions = attempt.totalQuestions;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const score = correctCount;
    const timeTakenSecs = parsed.timeTakenSecs || 0;
    const avgTimeSecs = totalQuestions > 0 ? parseFloat((timeTakenSecs / totalQuestions).toFixed(1)) : 0;
    const tabSwitchCount = parsed.tabSwitchCount || 0;
    const telemetry = parsed.telemetry || { tab_switch_count: tabSwitchCount };

    // Chapter / Topic mastery mapping
    const chapterMastery = Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        total: stats.total,
        correct: stats.correct,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        status: (stats.correct / stats.total) >= 0.8 ? 'Mastered' : (stats.correct / stats.total) >= 0.5 ? 'Proficient' : 'Needs Practice',
    }));

    // Update attempt record
    const updatedAttempt = await prisma.standardTestAttempt.update({
        where: { id: attempt.id },
        data: {
            score,
            percentage,
            correctCount,
            wrongCount,
            unansweredCount,
            timeTakenSecs,
            avgTimeSecs,
            tabSwitchCount,
            telemetry,
            chapterMastery,
            isSubmitted: true,
            submittedAt: new Date(),
        },
        include: {
            board: true,
            subject: true,
            chapter: true,
        },
    });

    // Calculate XP: 10 base + 2 per correct answer + 15 bonus if percentage >= 80%
    let xpEarned = 10 + correctCount * 2;
    if (percentage >= 80) xpEarned += 15;

    await prisma.user.update({
        where: { id: req.user.id },
        data: {
            points: { increment: xpEarned },
        },
    });

    const sortedQuestions = reviewQuestions.sort((a, b) => a.order - b.order);

    const resultPayload = {
        id: updatedAttempt.id,
        attemptId: updatedAttempt.id,
        score,
        totalQuestions,
        percentage,
        correctCount,
        wrongCount,
        unansweredCount,
        timeTakenSecs,
        timeTakenSeconds: timeTakenSecs,
        avgTimeSecs,
        tabSwitchCount,
        telemetry,
        chapterMastery,
        xpEarned,
        board: updatedAttempt.board.name,
        subject: updatedAttempt.subject.subjectName,
        chapter: updatedAttempt.chapter.chapterName,
        submittedAt: updatedAttempt.submittedAt,
        questions: sortedQuestions,
        questionAttempts: sortedQuestions,
    };

    ok(res, {
        attempt: resultPayload,
        ...resultPayload,
    });
});

export const getTestAttempt = asyncHandler(async(req, res) => {
    const { attemptId } = req.params;

    const attempt = await prisma.standardTestAttempt.findUnique({
        where: { id: attemptId },
        include: {
            board: { select: { id: true, name: true, code: true } },
            subject: { select: { id: true, subjectName: true, bookName: true } },
            chapter: { select: { id: true, chapterNumber: true, chapterName: true } },
            questionAttempts: {
                orderBy: { order: 'asc' },
                include: {
                    question: {
                        include: {
                            topic: true,
                        },
                    },
                },
            },
        },
    });

    if (!attempt) throw new ApiError(404, 'Test attempt not found');
    if (attempt.userId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new ApiError(403, 'Unauthorized access to this test attempt');
    }

    // If submitted, return full review with correct answers, telemetry, explanations, and aiDiagnostic
    if (attempt.isSubmitted) {
        const questions = attempt.questionAttempts.map((qa) => ({
            id: qa.id,
            questionId: qa.question.id,
            questionBankItemId: qa.question.id,
            order: qa.order,
            questionText: qa.question.questionText,
            optionA: qa.question.optionA,
            optionB: qa.question.optionB,
            optionC: qa.question.optionC,
            optionD: qa.question.optionD,
            selectedOption: qa.selectedOption,
            correctOption: qa.question.correctAnswer,
            correctAnswer: qa.question.correctAnswer,
            isCorrect: qa.isCorrect,
            explanation: qa.question.explanation || null,
            difficulty: qa.question.difficulty,
            timeSpentSeconds: qa.timeSpentSeconds || 0,
            isFlagged: qa.isFlagged || false,
            topic: qa.question.topic?.topicName || attempt.chapter?.chapterName || null,
            questionBankItem: qa.question,
        }));

        let parsedAiDiagnostic = null;
        if (attempt.aiDiagnostic) {
            try {
                parsedAiDiagnostic = typeof attempt.aiDiagnostic === 'string' && attempt.aiDiagnostic.startsWith('{') ?
                    JSON.parse(attempt.aiDiagnostic) :
                    attempt.aiDiagnostic;
            } catch {
                parsedAiDiagnostic = attempt.aiDiagnostic;
            }
        }

        const payload = {
            id: attempt.id,
            isSubmitted: true,
            title: `${attempt.subject.bookName || attempt.subject.subjectName} Test Review`,
            score: attempt.score,
            totalQuestions: attempt.totalQuestions,
            percentage: attempt.percentage,
            correctCount: attempt.correctCount,
            wrongCount: attempt.wrongCount,
            unansweredCount: attempt.unansweredCount,
            timeTakenSecs: attempt.timeTakenSecs,
            timeTakenSeconds: attempt.timeTakenSecs,
            avgTimeSecs: attempt.avgTimeSecs || 0,
            tabSwitchCount: attempt.tabSwitchCount || 0,
            telemetry: attempt.telemetry || {},
            chapterMastery: attempt.chapterMastery || [],
            aiDiagnostic: parsedAiDiagnostic,
            xpEarned: attempt.score * 10,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            board: attempt.board,
            subject: {...attempt.subject, name: attempt.subject.subjectName, title: attempt.subject.bookName },
            chapter: {...attempt.chapter, title: attempt.chapter.chapterName },
            questions,
            questionAttempts: questions,
        };

        return ok(res, {
            attempt: payload,
            ...payload,
        });
    }

    // If ongoing, return sanitized questions only (NO ANSWERS)
    const sanitizedQuestions = attempt.questionAttempts.map((qa) => ({
        id: qa.question.id,
        questionId: qa.question.id,
        order: qa.order,
        questionText: qa.question.questionText,
        optionA: qa.question.optionA,
        optionB: qa.question.optionB,
        optionC: qa.question.optionC,
        optionD: qa.question.optionD,
        difficulty: qa.question.difficulty,
        topic: qa.question.topic?.topicName || null,
    }));

    const ongoingPayload = {
        id: attempt.id,
        isSubmitted: false,
        title: `${attempt.subject.bookName || attempt.subject.subjectName} Test`,
        questionCount: attempt.questionCount,
        difficulty: attempt.difficulty,
        startedAt: attempt.startedAt,
        board: attempt.board,
        subject: {...attempt.subject, name: attempt.subject.subjectName, title: attempt.subject.bookName },
        chapter: {...attempt.chapter, title: attempt.chapter.chapterName },
        questions: sanitizedQuestions,
        questionAttempts: sanitizedQuestions,
    };

    ok(res, {
        attempt: ongoingPayload,
        ...ongoingPayload,
    });
});

export const getAiDiagnostic = asyncHandler(async(req, res) => {
    const { attemptId } = req.params;

    const attempt = await prisma.standardTestAttempt.findUnique({
        where: { id: attemptId },
        include: {
            chapter: true,
            subject: true,
            questionAttempts: {
                orderBy: { order: 'asc' },
                include: {
                    question: {
                        include: {
                            topic: true,
                        },
                    },
                },
            },
        },
    });

    if (!attempt) throw new ApiError(404, 'Test attempt not found');
    if (attempt.userId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new ApiError(403, 'Unauthorized access to this test attempt');
    }
    if (!attempt.isSubmitted) {
        throw new ApiError(400, 'Cannot generate diagnostic for an unsubmitted test');
    }

    // If already generated and not forced, return cached diagnostic
    if (attempt.aiDiagnostic && req.query.regenerate !== 'true') {
        let diagnostic = attempt.aiDiagnostic;
        try {
            if (typeof diagnostic === 'string' && diagnostic.startsWith('{')) {
                diagnostic = JSON.parse(diagnostic);
            }
        } catch {}
        return ok(res, { diagnostic });
    }

    // Extract mistakes for diagnostic analysis
    const mistakes = attempt.questionAttempts
        .filter((qa) => !qa.isCorrect)
        .map((qa) => ({
            questionText: qa.question.questionText,
            selectedOption: qa.selectedOption,
            correctOption: qa.question.correctAnswer,
            correctAnswer: qa.question.correctAnswer,
            explanation: qa.question.explanation || '',
            chapterName: qa.question.topic?.topicName || attempt.chapter?.chapterName || 'General',
        }));

    const diagnostic = await generateMistakeDiagnostic({
        testTitle: `${attempt.subject?.bookName || attempt.subject?.subjectName || 'Physics 9'} - ${attempt.chapter?.chapterName || 'Chapter Test'}`,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        mistakes,
    });

    // Save diagnostic back to DB
    await prisma.standardTestAttempt.update({
        where: { id: attempt.id },
        data: {
            aiDiagnostic: typeof diagnostic === 'object' ? JSON.stringify(diagnostic) : String(diagnostic),
        },
    });

    ok(res, { diagnostic });
});

export const getTestHistory = asyncHandler(async(req, res) => {
    const attempts = await prisma.standardTestAttempt.findMany({
        where: {
            userId: req.user.id,
            isSubmitted: true,
        },
        orderBy: { submittedAt: 'desc' },
        include: {
            board: { select: { name: true, code: true } },
            subject: { select: { subjectName: true, bookName: true } },
            chapter: { select: { chapterNumber: true, chapterName: true } },
        },
    });

    const mappedAttempts = attempts.map((a) => {
        const subName = a.subject?.bookName || a.subject?.subjectName || 'Physics 9';
        const chapTitle = a.chapter?.chapterName || 'Chapter';
        return {
            ...a,
            title: `${subName} Test`,
            timeTakenSeconds: a.timeTakenSecs,
            xpEarned: a.score * 10,
            isSubmitted: true,
            subject: a.subject ? {...a.subject, name: a.subject.subjectName, title: a.subject.bookName } : null,
            chapter: a.chapter ? {...a.chapter, title: chapTitle } : null,
        };
    });

    ok(res, { attempts: mappedAttempts, history: mappedAttempts });
});