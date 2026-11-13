import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app;
let prisma;
let userToken;
let userId;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_push';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_push';

  ({ app, prisma } = await buildTestApp());

  const regRes = await request(app).post('/api/auth/signup').send({
    name: 'Push Tester',
    email: 'pushtester@studify.pk',
    password: 'Password123',
    confirmPassword: 'Password123',
    class: '10',
    board: 'Federal',
  });

  userToken = regRes.body.data.accessToken;
  userId = regRes.body.data.user.id;
}, 30000);

describe('Push Notifications & App Notifications Engine', () => {
  const sampleToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

  it('registers an Expo push token for the authenticated user', async () => {
    const res = await request(app)
      .post('/api/notifications/push-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        token: sampleToken,
        platform: 'android',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pushToken.token).toBe(sampleToken);
    expect(res.body.data.pushToken.userId).toBe(userId);
  });

  it('sends a test push notification and saves AppNotification record', async () => {
    const res = await request(app)
      .post('/api/notifications/test-push')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Mock Exam Ready',
        body: 'Your Class 10 Physics test has been graded!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.appNotification).toBeDefined();
    expect(res.body.data.result.appNotification.title).toBe('Mock Exam Ready');
  });

  it('lists AppNotifications for deep linking and mobile drawer', async () => {
    const res = await request(app)
      .get('/api/notifications/app')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(res.body.data.notifications.length).toBeGreaterThan(0);
    expect(res.body.data.notifications[0].title).toBe('Mock Exam Ready');
  });

  it('marks an AppNotification as read', async () => {
    const listRes = await request(app)
      .get('/api/notifications/app')
      .set('Authorization', `Bearer ${userToken}`);

    const notifId = listRes.body.data.notifications[0].id;

    const res = await request(app)
      .patch(`/api/notifications/app/${notifId}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notification.isRead).toBe(true);
  });

  it('de-registers push token on logout or permission revocation', async () => {
    const res = await request(app)
      .delete(`/api/notifications/push-token/${encodeURIComponent(sampleToken)}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
