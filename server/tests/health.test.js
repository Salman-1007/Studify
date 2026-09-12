import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

describe('Health check', () => {
  it('returns ok status', async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
