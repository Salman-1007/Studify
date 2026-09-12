import crypto from 'crypto';

// Minimal in-memory stand-in for @prisma/client, covering only the query
// shapes this codebase actually uses. Used ONLY in tests, so we can exercise
// real controller/route logic without a live Postgres + generated engine.
// (In this sandbox, the real Prisma query engine binary could not be
// downloaded — see README "Known limitations". On a normal machine or on
// Render, `npx prisma generate` works fine and this fake is not used.)

const matches = (row, where = {}) => {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((sub) => matches(row, sub));
    if (key === 'AND') return cond.every((sub) => matches(row, sub));
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('not' in cond) return row[key] !== cond.not;
      if ('lte' in cond) return new Date(row[key]) <= new Date(cond.lte);
      if ('gte' in cond) return new Date(row[key]) >= new Date(cond.gte);
      if ('contains' in cond) return (row[key] || '').toLowerCase().includes(String(cond.contains).toLowerCase());
      // compound unique key object e.g. { groupId_userId: { groupId, userId } }
      return Object.entries(cond).every(([k, v]) => row[k] === v);
    }
    return row[key] === cond;
  });
};

const resolveWhere = (where) => {
  // Flatten Prisma's compound-unique syntax: { groupId_userId: {groupId, userId} } -> {groupId, userId}
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

// Mirrors the @default(...) values from schema.prisma that controllers rely on.
const DEFAULTS = {
  user: { role: 'STUDENT', isActive: true, points: 0, streakCount: 0, educationLevel: 'OTHER' },
  groupMember: { role: 'MEMBER' },
  studyGroup: { privacy: 'PUBLIC' },
  quiz: { difficulty: 'MEDIUM', source: 'ai' },
  flashcard: { interval: 1 },
  notification: { isRead: false },
  groupQuiz: { status: 'pending' },
};

// Nested-write support for the handful of `create: { relation: { create: ... } }`
// shapes this codebase actually uses (Prisma normally handles this natively).
const NESTED_RELATIONS = {
  studyGroup: { members: { table: 'groupMember', fk: 'groupId' } },
  quiz: { questions: { table: 'question', fk: 'quizId' } },
  flashcardDeck: { cards: { table: 'flashcard', fk: 'deckId' } },
  quizAttempt: { questionAttempts: { table: 'questionAttempt', fk: 'quizAttemptId' } },
};

export const createFakePrisma = () => {
  const tables = {};
  const get = (name) => (tables[name] ||= []);

  const makeModel = (name) => ({
    _rows: () => get(name),
    findMany: async ({ where, orderBy, take, select, include } = {}) => {
      let rows = get(name).filter((r) => matches(r, resolveWhere(where)));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        rows = [...rows].sort((a, b) => (dir === 'desc' ? b[field] - a[field] || String(b[field]).localeCompare(a[field]) : a[field] - b[field]));
      }
      if (take) rows = rows.slice(0, take);
      return rows.map((r) => ({ ...r }));
    },
    findUnique: async ({ where }) => {
      const row = get(name).find((r) => matches(r, resolveWhere(where)));
      return row ? { ...row } : null;
    },
    findFirst: async ({ where } = {}) => {
      const row = get(name).find((r) => matches(r, resolveWhere(where)));
      return row ? { ...row } : null;
    },
    create: async ({ data }) => {
      const relations = NESTED_RELATIONS[name] || {};
      const plainData = { ...data };
      const pendingNested = [];
      for (const [field, rel] of Object.entries(relations)) {
        if (plainData[field] && typeof plainData[field] === 'object') {
          const spec = plainData[field].create ?? plainData[field];
          pendingNested.push({ field, rel, items: Array.isArray(spec) ? spec : [spec] });
          delete plainData[field];
        }
      }
      const row = {
        id: data.id || crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(),
        ...(DEFAULTS[name] || {}), ...plainData,
      };
      get(name).push(row);
      for (const { field, rel, items } of pendingNested) {
        const created = [];
        for (const item of items) {
          const childRow = {
            id: crypto.randomUUID(), createdAt: new Date(),
            ...(DEFAULTS[rel.table] || {}), ...item, [rel.fk]: row.id,
          };
          get(rel.table).push(childRow);
          created.push(childRow);
        }
        row[field] = created;
      }
      return { ...row };
    },
    createMany: async ({ data }) => {
      for (const d of data) get(name).push({ id: crypto.randomUUID(), createdAt: new Date(), ...d });
      return { count: data.length };
    },
    update: async ({ where, data }) => {
      const row = get(name).find((r) => matches(r, resolveWhere(where)));
      if (!row) throw new Error('Record not found');
      Object.entries(data).forEach(([k, v]) => {
        if (v && typeof v === 'object' && 'increment' in v) row[k] = (row[k] || 0) + v.increment;
        else row[k] = v;
      });
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      const rows = get(name).filter((r) => matches(r, resolveWhere(where)));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    },
    upsert: async ({ where, update, create }) => {
      const row = get(name).find((r) => matches(r, resolveWhere(where)));
      if (row) {
        Object.assign(row, update);
        return { ...row };
      }
      const created = {
        id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(),
        ...(DEFAULTS[name] || {}), ...create,
      };
      get(name).push(created);
      return { ...created };
    },
    delete: async ({ where }) => {
      const idx = get(name).findIndex((r) => matches(r, resolveWhere(where)));
      if (idx === -1) throw new Error('Record not found');
      const [row] = get(name).splice(idx, 1);
      return row;
    },
    count: async ({ where } = {}) => get(name).filter((r) => matches(r, resolveWhere(where))).length,
  });

  const modelNames = [
    'user', 'refreshToken', 'conversation', 'message', 'material', 'materialChunk',
    'quiz', 'question', 'quizAttempt', 'questionAttempt', 'flashcardDeck', 'flashcard',
    'flashcardReview', 'studyGroup', 'groupMember', 'groupMessage', 'groupQuiz',
    'groupQuizParticipant', 'notification', 'achievement', 'userAchievement',
    'studySession', 'userTopicPerformance',
  ];

  const prisma = { $queryRaw: async () => [{ 1: 1 }], $disconnect: async () => {} };
  for (const m of modelNames) prisma[m] = makeModel(m);
  return prisma;
};
