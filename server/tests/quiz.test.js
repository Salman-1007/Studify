import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app, prisma, token, userId, quizId;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access';
  ({ app, prisma } = await buildTestApp());
  const res = await request(app).post('/api/auth/register').send({
    name: 'Quiz Taker', username: 'quiztaker', email: 'quiztaker@studify.app',
    password: 'password123', confirmPassword: 'password123', educationLevel: 'UNIVERSITY',
  });
  token = res.body.data.accessToken;
  userId = res.body.data.user.id;

  const quiz = await prisma.quiz.create({
    data: {
      title: 'Sample Quiz', topic: 'Sample Topic', subject: 'General', difficulty: 'EASY',
      creatorId: userId, source: 'test',
      questions: [
        { id: 'q1', question: '2+2?', type: 'MCQ', options: ['3', '4', '5'], correctAnswer: '4', explanation: 'basic math', order: 0 },
        { id: 'q2', question: 'Sky is blue.', type: 'TRUE_FALSE', options: ['True', 'False'], correctAnswer: 'True', explanation: '', order: 1 },
      ],
    },
  });
  quizId = quiz.id;
});

describe('Quiz attempts', () => {
  it('fetches a quiz without leaking correct answers', async () => {
    const res = await request(app).get(`/api/quizzes/${quizId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.quiz.questions[0].correctAnswer).toBeUndefined();
  });

  it('scores a submitted attempt correctly', async () => {
    const res = await request(app).post(`/api/quizzes/${quizId}/attempt`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [{ questionId: 'q1', answer: '4' }, { questionId: 'q2', answer: 'False' }],
        timeTakenSecs: 30,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.attempt.score).toBe(1);
    expect(res.body.data.attempt.percentage).toBe(50);
    expect(res.body.data.pointsEarned).toBeGreaterThan(0);
  });

  it('reflects the attempt on the global leaderboard', async () => {
    const res = await request(app).get('/api/leaderboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const entry = res.body.data.leaderboard.find((e) => e.id === userId);
    expect(entry.points).toBeGreaterThan(0);
  });
});
