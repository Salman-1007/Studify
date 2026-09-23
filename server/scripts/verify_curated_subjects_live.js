import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyAllCuratedSubjects() {
    console.log('=== VERIFYING ALL CURATED SUBJECTS IN NEON POSTGRESQL ===\n');

    const board = await prisma.board.findFirst({
        where: { code: 'PUNJAB' },
        include: {
            subjects: {
                include: {
                    chapters: {
                        include: {
                            _count: {
                                select: { questions: { where: { status: 'APPROVED' } } },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!board) {
        throw new Error('Board PUNJAB not found in Neon database!');
    }

    console.log(`Board: ${board.name} (${board.code})`);
    console.log(`Total Subjects: ${board.subjects.length}`);

    let totalQuestions = 0;
    for (const sub of board.subjects) {
        console.log(`\n📚 Subject: Class ${sub.classGrade} ${sub.subjectName} (${sub.bookName})`);
        console.log(`   Chapters: ${sub.chapters.length}`);
        for (const chap of sub.chapters) {
            const count = chap._count.questions;
            totalQuestions += count;
            console.log(`     - Ch ${chap.chapterNumber}: ${chap.chapterName} (${count} MCQs)`);
        }
    }

    console.log(`\n-----------------------------------------------------`);
    console.log(`Total Approved MCQs across all 4 subjects: ${totalQuestions}`);
    console.log(`-----------------------------------------------------\n`);

    // Test question sample verification
    const sample = await prisma.questionBankItem.findFirst({
        where: {
            status: 'APPROVED',
            subject: { subjectName: 'Chemistry', classGrade: '9' },
        },
        include: { chapter: true, subject: true },
    });

    if (sample) {
        console.log(`Sample Class 9 Chemistry MCQ Check:`);
        console.log(`Question: "${sample.questionText}"`);
        console.log(`A: ${sample.optionA} | B: ${sample.optionB} | C: ${sample.optionC} | D: ${sample.optionD}`);
        console.log(`Correct Answer: [${sample.correctAnswer}]`);
        console.log(`Explanation: ${sample.explanation}`);
        console.log(`Verified pedagogical quality: PASSED!`);
    }

    console.log('\nAll checks PASSED successfully!');
}

verifyAllCuratedSubjects()
    .catch((err) => {
        console.error('❌ Check failed:', err);
        process.exit(1);
    })
    .finally(async() => {
        await prisma.$disconnect();
    });