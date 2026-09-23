import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app;

beforeAll(async() => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_123456';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_123456';
    ({ app } = await buildTestApp());
});

describe('Production Authentication & Phase 1 Tests', () => {
    const student = {
        name: 'Salman Test',
        email: 'salman.test@studify.pk',
        password: 'password123',
        confirmPassword: 'password123',
        class: '9',
        board: 'Punjab',
    };

    it('POST /api/auth/signup creates a real student with Class and Board', async() => {
        const res = await request(app).post('/api/auth/signup').send(student);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(student.email);
        expect(res.body.data.user.name).toBe(student.name);
        expect(res.body.data.user.class).toBe('9');
        expect(res.body.data.user.board).toBe('Punjab');
        expect(res.body.data.user.level).toBe(1);
        expect(res.body.data.user.xp).toBe(0);
        expect(res.body.data.user.passwordHash).toBeUndefined();
        expect(res.body.data.accessToken).toBeDefined();
    });

    it('POST /api/auth/signup rejects duplicate email', async() => {
        const res = await request(app).post('/api/auth/signup').send(student);
        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/signup rejects invalid Class outside 9-12', async() => {
        const res = await request(app).post('/api/auth/signup').send({
            ...student,
            email: 'another@studify.pk',
            class: '7',
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/signup rejects invalid educational Board', async() => {
        const res = await request(app).post('/api/auth/signup').send({
            ...student,
            email: 'another@studify.pk',
            board: 'NonExistentBoard',
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/register works as a backward-compatible alias', async() => {
        const legacyUser = {
            name: 'Legacy Student',
            username: 'legacy_student',
            email: 'legacy@studify.pk',
            password: 'password123',
            confirmPassword: 'password123',
            educationLevel: 'COLLEGE',
            grade: '11',
        };
        const res = await request(app).post('/api/auth/register').send(legacyUser);
        expect(res.status).toBe(201);
        expect(res.body.data.user.email).toBe(legacyUser.email);
    });

    it('POST /api/auth/login logs in with valid email and password', async() => {
        const res = await request(app).post('/api/auth/login').send({
            identifier: student.email,
            password: student.password,
        });
        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.user.email).toBe(student.email);
        expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('POST /api/auth/login rejects login with wrong password', async() => {
        const res = await request(app).post('/api/auth/login').send({
            identifier: student.email,
            password: 'incorrectPassword999',
        });
        expect(res.status).toBe(401);
    });

    it('GET /api/auth/me blocks unauthorized access without token', async() => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('GET /api/auth/me returns authenticated user details with token', async() => {
        const loginRes = await request(app).post('/api/auth/login').send({
            identifier: student.email,
            password: student.password,
        });
        const token = loginRes.body.data.accessToken;

        const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(student.email);
        expect(res.body.data.user.board).toBe('Punjab');
        expect(res.body.data.user.class).toBe('9');
        expect(res.body.data.user.level).toBe(1);
    });

    it('POST /api/auth/logout revokes refresh token and clears cookie', async() => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(200);
        expect(res.body.data.loggedOut).toBe(true);
    });
});