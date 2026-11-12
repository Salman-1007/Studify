import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app;
let user1Token, user1Id;
let user2Token, user2Id;
let outsiderToken;
let chatId;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_messaging';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_messaging';
  ({ app } = await buildTestApp());

  const reg = async (name, email) => {
    const r = await request(app).post('/api/auth/signup').send({
      name,
      email,
      password: 'Password123',
      confirmPassword: 'Password123',
      class: '9',
      board: 'Punjab',
    });
    return { token: r.body.data.accessToken, id: r.body.data.user.id };
  };

  ({ token: user1Token, id: user1Id } = await reg('Alice Chat', 'alice@studify.pk'));
  ({ token: user2Token, id: user2Id } = await reg('Bob Chat', 'bob@studify.pk'));
  ({ token: outsiderToken } = await reg('Eve Outsider', 'eve@studify.pk'));

  const chatRes = await request(app)
    .post('/api/direct-chats/request')
    .set('Authorization', `Bearer ${user1Token}`)
    .send({ recipientId: user2Id });
  chatId = chatRes.body.data.chat.id;

  await request(app)
    .put(`/api/direct-chats/${chatId}/status`)
    .set('Authorization', `Bearer ${user2Token}`)
    .send({ status: 'ACCEPTED' });
});

describe('Real-Time Messaging Upgrade (Direct & Group)', () => {
  let msg1Id;
  let msg2Id;

  it('sends direct message with reply reference, blocks outsiders', async () => {
    const s1 = await request(app)
      .post(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ content: 'Formula for acceleration?' });
    expect(s1.status).toBe(201);
    msg1Id = s1.body.data.message.id;

    const s2 = await request(app)
      .post(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ content: 'a = (v - u) / t', replyToId: msg1Id });
    expect(s2.status).toBe(201);
    expect(s2.body.data.message.replyTo.id).toBe(msg1Id);
    msg2Id = s2.body.data.message.id;

    const outsiderRead = await request(app)
      .get(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(outsiderRead.status).toBe(403);
  });

  it('enforces sender-only editing with editedAt timestamp', async () => {
    const unauthorizedEdit = await request(app)
      .patch(`/api/direct-chats/${chatId}/messages/${msg1Id}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ content: 'Tampered content' });
    expect(unauthorizedEdit.status).toBe(403);

    const okEdit = await request(app)
      .patch(`/api/direct-chats/${chatId}/messages/${msg1Id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ content: 'Formula for linear acceleration?' });
    expect(okEdit.status).toBe(200);
    expect(okEdit.body.data.message.editedAt).toBeTruthy();
    expect(okEdit.body.data.message.content).toBe('Formula for linear acceleration?');
  });

  it('toggles emoji reactions and validates allowed emoji set', async () => {
    const badEmoji = await request(app)
      .post(`/api/direct-chats/${chatId}/messages/${msg2Id}/reactions`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ emoji: '🤖' });
    expect(badEmoji.status).toBe(400);

    const addReact = await request(app)
      .post(`/api/direct-chats/${chatId}/messages/${msg2Id}/reactions`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ emoji: '🔥' });
    expect(addReact.status).toBe(200);
    expect(addReact.body.data.message.reactionSummary[0].count).toBe(1);

    const removeReact = await request(app)
      .post(`/api/direct-chats/${chatId}/messages/${msg2Id}/reactions`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ emoji: '🔥' });
    expect(removeReact.status).toBe(200);
    expect(removeReact.body.data.message.reactionSummary.length).toBe(0);
  });

  it('marks read receipts and resets unread counters cleanly', async () => {
    const readRes = await request(app)
      .post(`/api/direct-chats/${chatId}/read`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ messageIds: [msg2Id] });
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.messageIds).toContain(msg2Id);

    const listRes = await request(app)
      .get(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${user2Token}`);
    const seenMsg = listRes.body.data.messages.find((m) => m.id === msg2Id);
    expect(seenMsg.deliveryStatus).toBe('SEEN');
  });

  it('isolates delete-for-me to current user and redacts delete-for-everyone from API & search', async () => {
    const delForMe = await request(app)
      .delete(`/api/direct-chats/${chatId}/messages/${msg1Id}/for-me`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(delForMe.status).toBe(200);

    const u1List = await request(app)
      .get(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(u1List.body.data.messages.some((m) => m.id === msg1Id)).toBe(false);

    const u2List = await request(app)
      .get(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(u2List.body.data.messages.some((m) => m.id === msg1Id)).toBe(true);

    // Delete msg2 for everyone
    const delAll = await request(app)
      .delete(`/api/direct-chats/messages/${msg2Id}`)
      .set('Authorization', `Bearer ${user2Token}`);
    expect(delAll.status).toBe(200);
    expect(delAll.body.data.message.content).toBe('This message was unsent');

    // Original text must not leak via search
    const searchLeakCheck = await request(app)
      .get(`/api/direct-chats/${chatId}/messages?search=${encodeURIComponent('(v - u)')}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(searchLeakCheck.body.data.messages.length).toBe(0);
  });

  it('clears/deletes conversation per user without affecting other participant', async () => {
    await request(app)
      .post(`/api/direct-chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ content: 'Fresh study question' });

    const delConv = await request(app)
      .delete(`/api/direct-chats/${chatId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(delConv.status).toBe(200);

    const u1Inbox = await request(app)
      .get('/api/direct-chats')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(u1Inbox.body.data.chats.some((c) => c.id === chatId)).toBe(false);

    const u2Inbox = await request(app)
      .get('/api/direct-chats')
      .set('Authorization', `Bearer ${user2Token}`);
    expect(u2Inbox.body.data.chats.some((c) => c.id === chatId)).toBe(true);
  });
});
