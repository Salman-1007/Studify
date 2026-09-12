import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app, ownerToken, memberToken, outsiderToken, groupId;

const register = async (app, overrides) => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'User', username: `u_${Math.random().toString(36).slice(2, 8)}`,
    email: `${Math.random().toString(36).slice(2, 8)}@studify.app`,
    password: 'password123', confirmPassword: 'password123', educationLevel: 'UNIVERSITY',
    ...overrides,
  });
  return res.body.data.accessToken;
};

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access';
  ({ app } = await buildTestApp());
  ownerToken = await register(app);
  memberToken = await register(app);
  outsiderToken = await register(app);
});

describe('Study Groups', () => {
  it('creates a private group with a join code', async () => {
    const res = await request(app).post('/api/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Physics Circle', privacy: 'PRIVATE', subject: 'Physics' });
    expect(res.status).toBe(201);
    expect(res.body.data.group.joinCode).toBeDefined();
    groupId = res.body.data.group.id;
  });

  it('rejects joining a private group with wrong code', async () => {
    const res = await request(app).post(`/api/groups/${groupId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ joinCode: 'WRONGCODE' });
    expect(res.status).toBe(403);
  });

  it('allows joining a private group with the correct code', async () => {
    const groupRes = await request(app).get(`/api/groups/${groupId}`).set('Authorization', `Bearer ${ownerToken}`);
    const joinCode = groupRes.body.data.group.joinCode;
    const res = await request(app).post(`/api/groups/${groupId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ joinCode });
    expect(res.status).toBe(200);
    expect(res.body.data.joined).toBe(true);
  });

  it('blocks a non-member from viewing a private group', async () => {
    const res = await request(app).get(`/api/groups/${groupId}`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('allows a member to leave', async () => {
    const res = await request(app).post(`/api/groups/${groupId}/leave`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.left).toBe(true);
  });

  it('prevents the owner from leaving (must delete instead)', async () => {
    const res = await request(app).post(`/api/groups/${groupId}/leave`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});
