import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
    singleQuestionSchema,
    updateQuestionSchema,
    bulkImportSchema,
    normalizeQuestionText,
} from '../validators/questionValidators.js';

export const listQuestions = asyncHandler(async(req, res) => {
    const {
        boardId,
        classGrade,
        subjectId,
        chapterId,
        topicId,
        status,
        difficulty,
        sourceType,
        search,
        page = 1,
        limit = 50,
    } = req.query;

    const where = {};
    if (boardId) where.boardId = boardId;
    if (classGrade) where.classGrade = String(classGrade);
    if (subjectId) where.subjectId = subjectId;
    if (chapterId) where.chapterId = chapterId;
    if (topicId) where.topicId = topicId;
    if (status) where.status = status;
    if (difficulty) where.difficulty = difficulty;
    if (sourceType) where.sourceType = sourceType;

    if (search && search.trim()) {
        where.questionText = { contains: search.trim(), mode: 'insensitive' };
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [total, questions] = await Promise.all([
        prisma.questionBankItem.count({ where }),
        prisma.questionBankItem.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            include: {
                board: { select: { id: true, name: true, code: true } },
                subject: { select: { id: true, subjectName: true, bookName: true } },
                chapter: { select: { id: true, chapterNumber: true, chapterName: true } },
                topic: { select: { id: true, topicName: true } },
            },
        }),
    ]);

    ok(res, {
        questions,
        pagination: {
            total,
            page: Number(page),
            limit: take,
            totalPages: Math.ceil(total / take),
        },
    });
});

export const getQuestion = asyncHandler(async(req, res) => {
    const question = await prisma.questionBankItem.findUnique({
        where: { id: req.params.id },
        include: {
            board: true,
            subject: true,
            chapter: true,
            topic: true,
        },
    });
    if (!question) throw new ApiError(404, 'Question not found');
    ok(res, { question });
});

export const createQuestion = asyncHandler(async(req, res) => {
    const parsed = singleQuestionSchema.parse(req.body);

    // Resolve Curriculum Hierarchy
    let boardId = parsed.boardId;
    if (!boardId && parsed.board) {
        const board = await prisma.board.findFirst({
            where: {
                OR: [
                    { code: parsed.board },
                    { name: { contains: parsed.board, mode: 'insensitive' } },
                ],
            },
        });
        if (!board) throw new ApiError(400, `Board "${parsed.board}" not found in database`);
        boardId = board.id;
    }
    if (!boardId) {
        const defaultBoard = await prisma.board.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!defaultBoard) throw new ApiError(400, 'No board found in database');
        boardId = defaultBoard.id;
    }

    const classGrade = parsed.classGrade || parsed.class || '9';

    let subjectId = parsed.subjectId;
    if (!subjectId) {
        const subjectName = parsed.subject || parsed.book || 'Physics';
        const sub = await prisma.curriculumSubject.findFirst({
            where: {
                boardId,
                classGrade,
                OR: [
                    { subjectName: { contains: subjectName, mode: 'insensitive' } },
                    { bookName: { contains: subjectName, mode: 'insensitive' } },
                ],
            },
        });
        if (!sub) throw new ApiError(400, `Subject "${subjectName}" for Class ${classGrade} not found`);
        subjectId = sub.id;
    }

    let chapterId = parsed.chapterId;
    if (!chapterId) {
        const chParam = parsed.chapter;
        let ch;
        if (chParam && !isNaN(Number(chParam))) {
            ch = await prisma.curriculumChapter.findUnique({
                where: { subjectId_chapterNumber: { subjectId, chapterNumber: Number(chParam) } },
            });
        } else if (chParam) {
            ch = await prisma.curriculumChapter.findFirst({
                where: { subjectId, chapterName: { contains: String(chParam), mode: 'insensitive' } },
            });
        }
        if (!ch) throw new ApiError(400, `Chapter "${chParam}" not found in subject`);
        chapterId = ch.id;
    }

    let topicId = parsed.topicId;
    if (!topicId && parsed.topic) {
        const top = await prisma.curriculumTopic.findFirst({
            where: { chapterId, topicName: { contains: parsed.topic, mode: 'insensitive' } },
        });
        if (top) topicId = top.id;
    }

    const normalizedText = normalizeQuestionText(parsed.questionText);

    // Duplicate Check
    const duplicate = await prisma.questionBankItem.findFirst({
        where: { chapterId, normalizedText },
    });
    if (duplicate) {
        throw new ApiError(409, 'A question with identical content already exists in this chapter');
    }

    const created = await prisma.questionBankItem.create({
        data: {
            boardId,
            classGrade,
            subjectId,
            chapterId,
            topicId: topicId || null,
            questionText: parsed.questionText,
            normalizedText,
            optionA: parsed.optionA,
            optionB: parsed.optionB,
            optionC: parsed.optionC,
            optionD: parsed.optionD,
            correctAnswer: parsed.correctAnswer,
            explanation: parsed.explanation || null,
            difficulty: parsed.difficulty,
            status: parsed.status,
            questionType: parsed.questionType,
            sourceType: parsed.sourceType,
            sourceReference: parsed.sourceReference || null,
            createdById: req.user.id,
        },
        include: {
            board: true,
            subject: true,
            chapter: true,
            topic: true,
        },
    });

    ok(res, { question: {...created, correctOption: created.correctAnswer } }, 201);
});

export const updateQuestion = asyncHandler(async(req, res) => {
    const parsed = updateQuestionSchema.parse(req.body);
    const existing = await prisma.questionBankItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Question not found');

    const data = {...parsed };
    if (parsed.questionText) {
        data.normalizedText = normalizeQuestionText(parsed.questionText);
    }

    // When approving a question, ensure required fields are valid
    if (parsed.status === 'APPROVED') {
        const text = parsed.questionText || existing.questionText;
        const a = parsed.optionA || existing.optionA;
        const b = parsed.optionB || existing.optionB;
        const c = parsed.optionC || existing.optionC;
        const d = parsed.optionD || existing.optionD;
        const correct = parsed.correctAnswer || existing.correctAnswer;

        if (!text || text.length < 5) throw new ApiError(400, 'Cannot approve question: invalid question text');
        if (!a || !b || !c || !d) throw new ApiError(400, 'Cannot approve question: all 4 options must be present');
        if (!['A', 'B', 'C', 'D'].includes(correct)) throw new ApiError(400, 'Cannot approve question: correct answer must be A, B, C, or D');
    }

    const updated = await prisma.questionBankItem.update({
        where: { id: req.params.id },
        data,
        include: {
            board: true,
            subject: true,
            chapter: true,
            topic: true,
        },
    });

    ok(res, { question: {...updated, correctOption: updated.correctAnswer } });
});

export const deleteQuestion = asyncHandler(async(req, res) => {
    const existing = await prisma.questionBankItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Question not found');

    await prisma.questionBankItem.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
});

export const importQuestions = asyncHandler(async(req, res) => {
    const rawBody = req.body;
    const questionsArray = Array.isArray(rawBody) ? rawBody : rawBody.questions;
    if (!questionsArray || !Array.isArray(questionsArray) || questionsArray.length === 0) {
        throw new ApiError(400, 'Invalid import payload: "questions" array is required and must not be empty');
    }

    const payloadBoard = rawBody.board;

    // Resolve default board
    let defaultBoard = null;
    if (payloadBoard) {
        defaultBoard = await prisma.board.findFirst({
            where: {
                OR: [
                    { code: payloadBoard },
                    { name: { contains: payloadBoard, mode: 'insensitive' } },
                ],
            },
        });
    }
    if (!defaultBoard) {
        defaultBoard = await prisma.board.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    if (!defaultBoard) throw new ApiError(400, 'No board registered in the system to attach questions to');

    let importedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const errors = [];
    const duplicateItems = [];
    const batchSeen = new Set();

    for (let i = 0; i < questionsArray.length; i++) {
        const raw = questionsArray[i];
        try {
            const parsed = singleQuestionSchema.parse(raw);

            // Resolve Board
            let boardId = defaultBoard.id;
            if (parsed.boardId) {
                boardId = parsed.boardId;
            } else if (parsed.board && parsed.board !== defaultBoard.code && parsed.board !== defaultBoard.name) {
                const b = await prisma.board.findFirst({
                    where: {
                        OR: [
                            { code: parsed.board },
                            { name: { contains: parsed.board, mode: 'insensitive' } },
                        ],
                    },
                });
                if (b) boardId = b.id;
            }

            const classGrade = String(parsed.classGrade || parsed.class || '9');

            // Resolve Subject
            const subjectName = parsed.subject || parsed.book || 'Physics';
            let subject = await prisma.curriculumSubject.findFirst({
                where: {
                    boardId,
                    classGrade,
                    OR: [
                        { subjectName: { contains: subjectName, mode: 'insensitive' } },
                        { bookName: { contains: subjectName, mode: 'insensitive' } },
                    ],
                },
            });
            if (!subject) {
                // If subject does not exist, create it cleanly
                subject = await prisma.curriculumSubject.create({
                    data: {
                        boardId,
                        classGrade,
                        subjectName,
                        bookName: `${subjectName} ${classGrade}`,
                    },
                });
            }

            // Resolve Chapter
            const chParam = parsed.chapter || '1';
            let chapter = null;
            if (!isNaN(Number(chParam))) {
                chapter = await prisma.curriculumChapter.findUnique({
                    where: { subjectId_chapterNumber: { subjectId: subject.id, chapterNumber: Number(chParam) } },
                });
            }
            if (!chapter) {
                chapter = await prisma.curriculumChapter.findFirst({
                    where: { subjectId: subject.id, chapterName: { contains: String(chParam), mode: 'insensitive' } },
                });
            }
            if (!chapter) {
                const chNum = !isNaN(Number(chParam)) ? Number(chParam) : (await prisma.curriculumChapter.count({ where: { subjectId: subject.id } })) + 1;
                chapter = await prisma.curriculumChapter.create({
                    data: {
                        subjectId: subject.id,
                        chapterNumber: chNum,
                        chapterName: String(chParam),
                    },
                });
            }

            // Resolve Topic
            let topicId = null;
            if (parsed.topic) {
                let topic = await prisma.curriculumTopic.findFirst({
                    where: { chapterId: chapter.id, topicName: { contains: parsed.topic, mode: 'insensitive' } },
                });
                if (!topic) {
                    topic = await prisma.curriculumTopic.create({
                        data: { chapterId: chapter.id, topicName: parsed.topic },
                    });
                }
                topicId = topic.id;
            }

            const normalizedText = normalizeQuestionText(parsed.questionText);
            const batchKey = `${chapter.id}_${normalizedText}`;

            // In-batch duplicate check
            if (batchSeen.has(batchKey)) {
                duplicateCount++;
                duplicateItems.push({ index: i, question: parsed.questionText, reason: 'Duplicate inside import batch' });
                continue;
            }
            batchSeen.add(batchKey);

            // Database duplicate check
            const dbDup = await prisma.questionBankItem.findFirst({
                where: { chapterId: chapter.id, normalizedText },
            });
            if (dbDup) {
                duplicateCount++;
                duplicateItems.push({ index: i, question: parsed.questionText, reason: 'Already exists in question bank' });
                continue;
            }

            // Safe creation
            const sourceObj = typeof raw.source === 'object' && raw.source !== null ? raw.source : {};
            const srcType = parsed.sourceType || sourceObj.type || 'IMPORTED';
            const srcRef = parsed.sourceReference || sourceObj.reference || 'JSON Import';

            await prisma.questionBankItem.create({
                data: {
                    boardId,
                    classGrade,
                    subjectId: subject.id,
                    chapterId: chapter.id,
                    topicId,
                    questionText: parsed.questionText,
                    normalizedText,
                    optionA: parsed.optionA,
                    optionB: parsed.optionB,
                    optionC: parsed.optionC,
                    optionD: parsed.optionD,
                    correctAnswer: parsed.correctAnswer,
                    explanation: parsed.explanation || null,
                    difficulty: parsed.difficulty || 'MEDIUM',
                    status: 'PENDING_REVIEW', // Imported questions enter PENDING_REVIEW as required
                    questionType: 'MCQ',
                    sourceType: srcType,
                    sourceReference: srcRef,
                    createdById: req.user.id,
                },
            });

            importedCount++;
        } catch (err) {
            invalidCount++;
            errors.push({
                index: i,
                question: raw ?.question || raw ?.questionText || `Record #${i + 1}`,
                reason: err.issues ? err.issues.map((it) => `${it.path.join('.')}: ${it.message}`).join(', ') : err.message,
            });
        }
    }

    ok(res, {
        totalRecords: questionsArray.length,
        imported: importedCount,
        importedCount,
        duplicates: duplicateCount,
        skippedCount: duplicateCount,
        invalid: invalidCount,
        duplicateItems,
        errors,
    });
});