import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aiServicePath = path.resolve(__dirname, '../src/services/aiService.js');

let app, token;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access';
  jest.unstable_mockModule(aiServicePath, () => ({
    generateChatResponse: jest.fn(async () => 'Mocked tutor response'),
    generateSummary: jest.fn(async () => '## Summary\nMocked summary'),
    generateQuiz: jest.fn(async () => {
      throw new Error('AI returned malformed JSON after retry: Unexpected token');
    }),
    generateFlashcards: jest.fn(async () => ({ cards: [{ front: 'Q', back: 'A' }] })),
    generateStudyPlan: jest.fn(async () => ({ plan: [] })),
    generateMistakeDiagnostic: jest.fn(async () => ({
      headline: 'Mocked diagnostic headline',
      summary: 'Mocked diagnostic summary',
      keyMisconceptions: [],
      recommendedRevisionChapters: ['Kinematics'],
      quickActionPlan: 'Review textbook definitions',
    })),
  }));
  ({ app } = await buildTestApp());
  const res = await request(app).post('/api/auth/register').send({
    name: 'AI User', username: 'aiuser', email: 'aiuser@studify.app',
    password: 'password123', confirmPassword: 'password123', educationLevel: 'UNIVERSITY',
  });
  token = res.body.data.accessToken;
});

describe('AI endpoints (mocked provider)', () => {
  it('returns a mocked chat response and persists it', async () => {
    const res = await request(app).post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Explain Newton\'s first law' });
    expect(res.status).toBe(200);
    expect(res.body.data.message.content).toBe('Mocked tutor response');
    expect(res.body.data.conversationId).toBeDefined();
  });

  it('handles a malformed AI quiz response with a clean 500 instead of crashing', async () => {
    const res = await request(app).post('/api/ai/generate-quiz')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'Algebra', numQuestions: 3 });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('generates flashcards from the mocked provider', async () => {
    const res = await request(app).post('/api/ai/generate-flashcards')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'Algebra', numCards: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.deck.cards.length).toBe(1);
  });
});
