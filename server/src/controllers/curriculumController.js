import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const getBoards = asyncHandler(async(req, res) => {
    const boards = await prisma.board.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            code: true,
            description: true,
            _count: { select: { subjects: true } },
        },
    });
    ok(res, { boards });
});

export const getClasses = asyncHandler(async(req, res) => {
    const { boardId } = req.query;
    const where = boardId ? { boardId } : {};
    const subjects = await prisma.curriculumSubject.findMany({
        where,
        select: { classGrade: true },
        distinct: ['classGrade'],
    });

    const canonicalOrder = ['9', '10', '11', '12', 'MDCAT', 'ECAT'];
    const foundClasses = new Set(subjects.map((s) => s.classGrade));
    // Always include canonical tracks or any in database
    const ordered = canonicalOrder.filter((c) => foundClasses.has(c) || ['9', '10', '11', '12', 'MDCAT', 'ECAT'].includes(c));
    for (const c of foundClasses) {
        if (!ordered.includes(c)) ordered.push(c);
    }

    ok(res, { classes: ordered.length > 0 ? ordered : ['9', '10', '11', '12', 'MDCAT', 'ECAT'] });
});

export const getSubjects = asyncHandler(async(req, res) => {
    const { boardId, classGrade, class: rawClass, gradeLevel } = req.query;
    const targetClass = classGrade || rawClass || gradeLevel ? String(classGrade || rawClass || gradeLevel) : undefined;

    const where = {};
    if (targetClass) where.classGrade = targetClass;
    if (boardId) where.boardId = boardId;

    const subjects = await prisma.curriculumSubject.findMany({
        where,
        orderBy: { subjectName: 'asc' },
        select: {
            id: true,
            boardId: true,
            classGrade: true,
            subjectName: true,
            bookName: true,
            code: true,
            description: true,
            board: { select: { id: true, name: true, code: true } },
            _count: { select: { chapters: true, questions: true } },
        },
    });

    const mappedSubjects = subjects.map((s) => ({
        ...s,
        name: s.subjectName || s.bookName,
        title: s.bookName || s.subjectName,
    }));

    ok(res, { subjects: mappedSubjects });
});

export const getChapters = asyncHandler(async(req, res) => {
    const { subjectId, classGrade, boardId } = req.query;

    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (classGrade || boardId) {
        where.subject = {};
        if (classGrade) where.subject.classGrade = String(classGrade);
        if (boardId) where.subject.boardId = boardId;
    }

    const chapters = await prisma.curriculumChapter.findMany({
        where,
        orderBy: [{ subjectId: 'asc' }, { chapterNumber: 'asc' }],
        select: {
            id: true,
            subjectId: true,
            chapterNumber: true,
            chapterName: true,
            description: true,
            subject: {
                select: {
                    id: true,
                    subjectName: true,
                    bookName: true,
                    classGrade: true,
                },
            },
            topics: {
                select: { id: true, topicName: true },
                orderBy: { topicName: 'asc' },
            },
            _count: {
                select: {
                    questions: {
                        where: { status: 'APPROVED' },
                    },
                },
            },
        },
    });

    const mappedChapters = chapters.map((c) => ({
        ...c,
        title: c.chapterName,
    }));

    ok(res, { chapters: mappedChapters });
});

export const getTopics = asyncHandler(async(req, res) => {
    const { chapterId } = req.query;
    if (!chapterId) throw new ApiError(400, 'chapterId query parameter is required');

    const topics = await prisma.curriculumTopic.findMany({
        where: { chapterId },
        orderBy: { topicName: 'asc' },
        select: {
            id: true,
            chapterId: true,
            topicName: true,
            _count: {
                select: {
                    questions: {
                        where: { status: 'APPROVED' },
                    },
                },
            },
        },
    });

    const mappedTopics = topics.map((t) => ({
        ...t,
        title: t.topicName,
    }));

    ok(res, { topics: mappedTopics });
});