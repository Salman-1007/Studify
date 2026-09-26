import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app, prisma;
let studentToken, studentId;
let subjectId, chapterId, questionId;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_daily_arena';
  ({ app, prisma } = await buildTestApp());

  const userRes = await request(app).post('/api/auth/signup').send({
    name: 'Arena Challenger',
    email: 'arena@studify.local',
    password: 'Password123!',
    class: '9',
    board: 'Punjab',
  });
  studentToken = userRes.body.data.accessToken;
  studentId = userRes.body.data.user.id;

  // Setup test curriculum subject, chapter and approved questions
  const board = await prisma.board.create({
    data: { name: 'Arena Board', code: `arena-board-${Date.now()}` },
  });

  const subject = await prisma.curriculumSubject.create({
    data: {
      boardId: board.id,
      classGrade: '9',
      subjectName: 'Physics Arena',
      bookName: 'Physics 9 Arena',
    },
  });
  subjectId = subject.id;

  const chapter = await prisma.curriculumChapter.create({
    data: {
      subjectId: subject.id,
      chapterNumber: 1,
      chapterName: 'Measurements Arena',
    },
  });
  chapterId = chapter.id;

  const q = await prisma.questionBankItem.create({
    data: {
      boardId: board.id,
      classGrade: '9',
      subjectId: subject.id,
      chapterId: chapter.id,
      questionText: 'What is the SI unit of length?',
      normalizedText: 'what is the si unit of length',
      optionA: 'Kilogram',
      optionB: 'Meter',
      optionC: 'Second',
      optionD: 'Ampere',
      correctAnswer: 'B',
      explanation: 'Meter is the fundamental SI base unit of length.',
      status: 'APPROVED',
      difficulty: 'EASY',
    },
  });
  questionId = q.id;
});

describe('Daily Mock Quiz Arena API', () => {
  let attemptId;

  it('GET /api/daily-arena/status returns daily metadata and streak', async () => {
    const res = await request(app)
      .get('/api/daily-arena/status')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('date');
    expect(res.body.data).toHaveProperty('secondsUntilReset');
    expect(res.body.data).toHaveProperty('streakCount');
    expect(res.body.data.hasCompletedToday).toBe(false);
  });

  it('POST /api/daily-arena/generate creates a daily arena challenge', async () => {
    const res = await request(app)
      .post('/api/daily-arena/generate')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        track: '9',
        mode: 'SOLO',
        subjectIds: [subjectId],
        questionCount: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('attemptId');
    expect(res.body.data.questions.length).toBeGreaterThan(0);
    expect(res.body.data.questions[0]).toHaveProperty('questionText');
    expect(res.body.data.questions[0]).not.toHaveProperty('correctAnswer'); // Sanitized!
    attemptId = res.body.data.attemptId;
  });

  it('POST /api/daily-arena/submit evaluates answers and awards daily streak + bonus XP', async () => {
    const res = await request(app)
      .post('/api/daily-arena/submit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        attemptId,
        durationSeconds: 45,
        responses: [
          {
            questionId,
            selectedOption: 'B', // Correct!
            timeSpentSeconds: 15,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBeGreaterThanOrEqual(1);
    expect(res.body.data.bonusXp).toBe(50);
    expect(res.body.data).toHaveProperty('subjectBreakdown');
    expect(res.body.data.reviewQuestions.length).toBeGreaterThan(0);
  });

  it('GET /api/daily-arena/leaderboard returns daily rankings', async () => {
    const res = await request(app)
      .get('/api/daily-arena/leaderboard')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
    expect(res.body.data.leaderboard.length).toBeGreaterThan(0);
    expect(res.body.data.leaderboard[0].score).toBeGreaterThanOrEqual(1);
  });
});
