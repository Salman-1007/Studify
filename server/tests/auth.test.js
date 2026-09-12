import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access';
  process.env.JWT_REFRESH_SECRET = 'test_refresh';
  ({ app } = await buildTestApp());
});

describe('Auth', () => {
  const user = {
    name: 'Test User', username: 'testuser1', email: 'test1@studify.app',
    password: 'password123', confirmPassword: 'password123', educationLevel: 'UNIVERSITY',
  };

  it('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects duplicate email on registration', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: user.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('blocks protected route without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('allows protected route with valid token', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ identifier: user.email, password: user.password });
    const token = loginRes.body.data.accessToken;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(user.username);
  });

  it('logs out and clears refresh cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.data.loggedOut).toBe(true);
  });
});
