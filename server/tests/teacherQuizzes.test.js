import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aiServicePath = path.resolve(__dirname, '../src/services/aiService.js');

let app;
let prisma;
let teacherToken;
let student1Token;
let student2Token;
let outsiderToken;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_teacher_quizzes';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_teacher_quizzes';

  jest.unstable_mockModule(aiServicePath, () => ({
    generateChatResponse: jest.fn(async () => 'Mock tutor'),
    generateSummary: jest.fn(async () => 'Mock summary'),
    generateFlashcards: jest.fn(async () => ({ cards: [] })),
    generateStudyPlan: jest.fn(async () => ({ plan: [] })),
    generateMistakeDiagnostic: jest.fn(async () => ({ headline: 'OK' })),
    generateQuiz: jest.fn(async ({ topic }) => ({
      title: `${topic} AI Draft`,
      questions: [
        {
          question: 'What is the SI unit of force?',
          type: 'MCQ',
          options: ['Newton', 'Joule', 'Watt', 'Pascal'],
          correctAnswer: 'Newton',
          explanation: 'Force is measured in Newtons (kg·m/s²).',
        },
        {
          question: 'Inertia depends on mass.',
          type: 'TRUE_FALSE',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Mass is the quantitative measure of inertia.',
        },
      ],
    })),
  }));

  ({ app, prisma } = await buildTestApp());

  const reg = async (name, email, makeTeacher = false) => {
    const r = await request(app).post('/api/auth/signup').send({
      name,
      email,
      password: 'Password123',
      confirmPassword: 'Password123',
      class: '9',
      board: 'Punjab',
    });
    if (makeTeacher) {
      await prisma.user.update({
        where: { id: r.body.data.user.id },
        data: { role: 'TEACHER', teacherStatus: 'APPROVED' },
      });
    }
    return r.body.data.accessToken;
  };

  teacherToken = await reg('Prof Newton', 'newton@studify.pk', true);
  student1Token = await reg('Student A', 'sa@studify.pk', false);
  student2Token = await reg('Student B', 'sb@studify.pk', false);
  outsiderToken = await reg('Outsider C', 'oc@studify.pk', false);
});

describe('Teacher Quiz Builder, Immutable Snapshots, Submissions & Analytics', () => {
  let classroomId;
  let draftQuizId;
  let assignmentId;

  it('creates classroom and enrolls two students', async () => {
    const clsRes = await request(app)
      .post('/api/teacher/classrooms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Dynamics Class 9', subject: 'Physics', grade: '9' });
    classroomId = clsRes.body.data.classroom.id;
    const code = clsRes.body.data.classroom.joinCode;

    await request(app)
      .post('/api/classrooms/join-by-code')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ joinCode: code });

    await request(app)
      .post('/api/classrooms/join-by-code')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ joinCode: code });
  });

  it('Mode A: generates editable draft quiz from approved curriculum QuestionBankItems', async () => {
    const subj = await prisma.curriculumSubject.create({
      data: { boardId: 'b1', classGrade: '9', subjectName: 'Physics', code: 'PHY9' },
    });
    const chap = await prisma.curriculumChapter.create({
      data: { subjectId: subj.id, chapterNumber: 3, chapterName: 'Dynamics' },
    });
    await prisma.questionBankItem.create({
      data: {
        subjectId: subj.id,
        chapterId: chap.id,
        questionText: 'F = ma represents which law?',
        optionA: 'First Law',
        optionB: 'Second Law',
        optionC: 'Third Law',
        optionD: 'Gravitation',
        correctAnswer: 'B',
        difficulty: 'MEDIUM',
        status: 'APPROVED',
      },
    });

    const bankRes = await request(app)
      .post('/api/teacher/quizzes/generate-from-bank')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ chapterId: chap.id, count: 5 });

    expect(bankRes.status).toBe(201);
    expect(bankRes.body.data.quiz.status).toBe('DRAFT');
    expect(bankRes.body.data.quiz.questions.length).toBe(1);
    expect(bankRes.body.data.quiz.questions[0].correctAnswer).toBe('Second Law');
  });

  it('Mode B: generates editable draft quiz from uploaded TXT notes via AI service', async () => {
    const uploadRes = await request(app)
      .post('/api/teacher/quizzes/generate-from-notes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('topic', 'Laws of Motion')
      .field('subject', 'Physics')
      .field('difficulty', 'MEDIUM')
      .field('numQuestions', '2')
      .attach(
        'file',
        Buffer.from('Newton second law states force equals mass times acceleration.'),
        { filename: 'dynamics-notes.txt', contentType: 'text/plain' }
      );

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.quiz.status).toBe('DRAFT');
    expect(uploadRes.body.data.quiz.questions.length).toBe(2);
    draftQuizId = uploadRes.body.data.quiz.id;
  });

  it('edits draft quiz, publishes & assigns to classroom, and isolates snapshot from later edits', async () => {
    const assignRes = await request(app)
      .post(`/api/teacher/quizzes/${draftQuizId}/assign`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classroomIds: [classroomId],
        title: 'Dynamics Checkpoint 1',
        maxAttempts: 1,
        durationSecs: 600,
        deadline: new Date(Date.now() + 3600000).toISOString(),
        publishNow: true,
      });

    expect(assignRes.status).toBe(201);
    assignmentId = assignRes.body.data.assignments[0].id;
    expect(assignRes.body.data.assignments[0].questionSnapshot.length).toBe(2);

    // Teacher edits the underlying quiz later -> published assignment snapshot remains untouched
    await request(app)
      .put(`/api/teacher/quizzes/${draftQuizId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        questions: [
          {
            question: 'Edited brand new question?',
            type: 'MCQ',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
          },
        ],
      });
  });

  it('blocks non-enrolled outsider, strips answers on start, grades on server, and blocks duplicate attempts', async () => {
    const outsiderStart = await request(app)
      .post(`/api/classrooms/assignments/${assignmentId}/start`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({});
    expect(outsiderStart.status).toBe(403);

    const startRes = await request(app)
      .post(`/api/classrooms/assignments/${assignmentId}/start`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    expect(startRes.status).toBe(201);
    const qs = startRes.body.data.questions;
    expect(qs.length).toBe(2);
    expect(qs[0].question).toBe('What is the SI unit of force?'); // Snapshot preserved!
    expect(qs[0].correctAnswer).toBeUndefined();
    expect(qs[0].explanation).toBeUndefined();

    // Student 1 gets 2/2 in 45s
    const submit1 = await request(app)
      .post(`/api/classrooms/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        submissionId: startRes.body.data.submission.id,
        answers: [
          { questionId: qs[0].id, answer: 'Newton' },
          { questionId: qs[1].id, answer: 'True' },
        ],
        timeTakenSecs: 45,
      });
    expect(submit1.status).toBe(201);
    expect(submit1.body.data.submission.score).toBe(2);
    expect(submit1.body.data.submission.percentage).toBe(100);

    // Second attempt blocked cleanly (maxAttempts = 1)
    const retryStart = await request(app)
      .post(`/api/classrooms/assignments/${assignmentId}/start`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    expect(retryStart.status).toBe(403);

    // Student 2 gets 1/2 in 30s
    const start2 = await request(app)
      .post(`/api/classrooms/assignments/${assignmentId}/start`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({});
    await request(app)
      .post(`/api/classrooms/assignments/${assignmentId}/submit`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        submissionId: start2.body.data.submission.id,
        answers: [
          { questionId: start2.body.data.questions[0].id, answer: 'Joule' },
          { questionId: start2.body.data.questions[1].id, answer: 'True' },
        ],
        timeTakenSecs: 30,
      });
  });

  it('produces deterministic leaderboard and accurate teacher analytics from DB records', async () => {
    const lbRes = await request(app)
      .get(`/api/classrooms/assignments/${assignmentId}/leaderboard`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(lbRes.status).toBe(200);
    expect(lbRes.body.data.rankings.length).toBe(2);
    expect(lbRes.body.data.rankings[0].name).toBe('Student A');
    expect(lbRes.body.data.rankings[0].score).toBe(2);
    expect(lbRes.body.data.rankings[1].name).toBe('Student B');
    expect(lbRes.body.data.rankings[1].score).toBe(1);

    const analyticsRes = await request(app)
      .get(`/api/teacher/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data.analytics.completedCount).toBe(2);
    expect(analyticsRes.body.data.analytics.pendingCount).toBe(0);
    expect(analyticsRes.body.data.analytics.avgPercentage).toBe(75);
  });
});
