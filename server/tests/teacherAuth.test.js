import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './testApp.js';

let app;
let prisma;
let adminToken;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_teacher_auth';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_teacher_auth';
  ({ app, prisma } = await buildTestApp());

  const passwordHash = await bcrypt.hash('AdminPass123!', 10);
  await prisma.user.create({
    data: {
      name: 'Platform Admin',
      email: 'admin@studify.pk',
      passwordHash,
      role: 'ADMIN',
      teacherStatus: 'NONE',
    },
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'admin@studify.pk',
    password: 'AdminPass123!',
  });
  adminToken = loginRes.body.data.accessToken;
});

describe('Teacher Authentication & Verification Flow', () => {
  let pendingTeacherId;
  let pendingTeacherToken;
  let inviteCode;

  it('prevents privilege escalation on signup when no valid invite code is supplied', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Pending Educator',
      email: 'pending.teacher@studify.pk',
      password: 'Password123',
      confirmPassword: 'Password123',
      class: '9',
      board: 'Punjab',
      accountType: 'TEACHER',
      role: 'TEACHER',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.teacherStatus).toBe('PENDING');

    pendingTeacherId = res.body.data.user.id;
    pendingTeacherToken = res.body.data.accessToken;
  });

  it('blocks unapproved pending educator from accessing /api/teacher/dashboard', async () => {
    const res = await request(app)
      .get('/api/teacher/dashboard')
      .set('Authorization', `Bearer ${pendingTeacherToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks regular student/pending user from admin teacher endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/teachers')
      .set('Authorization', `Bearer ${pendingTeacherToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to approve pending educator and unlocks teacher portal', async () => {
    const approveRes = await request(app)
      .patch(`/api/admin/teachers/${pendingTeacherId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.user.role).toBe('TEACHER');
    expect(approveRes.body.data.user.teacherStatus).toBe('APPROVED');

    const dashRes = await request(app)
      .get('/api/teacher/dashboard')
      .set('Authorization', `Bearer ${pendingTeacherToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.stats.totalClassrooms).toBe(0);
  });

  it('allows admin to create an email-bound invite code and verifies educator signup', async () => {
    const invRes = await request(app)
      .post('/api/admin/teacher-invites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'invited.prof@studify.pk', maxUses: 1, expiresInDays: 7 });

    expect(invRes.status).toBe(201);
    inviteCode = invRes.body.data.invite.code;

    const wrongEmailRes = await request(app).post('/api/auth/signup').send({
      name: 'Wrong User',
      email: 'other.person@studify.pk',
      password: 'Password123',
      confirmPassword: 'Password123',
      class: '9',
      board: 'Punjab',
      accountType: 'TEACHER',
      teacherInviteCode: inviteCode,
    });
    expect(wrongEmailRes.status).toBe(403);

    const okRes = await request(app).post('/api/auth/signup').send({
      name: 'Invited Prof',
      email: 'invited.prof@studify.pk',
      password: 'Password123',
      confirmPassword: 'Password123',
      class: '9',
      board: 'Punjab',
      accountType: 'TEACHER',
      teacherInviteCode: inviteCode,
    });
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.user.role).toBe('TEACHER');
    expect(okRes.body.data.user.teacherStatus).toBe('APPROVED');
  });
});
