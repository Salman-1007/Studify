process.env.NODE_ENV = 'test';
import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/db.js';

const runLiveVerification = async() => {
    console.log('================================================================');
    console.log('--- STARTING PHASE 2 LIVE VERIFICATION AGAINST NEON POSTGRESQL ---');
    console.log('================================================================');

    const app = createApp();

    const testEmail = `salman.phase2.${Date.now()}@studify.pk`;
    const testPassword = 'StudentPass123!';
    const testName = 'Salman Phase2 Student';

    let adminToken = '';
    let studentToken = '';
    let studentUserId = '';
    let boardId = '';
    let subjectId = '';
    let chapter1Id = '';
    let createdQuestionId = '';
    let testAttemptId = '';

    try {
        // -----------------------------------------------------------------
        // STEP 1: Verify Seeded Curriculum Hierarchy in Neon PostgreSQL
        // -----------------------------------------------------------------
        console.log('\n[STEP 1] Verifying Curriculum Hierarchy in live Neon database...');
        const board = await prisma.board.findFirst({
            where: {
                OR: [
                    { code: 'PUNJAB' },
                    { code: 'punjab-pectaa' },
                    { name: { contains: 'Punjab' } },
                ],
            },
        });
        if (!board) throw new Error('STEP 1 Failed: Punjab Textbook Board / PECTAA not found in Neon database');
        boardId = board.id;
        console.log(`✓ Board verified: "${board.name}" (ID: ${board.id})`);

        const subject = await prisma.curriculumSubject.findFirst({
            where: { boardId, classGrade: '9', subjectName: 'Physics' },
        });
        if (!subject) throw new Error('STEP 1 Failed: Class 9 Physics subject not found in Neon database');
        subjectId = subject.id;
        console.log(`✓ Subject verified: "${subject.bookName}" for Class ${subject.classGrade}`);

        const chapters = await prisma.curriculumChapter.findMany({
            where: { subjectId },
            orderBy: { chapterNumber: 'asc' },
        });
        if (chapters.length < 2) throw new Error(`STEP 1 Failed: Expected at least 2 chapters, found ${chapters.length}`);
        chapter1Id = chapters[0].id;
        console.log(`✓ Chapters verified: ${chapters.length} chapters found. Chapter 1: "${chapters[0].chapterName}"`);

        const seededQuestionsCount = await prisma.questionBankItem.count({
            where: { subjectId, status: 'APPROVED' },
        });
        console.log(`✓ Approved test fixture questions in Neon: ${seededQuestionsCount}`);
        if (seededQuestionsCount < 10) {
            throw new Error(`STEP 1 Failed: Expected at least 10 approved questions in DB, found ${seededQuestionsCount}`);
        }

        // -----------------------------------------------------------------
        // STEP 2: Authenticate Admin on Neon
        // -----------------------------------------------------------------
        console.log('\n[STEP 2] Authenticating as Seeded Admin on Neon...');
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@studify.local',
                password: 'AdminPass123!',
            });

        if (adminLoginRes.status !== 200 || !adminLoginRes.body.data ? .accessToken) {
            throw new Error(`STEP 2 Failed: Admin login failed (${adminLoginRes.status}): ${JSON.stringify(adminLoginRes.body)}`);
        }
        adminToken = adminLoginRes.body.data.accessToken;
        console.log(`✓ Admin authenticated. Role: ${adminLoginRes.body.data.user.role}`);

        // -----------------------------------------------------------------
        // STEP 3: Admin Question Management & Duplicate Detection on Neon
        // -----------------------------------------------------------------
        console.log('\n[STEP 3] Testing Admin JSON Import with Duplicate Detection...');
        const testImportQuestion = {
            questionText: `Unique Live Test Question for Doppler effect in Class 9 [${Date.now()}]`,
            optionA: 'Frequency increases',
            optionB: 'Frequency decreases',
            optionC: 'Frequency remains constant',
            optionD: 'Wavelength doubles',
            correctOption: 'A',
            difficulty: 'MEDIUM',
            explanation: 'As a sound source approaches an observer, perceived pitch/frequency increases.',
            chapterId: chapter1Id,
        };

        // First Import: should succeed
        const firstImportRes = await request(app)
            .post('/api/admin/questions/import-json')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                questions: [testImportQuestion],
                defaultChapterId: chapter1Id,
            });

        if (firstImportRes.status !== 200 || firstImportRes.body.data ? .importedCount !== 1) {
            throw new Error(`STEP 3 Failed: First import failed: ${JSON.stringify(firstImportRes.body)}`);
        }
        console.log(`✓ First import succeeded: 1 imported, 0 skipped`);

        // Second Import: exactly identical question -> MUST BE DETECTED AS DUPLICATE
        console.log('[STEP 3] Re-importing identical question to verify duplicate detection...');
        const secondImportRes = await request(app)
            .post('/api/admin/questions/import-json')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                questions: [testImportQuestion],
                defaultChapterId: chapter1Id,
            });

        if (secondImportRes.status !== 200 || secondImportRes.body.data ? .skippedCount !== 1) {
            throw new Error(`STEP 3 Failed: Duplicate detection failed! Expected 1 skipped: ${JSON.stringify(secondImportRes.body)}`);
        }
        console.log(`✓ Duplicate detection verified! 0 imported, 1 skipped (${secondImportRes.body.data.skippedCount} duplicate skipped)`);

        // Find the newly imported question and approve it
        const importedItem = await prisma.questionBankItem.findFirst({
            where: { chapterId: chapter1Id, questionText: testImportQuestion.questionText },
        });
        if (!importedItem) throw new Error('STEP 3 Failed: Imported question not found in DB');
        createdQuestionId = importedItem.id;

        console.log(`[STEP 3] Approving question ${createdQuestionId} via admin PATCH...`);
        const approveRes = await request(app)
            .patch(`/api/admin/questions/${createdQuestionId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'APPROVED' });

        if (approveRes.status !== 200 || approveRes.body.data ? .question ? .status !== 'APPROVED') {
            throw new Error(`STEP 3 Failed: Question approval failed: ${JSON.stringify(approveRes.body)}`);
        }
        console.log(`✓ Question successfully approved`);

        // -----------------------------------------------------------------
        // STEP 4: Student Signup & Curriculum Browsing
        // -----------------------------------------------------------------
        console.log('\n[STEP 4] Registering new Student on Neon...');
        const studentSignupRes = await request(app)
            .post('/api/auth/signup')
            .send({
                name: testName,
                email: testEmail,
                password: testPassword,
                class: '9',
                board: 'Punjab',
            });

        if (studentSignupRes.status !== 201) {
            throw new Error(`STEP 4 Failed: Student signup failed: ${JSON.stringify(studentSignupRes.body)}`);
        }
        studentToken = studentSignupRes.body.data.accessToken;
        studentUserId = studentSignupRes.body.data.user.id;
        console.log(`✓ Student registered. User ID: ${studentUserId}`);

        console.log('[STEP 4] Student browsing curriculum APIs...');
        const boardsRes = await request(app).get('/api/curriculum/boards').set('Authorization', `Bearer ${studentToken}`);
        const subjectsRes = await request(app).get(`/api/curriculum/subjects?boardId=${boardId}&gradeLevel=9`).set('Authorization', `Bearer ${studentToken}`);
        const chaptersRes = await request(app).get(`/api/curriculum/chapters?subjectId=${subjectId}`).set('Authorization', `Bearer ${studentToken}`);

        if (boardsRes.status !== 200 || subjectsRes.status !== 200 || chaptersRes.status !== 200) {
            throw new Error('STEP 4 Failed: Curriculum browsing returned non-200 status');
        }
        console.log(`✓ Curriculum browsing successful: ${boardsRes.body.data.boards.length} boards, ${subjectsRes.body.data.subjects.length} subjects, ${chaptersRes.body.data.chapters.length} chapters`);

        // -----------------------------------------------------------------
        // STEP 5: Student Standardized Test Generation & Security
        // -----------------------------------------------------------------
        console.log('\n[STEP 5] Generating 5-question Chapter 1 Test Attempt on Neon...');
        const testGenRes = await request(app)
            .post('/api/tests')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
                title: 'Live Physics 9 Ch 1 Test',
                chapterId: chapter1Id,
                questionCount: 5,
                mode: 'TEST',
            });

        if (testGenRes.status !== 201 || !testGenRes.body.data ? .attempt) {
            throw new Error(`STEP 5 Failed: Test generation failed: ${JSON.stringify(testGenRes.body)}`);
        }

        const attempt = testGenRes.body.data.attempt;
        testAttemptId = attempt.id;
        const testQuestions = attempt.questions;
        console.log(`✓ Test attempt created: ID ${testAttemptId}, questions count: ${testQuestions.length}`);

        // STRICT SECURITY VERIFICATION: No answers or explanations leaked
        for (const q of testQuestions) {
            if (q.correctAnswer || q.correctOption || q.explanation) {
                throw new Error(`SECURITY VULNERABILITY: Question leaked answer/explanation in test generator! ${JSON.stringify(q)}`);
            }
        }
        console.log(`✓ Security verified: All correct answers and explanations are stripped from client response`);

        // Verify GET /api/tests/:attemptId also keeps answers hidden before submit
        const getAttemptRes = await request(app)
            .get(`/api/tests/${testAttemptId}`)
            .set('Authorization', `Bearer ${studentToken}`);

        if (getAttemptRes.status !== 200 || getAttemptRes.body.data ? .attempt ? .isSubmitted !== false) {
            throw new Error(`STEP 5 Failed: Could not fetch active test attempt`);
        }
        for (const q of getAttemptRes.body.data.attempt.questions) {
            if (q.correctAnswer || q.correctOption || q.explanation) {
                throw new Error(`SECURITY VULNERABILITY: Question leaked answer/explanation in GET /tests/:attemptId!`);
            }
        }
        console.log(`✓ Security verified: Active attempt endpoint hides answers before submission`);

        // -----------------------------------------------------------------
        // STEP 6: Server-side Scoring & XP Award
        // -----------------------------------------------------------------
        console.log('\n[STEP 6] Submitting answers for server-side scoring...');
        // We will pick option 'A' for all questions
        const answersPayload = testQuestions.map((q) => ({
            questionId: q.id,
            selectedOption: 'A',
            timeSpentSeconds: 10,
        }));

        const submitRes = await request(app)
            .post(`/api/tests/${testAttemptId}/submit`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
                answers: answersPayload,
                timeTakenSecs: 50,
            });

        if (submitRes.status !== 200 || !submitRes.body.data) {
            throw new Error(`STEP 6 Failed: Submission failed: ${JSON.stringify(submitRes.body)}`);
        }

        const submitResult = submitRes.body.data;
        console.log(`✓ Test submitted successfully!`);
        console.log(`  Score: ${submitResult.score} / ${submitResult.totalQuestions} (${submitResult.percentage}%)`);
        console.log(`  XP Earned: +${submitResult.xpEarned} XP`);

        // Verify XP in Neon DB directly
        const studentInDb = await prisma.user.findUnique({ where: { id: studentUserId } });
        if (!studentInDb || studentInDb.points <= 0) {
            throw new Error(`STEP 6 Failed: XP not incremented in Neon database! Points: ${studentInDb?.points}`);
        }
        console.log(`✓ Neon database direct check: Student points/XP = ${studentInDb.points}`);

        // -----------------------------------------------------------------
        // STEP 7: Post-submission Result Review & Explanations
        // -----------------------------------------------------------------
        console.log('\n[STEP 7] Verifying completed test review reveals explanations...');
        const reviewRes = await request(app)
            .get(`/api/tests/${testAttemptId}`)
            .set('Authorization', `Bearer ${studentToken}`);

        if (reviewRes.status !== 200 || !reviewRes.body.data ? .attempt ? .isSubmitted) {
            throw new Error(`STEP 7 Failed: Failed to fetch completed test review`);
        }

        const reviewedQuestions = reviewRes.body.data.attempt.questions;
        let foundExplanation = false;
        for (const q of reviewedQuestions) {
            if (q.correctOption && q.explanation) {
                foundExplanation = true;
            }
        }
        if (!foundExplanation) {
            throw new Error('STEP 7 Failed: Correct options and explanations not revealed after submission');
        }
        console.log(`✓ Explanations and correct options properly revealed for student review`);

        // -----------------------------------------------------------------
        // STEP 8: Negative & Security Tests
        // -----------------------------------------------------------------
        console.log('\n[STEP 8] Running Negative and Authorization checks...');
        // 8a: Double submission check
        const doubleSubmitRes = await request(app)
            .post(`/api/tests/${testAttemptId}/submit`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ answers: answersPayload });

        if (doubleSubmitRes.status !== 400) {
            throw new Error(`STEP 8 Failed: Expected 400 for double submission, got ${doubleSubmitRes.status}`);
        }
        console.log(`✓ Double submission correctly blocked with HTTP 400`);

        // 8b: Student accessing admin routes
        const studentAdminRes = await request(app)
            .post('/api/admin/questions')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ questionText: 'Hacked question' });

        if (studentAdminRes.status !== 403) {
            throw new Error(`STEP 8 Failed: Student was able to access admin route, got ${studentAdminRes.status}`);
        }
        console.log(`✓ Admin authorization correctly enforced: Student receives HTTP 403`);

        // -----------------------------------------------------------------
        // STEP 9: Student Test History
        // -----------------------------------------------------------------
        console.log('\n[STEP 9] Verifying Student Test History...');
        const historyRes = await request(app)
            .get('/api/tests/history')
            .set('Authorization', `Bearer ${studentToken}`);

        if (historyRes.status !== 200 || !Array.isArray(historyRes.body.data ? .attempts)) {
            throw new Error(`STEP 9 Failed: Could not fetch test history`);
        }

        const foundInHistory = historyRes.body.data.attempts.find((a) => a.id === testAttemptId);
        if (!foundInHistory) {
            throw new Error('STEP 9 Failed: Completed attempt not found in student test history');
        }
        console.log(`✓ Completed test attempt verified in history: Score ${foundInHistory.score}/${foundInHistory.totalQuestions}`);

        console.log('\n================================================================');
        console.log('--- ALL PHASE 2 LIVE NEON DATABASE VERIFICATIONS PASSED 100% ---');
        console.log('================================================================\n');
        await prisma.$disconnect();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ LIVE VERIFICATION FAILED:', err);
        await prisma.$disconnect();
        process.exit(1);
    }
};

runLiveVerification();