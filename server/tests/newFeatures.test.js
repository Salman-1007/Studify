import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app, prisma;
let student1Token, student1Id, student2Token, student2Id, adminToken;
let directChatId, directMessageId, groupMessageId, groupId;
let chapterId, questionId, attemptId;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_new_features';
  ({ app, prisma } = await buildTestApp());

  // 1. Create Student 1
  const s1Res = await request(app).post('/api/auth/signup').send({
    name: 'Student One',
    email: 'student1@features.local',
    password: 'Password123!',
    class: '9',
    board: 'Punjab',
  });
  student1Token = s1Res.body.data.accessToken;
  student1Id = s1Res.body.data.user.id;

  // 2. Create Student 2
  const s2Res = await request(app).post('/api/auth/signup').send({
    name: 'Student Two',
    email: 'student2@features.local',
    password: 'Password123!',
    class: '9',
    board: 'Punjab',
  });
  student2Token = s2Res.body.data.accessToken;
  student2Id = s2Res.body.data.user.id;

  // 3. Create Admin
  const adminRes = await request(app).post('/api/auth/signup').send({
    name: 'Features Admin',
    email: 'admin@features.local',
    password: 'Password123!',
    class: '9',
    board: 'Federal/FBISE',
  });
  adminToken = adminRes.body.data.accessToken;
  await prisma.user.update({
    where: { id: adminRes.body.data.user.id },
    data: { role: 'ADMIN' },
  });

  // 4. Create Board, Subject, Chapter & Question for tests
  const board = await prisma.board.create({
    data: { name: 'Punjab PECTAA Features', code: `pectaa-feat-${Date.now()}` },
  });
  const subject = await prisma.curriculumSubject.create({
    data: {
      boardId: board.id,
      classGrade: '9',
      subjectName: `Physics Feat ${Date.now()}`,
      bookName: 'Physics 9',
    },
  });
  const chapter = await prisma.curriculumChapter.create({
    data: {
      subjectId: subject.id,
      chapterNumber: 1,
      chapterName: 'Physical Quantities',
    },
  });
  chapterId = chapter.id;

  const q = await prisma.questionBankItem.create({
    data: {
      boardId: board.id,
      classGrade: '9',
      subjectId: subject.id,
      chapterId: chapter.id,
      questionText: 'Which of the following is a base quantity?',
      normalizedText: 'which of the following is a base quantity',
      optionA: 'Speed',
      optionB: 'Mass',
      optionC: 'Force',
      optionD: 'Work',
      correctAnswer: 'B',
      explanation: 'Mass is one of the seven SI base physical quantities.',
      difficulty: 'EASY',
      status: 'APPROVED',
    },
  });
  questionId = q.id;

  // 5. Create Study Group
  const group = await prisma.studyGroup.create({
    data: {
      name: 'Class 9 Physics Squad',
      joinCode: `SQD${Date.now().toString().slice(-5)}`,
      ownerId: student1Id,
      members: {
        create: [
          { userId: student1Id, role: 'OWNER' },
          { userId: student2Id, role: 'MEMBER' },
        ],
      },
    },
  });
  groupId = group.id;
});

describe('1-on-1 Direct Chat & WhatsApp-Style Unsend', () => {
  it('sends a direct chat request from Student 1 to Student 2', async () => {
    const res = await request(app)
      .post('/api/direct-chats/request')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ recipientId: student2Id });

    expect(res.status).toBe(201);
    expect(res.body.data.chat).toBeDefined();
    directChatId = res.body.data.chat.id;
    expect(res.body.data.chat.status).toBe('PENDING');
  });

  it('accepts the chat request as Student 2', async () => {
    const res = await request(app)
      .put(`/api/direct-chats/${directChatId}/status`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ status: 'ACCEPTED' });

    expect(res.status).toBe(200);
    expect(res.body.data.chat.status).toBe('ACCEPTED');
  });

  it('sends a direct message from Student 1', async () => {
    const res = await request(app)
      .post(`/api/direct-chats/${directChatId}/messages`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Hi, can you explain base quantities?' });

    expect(res.status).toBe(201);
    expect(res.body.data.message.content).toBe('Hi, can you explain base quantities?');
    directMessageId = res.body.data.message.id;
  });

  it('unsends the direct message for everyone (WhatsApp style)', async () => {
    const res = await request(app)
      .delete(`/api/direct-chats/messages/${directMessageId}`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message.isUnsent).toBe(true);
    expect(res.body.data.message.content).toBe('This message was unsent');
  });
});

describe('Study Group Message & Unsend', () => {
  it('sends a group message and unsends it', async () => {
    const sendRes = await request(app)
      .post(`/api/groups/${groupId}/messages`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Group quiz starting in 5 minutes!' });

    expect(sendRes.status).toBe(201);
    groupMessageId = sendRes.body.data.message.id;

    const unsendRes = await request(app)
      .delete(`/api/groups/${groupId}/messages/${groupMessageId}`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(unsendRes.status).toBe(200);
    expect(unsendRes.body.data.message.isUnsent).toBe(true);
    expect(unsendRes.body.data.message.content).toBe('This message was unsent');
  });
});

describe('Downloadable Question Bank Packs', () => {
  let packId;

  it('admin creates a question pack', async () => {
    const res = await request(app)
      .post('/api/question-packs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Class 9 Physics Test Pack',
        description: 'Comprehensive chapter 1-9 solved test bank',
        classGrade: '9',
        subjectName: 'Physics',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.pack.title).toBe('Class 9 Physics Test Pack');
    packId = res.body.data.pack.id;
  });

  it('downloads the question pack as formatted JSON', async () => {
    const res = await request(app)
      .get(`/api/question-packs/${packId}/download`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.packTitle).toBe('Class 9 Physics Test Pack');
    expect(Array.isArray(res.body.questions)).toBe(true);
  });
});

describe('Custom Quiz Generation from Canonical Question Bank', () => {
  it('creates a custom quiz from approved questions', async () => {
    const res = await request(app)
      .post('/api/quizzes/from-question-bank')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        chapterId,
        count: 5,
        title: 'Ch 1 Quick Test',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.quiz).toBeDefined();
    expect(res.body.data.quiz.source).toBe('question_bank');
    expect(res.body.data.quiz.questions.length).toBeGreaterThan(0);
  });
});

describe('Enhanced Test Submission & AI Diagnostic', () => {
  it('generates a practice test and submits with telemetry', async () => {
    const genRes = await request(app)
      .post('/api/tests')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ chapterId, questionCount: 1 });

    expect(genRes.status).toBe(201);
    attemptId = genRes.body.data.attempt.id;

    const subRes = await request(app)
      .post(`/api/tests/${attemptId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        answers: [
          {
            questionId,
            selectedOption: 'A', // wrong answer on purpose
            timeSpentSeconds: 12,
            isFlagged: true,
          },
        ],
        durationSeconds: 15,
        tabSwitchCount: 1,
        telemetry: { tab_switch_count: 1 },
      });

    expect(subRes.status).toBe(200);
    expect(subRes.body.data.attempt.tabSwitchCount).toBe(1);
    expect(Array.isArray(subRes.body.data.attempt.chapterMastery)).toBe(true);
  });

  it('generates an AI diagnostic for the submitted test', async () => {
    const res = await request(app)
      .post(`/api/tests/${attemptId}/ai-diagnostic`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.diagnostic).toBeDefined();
    expect(res.body.data.diagnostic.headline).toBeDefined();
  });
});

