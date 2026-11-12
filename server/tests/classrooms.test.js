import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app;
let prisma;
let teacher1Token;
let teacher2Token;
let student1Token;
let student1Id;
let student2Token;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_classrooms';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_classrooms';
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
    return { token: r.body.data.accessToken, user: r.body.data.user };
  };

  ({ token: teacher1Token } = await reg('Teacher One', 't1@studify.pk', true));
  ({ token: teacher2Token } = await reg('Teacher Two', 't2@studify.pk', true));
  const s1 = await reg('Student One', 's1@studify.pk', false);
  student1Token = s1.token;
  student1Id = s1.user.id;
  ({ token: student2Token } = await reg('Student Two', 's2@studify.pk', false));
});

describe('Classrooms, Invitations, Announcements & Group Chat Sync', () => {
  let classroomId;
  let joinCode;
  let groupId;
  let inviteToken;
  let inviteId;

  it('allows approved teacher to create classroom with join code and synced group chat', async () => {
    const res = await request(app)
      .post('/api/teacher/classrooms')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({ name: 'Class 9 Physics Batch A', subject: 'Physics', grade: '9' });

    expect(res.status).toBe(201);
    classroomId = res.body.data.classroom.id;
    joinCode = res.body.data.classroom.joinCode;
    groupId = res.body.data.classroom.groupId;
    expect(joinCode).toMatch(/^CLS-/);
    expect(groupId).toBeTruthy();
  });

  it('blocks non-owner teacher from modifying or announcing in another teacher classroom', async () => {
    const res = await request(app)
      .post(`/api/teacher/classrooms/${classroomId}/announcements`)
      .set('Authorization', `Bearer ${teacher2Token}`)
      .send({ content: 'Unauthorized announcement' });
    expect(res.status).toBe(403);
  });

  it('blocks non-member student from viewing classroom detail before joining', async () => {
    const res = await request(app)
      .get(`/api/classrooms/${classroomId}`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(res.status).toBe(403);
  });

  it('enrolls student via valid join code, rejects duplicate enrollment, and grants group chat access', async () => {
    const invalidRes = await request(app)
      .post('/api/classrooms/join-by-code')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ joinCode: 'CLS-INVALID9' });
    expect(invalidRes.status).toBe(404);

    const joinRes = await request(app)
      .post('/api/classrooms/join-by-code')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ joinCode });
    expect(joinRes.status).toBe(201);

    const dupRes = await request(app)
      .post('/api/classrooms/join-by-code')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ joinCode });
    expect(dupRes.status).toBe(409);

    const chatRes = await request(app)
      .get(`/api/groups/${groupId}/messages`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(chatRes.status).toBe(200);
  });

  it('creates classroom announcement and notifies active enrolled students', async () => {
    const annRes = await request(app)
      .post(`/api/teacher/classrooms/${classroomId}/announcements`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({ title: 'Midterm Syllabus', content: 'Chapters 1 to 4 included.', isPinned: true });
    expect(annRes.status).toBe(201);

    const detailRes = await request(app)
      .get(`/api/classrooms/${classroomId}`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.announcements.length).toBe(1);
    expect(detailRes.body.data.announcements[0].isPinned).toBe(true);
  });

  it('supports previewing, joining, and revoking classroom invitation links', async () => {
    const createInv = await request(app)
      .post(`/api/teacher/classrooms/${classroomId}/invitations`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({ expiresInDays: 5, maxUses: 5 });
    expect(createInv.status).toBe(201);
    inviteToken = createInv.body.data.invitation.token;
    inviteId = createInv.body.data.invitation.id;

    const preview = await request(app)
      .get(`/api/classrooms/invitations/${inviteToken}/preview`)
      .set('Authorization', `Bearer ${student2Token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.preview.isValid).toBe(true);

    const revoke = await request(app)
      .patch(`/api/teacher/classrooms/${classroomId}/invitations/${inviteId}/revoke`)
      .set('Authorization', `Bearer ${teacher1Token}`);
    expect(revoke.status).toBe(200);

    const joinRevoked = await request(app)
      .post(`/api/classrooms/invitations/${inviteToken}/join`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({});
    expect(joinRevoked.status).toBe(400);
  });

  it('removes student from both classroom and synchronized group chat', async () => {
    const delRes = await request(app)
      .delete(`/api/teacher/classrooms/${classroomId}/members/${student1Id}`)
      .set('Authorization', `Bearer ${teacher1Token}`);
    expect(delRes.status).toBe(200);

    const clsRes = await request(app)
      .get(`/api/classrooms/${classroomId}`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(clsRes.status).toBe(403);

    const grpRes = await request(app)
      .get(`/api/groups/${groupId}/messages`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(grpRes.status).toBe(403);
  });
});
