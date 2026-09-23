import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { createTestSchema, submitTestSchema } from '../validators/questionValidators.js';

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

    const subjectId = parsed.subjectId || chapter ?.subjectId;
    const subject = chapter ?.subject || await prisma.curriculumSubject.findUnique({
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
        topic: q.topic ?.topicName || null,
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
    const { attemptId } = req.params;
    const parsed = submitTestSchema.parse(req.body);

    const attempt = await prisma.standardTestAttempt.findUnique({
        where: { id: attemptId },
        include: {
            questionAttempts: {
                include: {
                    question: true,
                },
            },
        },
    });

    if (!attempt) throw new ApiError(404, 'Test attempt not found');
    if (attempt.userId !== req.user.id) {
        throw new ApiError(403, 'You are not authorized to submit this test attempt');
    }
    if (attempt.isSubmitted) {
        throw new ApiError(400, 'Test attempt has already been submitted');
    }

    // Answer map from client
    const answerMap = new Map();
    for (const a of parsed.answers) {
        if (a.questionId) {
            const selected = a.selectedOption ? a.selectedOption.trim().toUpperCase() : null;
            answerMap.set(a.questionId, selected);
        }
    }

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const reviewQuestions = [];

    // Grade each question server-side
    for (const qa of attempt.questionAttempts) {
        const q = qa.question;
        const selected = answerMap.get(q.id) || null;
        const isAnswered = selected && ['A', 'B', 'C', 'D'].includes(selected);
        const isCorrect = isAnswered && selected === q.correctAnswer.trim().toUpperCase();

        if (isCorrect) {
            correctCount++;
        } else if (isAnswered) {
            wrongCount++;
        } else {
            unansweredCount++;
        }

        // Update individual question attempt
        await prisma.standardQuestionAttempt.update({
            where: { id: qa.id },
            data: {
                selectedOption: selected,
                isCorrect: Boolean(isCorrect),
            },
        });

        reviewQuestions.push({
            questionId: q.id,
            order: qa.order,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            selectedOption: selected,
            correctAnswer: q.correctAnswer,
            isCorrect: Boolean(isCorrect),
            explanation: q.explanation || null,
            difficulty: q.difficulty,
        });
    }

    const totalQuestions = attempt.totalQuestions;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const score = correctCount;

    // Update attempt record
    const updatedAttempt = await prisma.standardTestAttempt.update({
        where: { id: attempt.id },
        data: {
            score,
            percentage,
            correctCount,
            wrongCount,
            unansweredCount,
            timeTakenSecs: parsed.timeTakenSecs,
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

    ok(res, {
        attempt: {
            id: updatedAttempt.id,
            score,
            totalQuestions,
            percentage,
            correctCount,
            wrongCount,
            unansweredCount,
            timeTakenSecs: parsed.timeTakenSecs,
            timeTakenSeconds: parsed.timeTakenSecs,
            xpEarned,
            board: updatedAttempt.board.name,
            subject: updatedAttempt.subject.subjectName,
            chapter: updatedAttempt.chapter.chapterName,
            submittedAt: updatedAttempt.submittedAt,
            questions: reviewQuestions.sort((a, b) => a.order - b.order),
            questionAttempts: reviewQuestions.sort((a, b) => a.order - b.order),
        },
        attemptId: updatedAttempt.id,
        score,
        totalQuestions,
        percentage,
        correctCount,
        wrongCount,
        unansweredCount,
        timeTakenSecs: parsed.timeTakenSecs,
        timeTakenSeconds: parsed.timeTakenSecs,
        xpEarned,
        board: updatedAttempt.board.name,
        subject: updatedAttempt.subject.subjectName,
        chapter: updatedAttempt.chapter.chapterName,
        submittedAt: updatedAttempt.submittedAt,
        questions: reviewQuestions.sort((a, b) => a.order - b.order),
        questionAttempts: reviewQuestions.sort((a, b) => a.order - b.order),
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
                include: { question: true },
            },
        },
    });

    if (!attempt) throw new ApiError(404, 'Test attempt not found');
    if (attempt.userId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new ApiError(403, 'Unauthorized access to this test attempt');
    }

    // If submitted, return full review with correct answers and explanations
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
            questionBankItem: qa.question,
        }));

        return ok(res, {
            attempt: {
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
                xpEarned: attempt.score * 10,
                startedAt: attempt.startedAt,
                submittedAt: attempt.submittedAt,
                board: attempt.board,
                subject: {...attempt.subject, name: attempt.subject.subjectName, title: attempt.subject.bookName },
                chapter: {...attempt.chapter, title: attempt.chapter.chapterName },
                questions,
                questionAttempts: questions,
            },
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
    }));

    ok(res, {
        attempt: {
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
        },
    });
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
        const subName = a.subject ?.bookName || a.subject ?.subjectName || 'Physics 9';
        const chapTitle = a.chapter ?.chapterName || 'Chapter';
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