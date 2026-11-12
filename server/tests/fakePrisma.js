import crypto from 'crypto';

// Minimal in-memory stand-in for @prisma/client, covering only the query
// shapes this codebase actually uses in unit tests.
const matches = (row, where = {}) => {
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'OR') return cond.some((sub) => matches(row, sub));
        if (key === 'AND') return cond.every((sub) => matches(row, sub));
        if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
            if ('in' in cond) return cond.in.includes(row[key]);
            if ('notIn' in cond) return !cond.notIn.includes(row[key]);
            if ('not' in cond) {
                if (cond.not === null) return row[key] !== null && row[key] !== undefined;
                return row[key] !== cond.not;
            }
            if ('lt' in cond) return new Date(row[key]) < new Date(cond.lt);
            if ('lte' in cond) return new Date(row[key]) <= new Date(cond.lte);
            if ('gt' in cond) return new Date(row[key]) > new Date(cond.gt);
            if ('gte' in cond) return new Date(row[key]) >= new Date(cond.gte);
            if ('contains' in cond) return (row[key] || '').toLowerCase().includes(String(cond.contains).toLowerCase());
            if ('mode' in cond && cond.mode === 'insensitive' && 'contains' in cond) {
                return (row[key] || '').toLowerCase().includes(String(cond.contains).toLowerCase());
            }
            return Object.entries(cond).every(([k, v]) => row[k] === v);
        }
        return row[key] === cond;
    });
};

const resolveWhere = (where) => {
    const flat = {};
    for (const [k, v] of Object.entries(where || {})) {
        if (
            v &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            !(v instanceof Date) &&
            !('not' in v) &&
            !('in' in v) &&
            !('notIn' in v) &&
            !('lt' in v) &&
            !('lte' in v) &&
            !('gt' in v) &&
            !('gte' in v) &&
            !('contains' in v) &&
            k.includes('_')
        ) {
            Object.assign(flat, v);
        } else {
            flat[k] = v;
        }
    }
    return flat;
};

const DEFAULTS = {
    user: { role: 'STUDENT', teacherStatus: 'NONE', themePreference: 'dark', showOnlineStatus: true, isActive: true, points: 0, streakCount: 0, educationLevel: 'OTHER', board: 'Punjab', level: 1 },
    groupMember: { role: 'MEMBER' },
    studyGroup: { privacy: 'PUBLIC' },
    groupMessage: { isUnsent: false, messageType: 'TEXT', isPinned: false },
    quiz: { difficulty: 'MEDIUM', source: 'ai', status: 'PUBLISHED', version: 1, isTeacherQuiz: false },
    flashcard: { interval: 1 },
    notification: { isRead: false },
    groupQuiz: { status: 'pending' },
    questionBankItem: { difficulty: 'MEDIUM', status: 'PENDING_REVIEW', questionType: 'MCQ', sourceType: 'ORIGINAL' },
    standardTestAttempt: { score: 0, totalQuestions: 0, percentage: 0, correctCount: 0, wrongCount: 0, unansweredCount: 0, timeTakenSecs: 0, isSubmitted: false },
    standardQuestionAttempt: { isCorrect: false },
    directChat: { status: 'PENDING' },
    directMessage: { isUnsent: false, messageType: 'TEXT', isPinned: false },
    questionPack: { downloads: 0, isPublished: true },
    teacherInviteCode: { maxUses: 1, usedCount: 0, isRevoked: false },
    classroom: { isArchived: false },
    classroomMembership: { status: 'ACTIVE' },
    classroomInvitation: { usedCount: 0, isRevoked: false },
    classroomAnnouncement: { isPinned: false },
    classroomQuizAssignment: { status: 'DRAFT', quizVersion: 1, maxAttempts: 1, randomizeQuestions: false },
    quizSubmission: { attemptNumber: 1, status: 'IN_PROGRESS', score: 0, percentage: 0, accuracy: 0, timeTakenSecs: 0 },
};

const NESTED_RELATIONS = {
    studyGroup: { members: { table: 'groupMember', fk: 'groupId' } },
    quiz: { questions: { table: 'question', fk: 'quizId' } },
    flashcardDeck: { cards: { table: 'flashcard', fk: 'deckId' } },
    quizAttempt: { questionAttempts: { table: 'questionAttempt', fk: 'quizAttemptId' } },
    standardTestAttempt: { questionAttempts: { table: 'standardQuestionAttempt', fk: 'testAttemptId' } },
};

const RELATIONS_MAP = {
    curriculumChapter: {
        subject: { table: 'curriculumSubject', key: 'subjectId', targetKey: 'id', single: true },
        questions: { table: 'questionBankItem', key: 'id', targetKey: 'chapterId', single: false },
    },
    curriculumSubject: {
        board: { table: 'board', key: 'boardId', targetKey: 'id', single: true },
        chapters: { table: 'curriculumChapter', key: 'id', targetKey: 'subjectId', single: false },
    },
    questionBankItem: {
        subject: { table: 'curriculumSubject', key: 'subjectId', targetKey: 'id', single: true },
        chapter: { table: 'curriculumChapter', key: 'chapterId', targetKey: 'id', single: true },
        board: { table: 'board', key: 'boardId', targetKey: 'id', single: true },
    },
    standardTestAttempt: {
        questionAttempts: { table: 'standardQuestionAttempt', key: 'id', targetKey: 'testAttemptId', single: false },
        board: { table: 'board', key: 'boardId', targetKey: 'id', single: true },
        subject: { table: 'curriculumSubject', key: 'subjectId', targetKey: 'id', single: true },
        chapter: { table: 'curriculumChapter', key: 'chapterId', targetKey: 'id', single: true },
        user: { table: 'user', key: 'userId', targetKey: 'id', single: true },
    },
    standardQuestionAttempt: {
        question: { table: 'questionBankItem', key: 'questionId', targetKey: 'id', single: true },
        testAttempt: { table: 'standardTestAttempt', key: 'testAttemptId', targetKey: 'id', single: true },
    },
    quiz: {
        questions: { table: 'question', key: 'id', targetKey: 'quizId', single: false },
        creator: { table: 'user', key: 'creatorId', targetKey: 'id', single: true },
        assignments: { table: 'classroomQuizAssignment', key: 'id', targetKey: 'quizId', single: false },
    },
    quizAttempt: {
        questionAttempts: { table: 'questionAttempt', key: 'id', targetKey: 'quizAttemptId', single: false },
        quiz: { table: 'quiz', key: 'quizId', targetKey: 'id', single: true },
    },
    questionAttempt: {
        question: { table: 'question', key: 'questionId', targetKey: 'id', single: true },
    },
    studyGroup: {
        members: { table: 'groupMember', key: 'id', targetKey: 'groupId', single: false },
        owner: { table: 'user', key: 'ownerId', targetKey: 'id', single: true },
        classroom: { table: 'classroom', key: 'id', targetKey: 'groupId', single: true },
    },
    groupMember: {
        user: { table: 'user', key: 'userId', targetKey: 'id', single: true },
        group: { table: 'studyGroup', key: 'groupId', targetKey: 'id', single: true },
    },
    groupMessage: {
        sender: { table: 'user', key: 'senderId', targetKey: 'id', single: true },
        group: { table: 'studyGroup', key: 'groupId', targetKey: 'id', single: true },
        replyTo: { table: 'groupMessage', key: 'replyToId', targetKey: 'id', single: true },
        reactions: { table: 'groupMessageReaction', key: 'id', targetKey: 'messageId', single: false },
        deletions: { table: 'groupMessageDeletion', key: 'id', targetKey: 'messageId', single: false },
        receipts: { table: 'groupMessageReceipt', key: 'id', targetKey: 'messageId', single: false },
    },
    groupMessageReaction: {
        user: { table: 'user', key: 'userId', targetKey: 'id', single: true },
    },
    directChat: {
        user1: { table: 'user', key: 'user1Id', targetKey: 'id', single: true },
        user2: { table: 'user', key: 'user2Id', targetKey: 'id', single: true },
        messages: { table: 'directMessage', key: 'id', targetKey: 'chatId', single: false },
    },
    directMessage: {
        chat: { table: 'directChat', key: 'chatId', targetKey: 'id', single: true },
        sender: { table: 'user', key: 'senderId', targetKey: 'id', single: true },
        replyTo: { table: 'directMessage', key: 'replyToId', targetKey: 'id', single: true },
        reactions: { table: 'directMessageReaction', key: 'id', targetKey: 'messageId', single: false },
        deletions: { table: 'directMessageDeletion', key: 'id', targetKey: 'messageId', single: false },
        receipts: { table: 'directMessageReceipt', key: 'id', targetKey: 'messageId', single: false },
    },
    directMessageReaction: {
        user: { table: 'user', key: 'userId', targetKey: 'id', single: true },
    },
    classroom: {
        teacher: { table: 'user', key: 'teacherId', targetKey: 'id', single: true },
        group: { table: 'studyGroup', key: 'groupId', targetKey: 'id', single: true },
        memberships: { table: 'classroomMembership', key: 'id', targetKey: 'classroomId', single: false },
        invitations: { table: 'classroomInvitation', key: 'id', targetKey: 'classroomId', single: false },
        announcements: { table: 'classroomAnnouncement', key: 'id', targetKey: 'classroomId', single: false },
        assignments: { table: 'classroomQuizAssignment', key: 'id', targetKey: 'classroomId', single: false },
    },
    classroomMembership: {
        user: { table: 'user', key: 'userId', targetKey: 'id', single: true },
        classroom: { table: 'classroom', key: 'classroomId', targetKey: 'id', single: true },
    },
    classroomInvitation: {
        classroom: { table: 'classroom', key: 'classroomId', targetKey: 'id', single: true },
        createdBy: { table: 'user', key: 'createdById', targetKey: 'id', single: true },
    },
    classroomAnnouncement: {
        author: { table: 'user', key: 'authorId', targetKey: 'id', single: true },
        classroom: { table: 'classroom', key: 'classroomId', targetKey: 'id', single: true },
    },
    classroomQuizAssignment: {
        classroom: { table: 'classroom', key: 'classroomId', targetKey: 'id', single: true },
        quiz: { table: 'quiz', key: 'quizId', targetKey: 'id', single: true },
        createdBy: { table: 'user', key: 'createdById', targetKey: 'id', single: true },
        submissions: { table: 'quizSubmission', key: 'id', targetKey: 'assignmentId', single: false },
    },
    quizSubmission: {
        user: { table: 'user', key: 'userId', targetKey: 'id', single: true },
        assignment: { table: 'classroomQuizAssignment', key: 'assignmentId', targetKey: 'id', single: true },
        quiz: { table: 'quiz', key: 'quizId', targetKey: 'id', single: true },
    },
};

const attachIncludes = (name, row, include, get) => {
    if (!row || !include) return row;
    const res = {...row };
    const rels = RELATIONS_MAP[name] || {};
    for (const [incKey, incVal] of Object.entries(include)) {
        if (!incVal) continue;
        const rel = rels[incKey];
        if (rel) {
            const targetTable = get(rel.table);
            if (rel.single) {
                const item = targetTable.find((t) => t[rel.targetKey] === row[rel.key]);
                res[incKey] = item ?
                    attachIncludes(rel.table, item, typeof incVal === 'object' && incVal.include ? incVal.include : undefined, get) :
                    null;
            } else {
                let items = targetTable.filter((t) => t[rel.targetKey] === row[rel.key]);
                if (typeof incVal === 'object' && incVal.orderBy) {
                    const [
                        [f, d]
                    ] = Object.entries(incVal.orderBy);
                    items = [...items].sort((a, b) => (d === 'desc' ? b[f] - a[f] : a[f] - b[f]));
                }
                res[incKey] = items.map((item) =>
                    attachIncludes(rel.table, item, typeof incVal === 'object' && incVal.include ? incVal.include : undefined, get)
                );
            }
        }
    }
    return res;
};

export const createFakePrisma = () => {
    const tables = {};
    const get = (name) => (tables[name] = tables[name] || []);

    const makeModel = (name) => ({
        _rows: () => get(name),
        findMany: async({ where, orderBy, take, select, include } = {}) => {
            let rows = get(name).filter((r) => matches(r, resolveWhere(where)));
            if (orderBy) {
                const [
                    [field, dir]
                ] = Object.entries(orderBy);
                rows = [...rows].sort((a, b) => (dir === 'desc' ? b[field] - a[field] || String(b[field]).localeCompare(a[field]) : a[field] - b[field]));
            }
            if (take) rows = rows.slice(0, take);
            return rows.map((r) => attachIncludes(name, r, include, get));
        },
        findUnique: async({ where, include } = {}) => {
            const row = get(name).find((r) => matches(r, resolveWhere(where)));
            return row ? attachIncludes(name, row, include, get) : null;
        },
        findFirst: async({ where, include } = {}) => {
            const row = get(name).find((r) => matches(r, resolveWhere(where)));
            return row ? attachIncludes(name, row, include, get) : null;
        },
        create: async({ data, include } = {}) => {
            const relations = NESTED_RELATIONS[name] || {};
            const plainData = {...data };
            const pendingNested = [];
            for (const [field, rel] of Object.entries(relations)) {
                if (plainData[field] && typeof plainData[field] === 'object') {
                    const spec = plainData[field].create ?? plainData[field];
                    pendingNested.push({ field, rel, items: Array.isArray(spec) ? spec : [spec] });
                    delete plainData[field];
                }
            }
            const row = {
                id: data.id || crypto.randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date(),
                ...(DEFAULTS[name] || {}),
                ...plainData,
            };
            get(name).push(row);
            for (const { field, rel, items }
                of pendingNested) {
                const created = [];
                for (const item of items) {
                    const childRow = {
                        id: crypto.randomUUID(),
                        createdAt: new Date(),
                        ...(DEFAULTS[rel.table] || {}),
                        ...item,
                        [rel.fk]: row.id,
                    };
                    get(rel.table).push(childRow);
                    created.push(childRow);
                }
                row[field] = created;
            }
            return attachIncludes(name, row, include, get);
        },
        createMany: async({ data }) => {
            for (const d of data) get(name).push({ id: crypto.randomUUID(), createdAt: new Date(), ...d });
            return { count: data.length };
        },
        update: async({ where, data, include }) => {
            const row = get(name).find((r) => matches(r, resolveWhere(where)));
            if (!row) throw new Error('Record not found');
            Object.entries(data).forEach(([k, v]) => {
                if (v && typeof v === 'object' && 'increment' in v) row[k] = (row[k] || 0) + v.increment;
                else row[k] = v;
            });
            return attachIncludes(name, row, include, get);
        },
        updateMany: async({ where, data }) => {
            const rows = get(name).filter((r) => matches(r, resolveWhere(where)));
            rows.forEach((row) => Object.assign(row, data));
            return { count: rows.length };
        },
        upsert: async({ where, update, create }) => {
            const row = get(name).find((r) => matches(r, resolveWhere(where)));
            if (row) {
                Object.assign(row, update);
                return {...row };
            }
            const created = {
                id: crypto.randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date(),
                ...(DEFAULTS[name] || {}),
                ...create,
            };
            get(name).push(created);
            return {...created };
        },
        delete: async({ where }) => {
            const idx = get(name).findIndex((r) => matches(r, resolveWhere(where)));
            if (idx === -1) throw new Error('Record not found');
            const [row] = get(name).splice(idx, 1);
            return row;
        },
        deleteMany: async({ where } = {}) => {
            const table = get(name);
            const remaining = [];
            let count = 0;
            for (const r of table) {
                if (matches(r, resolveWhere(where))) count++;
                else remaining.push(r);
            }
            tables[name] = remaining;
            return { count };
        },
        count: async({ where } = {}) => get(name).filter((r) => matches(r, resolveWhere(where))).length,
    });

    const modelNames = [
        'user', 'refreshToken', 'conversation', 'message', 'material', 'materialChunk',
        'quiz', 'question', 'quizAttempt', 'questionAttempt', 'flashcardDeck', 'flashcard',
        'flashcardReview', 'studyGroup', 'groupMember', 'groupMessage', 'groupQuiz',
        'groupQuizParticipant', 'notification', 'achievement', 'userAchievement',
        'studySession', 'userTopicPerformance',
        'board', 'curriculumSubject', 'curriculumChapter', 'curriculumTopic',
        'questionBankItem', 'standardTestAttempt', 'standardQuestionAttempt',
        'directChat', 'directMessage', 'questionPack',
        'teacherInviteCode', 'classroom', 'classroomMembership', 'classroomInvitation',
        'classroomAnnouncement', 'classroomQuizAssignment', 'quizSubmission',
        'groupMessageReaction', 'groupMessageDeletion', 'groupMessageReceipt',
        'directMessageReaction', 'directMessageDeletion', 'directMessageReceipt',
        'conversationPreference',
    ];

    const prisma = {
        $queryRaw: async() => [{ 1: 1 }],
        $disconnect: async() => {},
        $transaction: async(arg) => {
            if (typeof arg === 'function') return arg(prisma);
            return Promise.all(arg);
        },
    };
    for (const m of modelNames) prisma[m] = makeModel(m);
    return prisma;
};