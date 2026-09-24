import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const listQuestionPacks = asyncHandler(async(req, res) => {
    // If no packs exist, seed initial default packs based on current curriculum
    const count = await prisma.questionPack.count();
    if (count === 0) {
        const physicsQCount = await prisma.questionBankItem.count({
            where: { classGrade: '9', status: 'APPROVED' },
        });
        await prisma.questionPack.create({
            data: {
                title: 'PTB Class 9 Physics - Complete Question Bank Pack',
                description: 'Official Punjab Textbook Board Class 9 Physics chapter-wise multiple choice questions with verified keys and explanations.',
                classGrade: '9',
                subjectName: 'Physics',
                boardName: 'Punjab Textbook Board / PECTAA',
                totalQuestions: physicsQCount || 20,
                isPublished: true,
            },
        });
    }

    const where = req.user ?.role === 'ADMIN' ? {} : { isPublished: true };
    const packs = await prisma.questionPack.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    ok(res, { packs });
});

export const downloadQuestionPack = asyncHandler(async(req, res) => {
    const { id } = req.params;

    const pack = await prisma.questionPack.findUnique({ where: { id } });
    if (!pack) throw new ApiError(404, 'Question pack not found');

    // Increment download counter
    await prisma.questionPack.update({
        where: { id },
        data: { downloads: { increment: 1 } },
    });

    // Query approved questions for this pack
    const questions = await prisma.questionBankItem.findMany({
        where: {
            classGrade: pack.classGrade,
            status: 'APPROVED',
        },
        include: {
            chapter: { select: { chapterNumber: true, chapterName: true } },
            topic: { select: { topicName: true } },
        },
        orderBy: [{ chapterId: 'asc' }, { createdAt: 'asc' }],
    });

    const exportPayload = {
        packTitle: pack.title,
        curriculum: pack.boardName,
        classGrade: pack.classGrade,
        subject: pack.subjectName,
        exportedAt: new Date().toISOString(),
        totalQuestions: questions.length,
        questions: questions.map((q, idx) => ({
            index: idx + 1,
            chapter: q.chapter ? `Ch. ${q.chapter.chapterNumber}: ${q.chapter.chapterName}` : 'General',
            topic: q.topic ?.topicName || 'General',
            question: q.questionText,
            options: {
                A: q.optionA,
                B: q.optionB,
                C: q.optionC,
                D: q.optionD,
            },
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || 'Verified textbook syllabus solution',
            difficulty: q.difficulty,
        })),
    };

    const filename = `${pack.subjectName.toLowerCase()}-class${pack.classGrade}-question-pack.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(exportPayload, null, 2));
});

export const createQuestionPack = asyncHandler(async(req, res) => {
    const { title, description, classGrade, subjectName, boardName } = req.body;
    if (!title || !classGrade || !subjectName) {
        throw new ApiError(400, 'Title, classGrade, and subjectName are required');
    }

    const qCount = await prisma.questionBankItem.count({
        where: { classGrade: String(classGrade), status: 'APPROVED' },
    });

    const pack = await prisma.questionPack.create({
        data: {
            title,
            description,
            classGrade: String(classGrade),
            subjectName,
            boardName: boardName || 'Punjab Textbook Board / PECTAA',
            totalQuestions: qCount,
            isPublished: true,
        },
    });

    ok(res, { pack }, 201);
});