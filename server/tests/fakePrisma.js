import crypto from 'crypto';

// Minimal in-memory stand-in for @prisma/client, covering only the query
// shapes this codebase actually uses in unit tests.
const matches = (row, where = {}) => {
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'OR') return cond.some((sub) => matches(row, sub));
        if (key === 'AND') return cond.every((sub) => matches(row, sub));
        if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
            if ('not' in cond) return row[key] !== cond.not;
            if ('lte' in cond) return new Date(row[key]) <= new Date(cond.lte);
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
        if (v && typeof v === 'object' && !Array.isArray(v) && !('not' in v) && !('lte' in v) && !('gte' in v) && !('contains' in v) && k.includes('_')) {
            Object.assign(flat, v);
        } else {
            flat[k] = v;
        }
    }
    return flat;
};

const DEFAULTS = {
    user: { role: 'STUDENT', isActive: true, points: 0, streakCount: 0, educationLevel: 'OTHER', board: 'Punjab', level: 1 },
    groupMember: { role: 'MEMBER' },
    studyGroup: { privacy: 'PUBLIC' },
    quiz: { difficulty: 'MEDIUM', source: 'ai' },
    flashcard: { interval: 1 },
    notification: { isRead: false },
    groupQuiz: { status: 'pending' },
    questionBankItem: { difficulty: 'MEDIUM', status: 'PENDING_REVIEW', questionType: 'MCQ', sourceType: 'ORIGINAL' },
    standardTestAttempt: { score: 0, totalQuestions: 0, percentage: 0, correctCount: 0, wrongCount: 0, unansweredCount: 0, timeTakenSecs: 0, isSubmitted: false },
    standardQuestionAttempt: { isCorrect: false },
    directChat: { status: 'PENDING' },
    directMessage: { isUnsent: false },
    questionPack: { downloads: 0, isPublished: true },
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
    quizAttempt: {
        questionAttempts: { table: 'questionAttempt', key: 'id', targetKey: 'quizAttemptId', single: false },
        quiz: { table: 'quiz', key: 'quizId', targetKey: 'id', single: true },
    },
    questionAttempt: {
        question: { table: 'question', key: 'questionId', targetKey: 'id', single: true },
    },
    directChat: {
        user1: { table: 'user', key: 'user1Id', targetKey: 'id', single: true },
        user2: { table: 'user', key: 'user2Id', targetKey: 'id', single: true },
        messages: { table: 'directMessage', key: 'id', targetKey: 'chatId', single: false },
    },
    directMessage: {
        chat: { table: 'directChat', key: 'chatId', targetKey: 'id', single: true },
        sender: { table: 'user', key: 'senderId', targetKey: 'id', single: true },
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