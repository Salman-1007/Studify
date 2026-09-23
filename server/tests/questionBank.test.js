import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { buildTestApp } from './testApp.js';

let app, prisma;
let adminToken, studentToken, studentId;
let boardId, subjectId, chapterId;
let testAttemptId, question1Id, question2Id;

beforeAll(async() => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_question_bank';
    ({ app, prisma } = await buildTestApp());

    // 1. Create Admin User
    const adminRes = await request(app).post('/api/auth/signup').send({
        name: 'Admin User',
        email: 'admin@studify.local',
        password: 'AdminPassword123!',
        class: '9',
        board: 'Punjab',
    });
    adminToken = adminRes.body.data.accessToken;
    const adminId = adminRes.body.data.user.id;
    // elevate to ADMIN in database
    await prisma.user.update({
        where: { id: adminId },
        data: { role: 'ADMIN' },
    });

    // 2. Create Student User
    const studentRes = await request(app).post('/api/auth/signup').send({
        name: 'Class 9 Student',
        email: 'student9@studify.local',
        password: 'StudentPass123!',
        class: '9',
        board: 'Punjab',
    });
    studentToken = studentRes.body.data.accessToken;
    studentId = studentRes.body.data.user.id;

    // 3. Seed Curriculum Hierarchy (Punjab Textbook Board / PECTAA, Class 9, Physics 9)
    const board = await prisma.board.create({
        data: {
            name: 'Punjab Textbook Board / PECTAA',
            code: 'punjab-pectaa',
            description: 'Punjab Textbook Board curriculum for Class 9',
        },
    });
    boardId = board.id;

    const subject = await prisma.curriculumSubject.create({
        data: {
            boardId,
            classGrade: '9',
            subjectName: 'Physics 9',
            bookName: 'Physics 9',
            code: 'PHY9',
        },
    });
    subjectId = subject.id;

    const chapter = await prisma.curriculumChapter.create({
        data: {
            subjectId,
            chapterNumber: 1,
            chapterName: 'Physical Quantities and Measurement',
        },
    });
    chapterId = chapter.id;
});

describe('Phase 2 — Curriculum Browsing API', () => {
    it('GET /api/curriculum/boards returns curriculum boards', async() => {
        const res = await request(app)
            .get('/api/curriculum/boards')
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.boards.length).toBeGreaterThan(0);
        expect(res.body.data.boards[0].name).toContain('Punjab');
    });

    it('GET /api/curriculum/subjects filters by boardId and gradeLevel 9', async() => {
        const res = await request(app)
            .get(`/api/curriculum/subjects?boardId=${boardId}&gradeLevel=9`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.subjects.length).toBe(1);
        expect(res.body.data.subjects[0].name).toBe('Physics 9');
    });

    it('GET /api/curriculum/chapters returns chapters for Physics 9', async() => {
        const res = await request(app)
            .get(`/api/curriculum/chapters?subjectId=${subjectId}`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.chapters.length).toBe(1);
        expect(res.body.data.chapters[0].title).toBe('Physical Quantities and Measurement');
    });
});

describe('Phase 2 — Admin Question Management & Import', () => {
    it('rejects non-admin from creating or importing questions', async() => {
        const res = await request(app)
            .post('/api/admin/questions')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
                chapterId,
                questionText: 'Unauthorized attempt',
                optionA: 'A',
                optionB: 'B',
                optionC: 'C',
                optionD: 'D',
                correctOption: 'A',
            });

        expect(res.status).toBe(403);
    });

    it('admin creates a single canonical question', async() => {
        const res = await request(app)
            .post('/api/admin/questions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                chapterId,
                questionText: 'Which unit is used for measuring electric current in SI units?',
                optionA: 'Volt',
                optionB: 'Ampere',
                optionC: 'Ohm',
                optionD: 'Coulomb',
                correctOption: 'B',
                difficulty: 'EASY',
                explanation: 'In the SI system, electric current is a base physical quantity measured in amperes (A).',
                tags: ['units', 'base-quantities'],
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.question.correctOption).toBe('B');
        question1Id = res.body.data.question.id;
    });

    it('admin imports questions via JSON with duplicate detection', async() => {
        const questionsToImport = [{
                questionText: 'The number of base units in SI is:',
                optionA: '3',
                optionB: '6',
                optionC: '7',
                optionD: '9',
                correctOption: 'C',
                difficulty: 'EASY',
                explanation: 'There are seven base units in the International System of Units (SI).',
            },
            {
                // Exact duplicate of the first question within the same batch
                questionText: 'The number of base units in SI is:',
                optionA: '3',
                optionB: '6',
                optionC: '7',
                optionD: '9',
                correctOption: 'C',
                difficulty: 'EASY',
            },
            {
                // Existing duplicate from the previous single question test
                questionText: 'Which unit is used for measuring electric current in SI units?',
                optionA: 'Volt',
                optionB: 'Ampere',
                optionC: 'Ohm',
                optionD: 'Coulomb',
                correctOption: 'B',
                difficulty: 'EASY',
            },
        ];

        const res = await request(app)
            .post('/api/admin/questions/import-json')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                questions: questionsToImport,
                defaultChapterId: chapterId,
            });

        expect(res.status).toBe(200);
        expect(res.body.data.importedCount).toBe(1);
        expect(res.body.data.skippedCount).toBe(2);
    });

    it('approves questions for student test generation', async() => {
        // Approve question 1
        const res = await request(app)
            .patch(`/api/admin/questions/${question1Id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'APPROVED' });

        expect(res.status).toBe(200);
        expect(res.body.data.question.status).toBe('APPROVED');

        // Find the second question and approve it
        const allQuestions = await prisma.questionBankItem.findMany({ where: { chapterId } });
        const q2 = allQuestions.find((q) => q.id !== question1Id);
        expect(q2).toBeDefined();
        question2Id = q2.id;

        await prisma.questionBankItem.update({
            where: { id: question2Id },
            data: { status: 'APPROVED' },
        });
    });
});

describe('Phase 2 — Standardized Test Engine & Answer Security', () => {
    it('generates a randomized test attempt from approved questions', async() => {
        const res = await request(app)
            .post('/api/tests')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
                title: 'Physics 9 Ch 1 Test',
                chapterId,
                questionCount: 2,
                mode: 'TEST',
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        testAttemptId = res.body.data.attempt.id;
        expect(testAttemptId).toBeDefined();

        // Verify correct answers and explanations are NEVER leaked in test generation
        const questions = res.body.data.attempt.questions;
        expect(questions.length).toBe(2);
        questions.forEach((q) => {
            expect(q.correctOption).toBeUndefined();
            expect(q.correctAnswer).toBeUndefined();
            expect(q.explanation).toBeUndefined();
        });
    });

    it('GET /api/tests/:attemptId does not leak answers before submission', async() => {
        const res = await request(app)
            .get(`/api/tests/${testAttemptId}`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        const attempt = res.body.data.attempt;
        expect(attempt.isSubmitted).toBe(false);
        expect(attempt.questions.length).toBe(2);
        attempt.questions.forEach((q) => {
            expect(q.correctOption).toBeUndefined();
            expect(q.correctAnswer).toBeUndefined();
            expect(q.explanation).toBeUndefined();
        });
    });

    it('scores submitted attempt server-side and awards XP', async() => {
        // Question 1: correct answer is 'B'
        // Question 2: correct answer is 'C'
        // Student provides 'B' for Question 1 (correct) and 'A' for Question 2 (wrong)
        const res = await request(app)
            .post(`/api/tests/${testAttemptId}/submit`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
                answers: [
                    { questionId: question1Id, selectedOption: 'B', timeSpentSeconds: 15 },
                    { questionId: question2Id, selectedOption: 'A', timeSpentSeconds: 20 },
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const result = res.body.data.attempt;
        expect(result.score).toBe(1);
        expect(result.totalQuestions).toBe(2);
        expect(result.percentage).toBe(50);
        expect(result.xpEarned).toBe(12); // 10 base + 1 correct * 2 XP

        // Check user XP was updated
        const student = await prisma.user.findUnique({ where: { id: studentId } });
        expect(student.points).toBeGreaterThanOrEqual(10);
    });

    it('GET /api/tests/:attemptId now reveals answers and explanations after submission', async() => {
        const res = await request(app)
            .get(`/api/tests/${testAttemptId}`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        const attempt = res.body.data.attempt;
        expect(attempt.isSubmitted).toBe(true);
        expect(attempt.questionAttempts.length).toBe(2);

        const q1Attempt = attempt.questionAttempts.find((qa) => qa.questionBankItemId === question1Id);
        expect(q1Attempt).toBeDefined();
        expect(q1Attempt.selectedOption).toBe('B');
        expect(q1Attempt.correctOption).toBe('B');
        expect(q1Attempt.isCorrect).toBe(true);
        expect(q1Attempt.explanation).toContain('electric current is a base physical quantity');
    });

    it('rejects double submission of the same test attempt', async() => {
        const res = await request(app)
            .post(`/api/tests/${testAttemptId}/submit`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
                answers: [{ questionId: question1Id, selectedOption: 'B' }],
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('already been submitted');
    });

    it('GET /api/tests/history returns the completed test attempt', async() => {
        const res = await request(app)
            .get('/api/tests/history')
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.attempts.length).toBeGreaterThanOrEqual(1);
        const item = res.body.data.attempts.find((a) => a.id === testAttemptId);
        expect(item).toBeDefined();
        expect(item.score).toBe(1);
        expect(item.percentage).toBe(50);
    });
});