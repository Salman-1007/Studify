import 'dotenv/config';
process.env.NODE_ENV = 'test';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/db.js';

const runLiveVerification = async() => {
    console.log('--- STARTING PHASE 1 LIVE VERIFICATION AGAINST NEON POSTGRESQL ---');
    const app = createApp();

    const testEmail = `salman.test.${Date.now()}@studify.pk`;
    const testPassword = 'RealPassword123!';
    const testName = 'Salman Test';
    const testClass = '9';
    const testBoard = 'Punjab';

    let cookies = [];
    let accessToken = '';

    try {
        // -------------------------------------------------------------
        // TEST A: Create account & verify in PostgreSQL
        // -------------------------------------------------------------
        console.log('\n[TEST A] Signing up new student on Neon PostgreSQL...');
        const signupRes = await request(app)
            .post('/api/auth/signup')
            .send({
                name: testName,
                email: testEmail,
                password: testPassword,
                confirmPassword: testPassword,
                class: testClass,
                board: testBoard,
            });

        if (signupRes.status !== 201 || !signupRes.body.success) {
            throw new Error(`Test A failed with status ${signupRes.status}: ${JSON.stringify(signupRes.body)}`);
        }

        accessToken = signupRes.body.data.accessToken;
        cookies = signupRes.headers['set-cookie'] || [];
        console.log('Signup HTTP 201 Response received. AccessToken issued.');

        // Direct Neon Database Verification
        console.log('[TEST A] Querying Neon PostgreSQL directly via Prisma...');
        const dbUser = await prisma.user.findUnique({
            where: { email: testEmail },
        });

        if (!dbUser) throw new Error('Test A failed: User not found in Neon PostgreSQL database');
        if (dbUser.name !== testName) throw new Error(`Test A failed: Name mismatch in DB: ${dbUser.name}`);
        if (dbUser.grade !== testClass) throw new Error(`Test A failed: Grade mismatch in DB: ${dbUser.grade}`);
        if (dbUser.board !== testBoard) throw new Error(`Test A failed: Board mismatch in DB: ${dbUser.board}`);
        if (dbUser.level !== 1) throw new Error(`Test A failed: Level mismatch in DB: ${dbUser.level}`);
        if (dbUser.points !== 0) throw new Error(`Test A failed: Points mismatch in DB: ${dbUser.points}`);

        const isMatch = await bcrypt.compare(testPassword, dbUser.passwordHash);
        if (!isMatch) throw new Error('Test A failed: Password hash in DB does not match original password');
        if (signupRes.body.data.user.passwordHash) throw new Error('Test A failed: Password hash leaked in response');

        console.log('-> TEST A PASSED: User verified in PostgreSQL database:');
        console.log(`   ID: ${dbUser.id}, Email: ${dbUser.email}, Class: ${dbUser.grade}, Board: ${dbUser.board}, Level: ${dbUser.level}`);

        // -------------------------------------------------------------
        // TEST B: Logout
        // -------------------------------------------------------------
        console.log('\n[TEST B] Logging out...');
        const logoutRes1 = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookies);

        if (logoutRes1.status !== 200 || !logoutRes1.body.data.loggedOut) {
            throw new Error(`Test B failed: ${JSON.stringify(logoutRes1.body)}`);
        }
        console.log('-> TEST B PASSED: Logout succeeded, cookie cleared.');

        // -------------------------------------------------------------
        // TEST C: Login using same credentials
        // -------------------------------------------------------------
        console.log('\n[TEST C] Logging in with the created credentials...');
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: testEmail,
                password: testPassword,
            });

        if (loginRes.status !== 200 || !loginRes.body.success) {
            throw new Error(`Test C failed with status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
        }

        accessToken = loginRes.body.data.accessToken;
        cookies = loginRes.headers['set-cookie'] || [];
        if (!accessToken) throw new Error('Test C failed: AccessToken missing');
        if (loginRes.body.data.user.email !== testEmail) throw new Error('Test C failed: Email mismatch');
        if (loginRes.body.data.user.board !== testBoard) throw new Error('Test C failed: Board mismatch');

        console.log('-> TEST C PASSED: Login succeeded, database-backed authentication verified.');

        // -------------------------------------------------------------
        // TEST D: Refresh token & session persistence
        // -------------------------------------------------------------
        console.log('\n[TEST D] Refreshing session (simulating browser reload / token renewal)...');
        const refreshRes = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', cookies);

        if (refreshRes.status !== 200 || !refreshRes.body.data.accessToken) {
            throw new Error(`Test D failed on refresh: ${JSON.stringify(refreshRes.body)}`);
        }

        const newAccessToken = refreshRes.body.data.accessToken;
        cookies = refreshRes.headers['set-cookie'] || cookies;

        // Verify access to protected endpoint with new token
        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${newAccessToken}`);

        if (meRes.status !== 200 || meRes.body.data.user.email !== testEmail) {
            throw new Error(`Test D failed: /api/auth/me did not recognize refreshed session: ${JSON.stringify(meRes.body)}`);
        }

        console.log('-> TEST D PASSED: Token rotation and session persistence verified.');

        // -------------------------------------------------------------
        // TEST E: Try incorrect password
        // -------------------------------------------------------------
        console.log('\n[TEST E] Attempting login with incorrect password...');
        const wrongPassRes = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: testEmail,
                password: 'IncorrectPassword999!',
            });

        if (wrongPassRes.status !== 401) {
            throw new Error(`Test E failed: Expected 401 but got ${wrongPassRes.status}`);
        }
        console.log(`-> TEST E PASSED: Rejected with 401 (${wrongPassRes.body.error?.message || wrongPassRes.body.message}).`);

        // -------------------------------------------------------------
        // TEST F: Try registering duplicate email
        // -------------------------------------------------------------
        console.log('\n[TEST F] Attempting to signup with already registered email...');
        const duplicateRes = await request(app)
            .post('/api/auth/signup')
            .send({
                name: 'Another Person',
                email: testEmail,
                password: 'AnotherPassword123!',
                confirmPassword: 'AnotherPassword123!',
                class: '10',
                board: 'Federal/FBISE',
            });

        if (duplicateRes.status !== 409) {
            throw new Error(`Test F failed: Expected 409 duplicate email error but got ${duplicateRes.status}`);
        }
        console.log(`-> TEST F PASSED: Duplicate email correctly rejected with 409 (${duplicateRes.body.error?.message || duplicateRes.body.message}).`);

        // -------------------------------------------------------------
        // TEST G: Logout & verify protected endpoint blocked
        // -------------------------------------------------------------
        console.log('\n[TEST G] Logging out and testing protected route security...');
        await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookies);

        const blockedNoToken = await request(app).get('/api/auth/me');
        if (blockedNoToken.status !== 401) {
            throw new Error(`Test G failed: Expected 401 without token, got ${blockedNoToken.status}`);
        }

        const blockedWithInvalid = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid_or_expired_token');
        if (blockedWithInvalid.status !== 401) {
            throw new Error(`Test G failed: Expected 401 with invalid token, got ${blockedWithInvalid.status}`);
        }

        console.log('-> TEST G PASSED: Protected endpoints safely inaccessible after logout / without valid token.');

        console.log('\n========================================================');
        console.log('ALL PHASE 1 LIVE VERIFICATION TESTS PASSED SUCCESSFULLY!');
        console.log('========================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('\n*** TEST SUITE ENCOUNTERED AN ERROR ***\n', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
};

runLiveVerification();