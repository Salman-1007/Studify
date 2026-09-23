import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(
    import.meta.url));
const dataPath = path.resolve(__dirname, '../src/ptb_curated_clean_mcqs.json');

const normalizeText = (text) => {
    return (text || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

async function seedPtbToNeon() {
    console.log('--- SEEDING CURATED PTB DATASET (CLASSES 9 & 10) INTO NEON POSTGRESQL ---');

    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Loaded ${rawData.length} curated questions from JSON.`);

    // 1. Board
    const board = await prisma.board.upsert({
        where: { code: 'PUNJAB' },
        update: {
            name: 'Punjab Textbook Board / PECTAA',
            description: 'Punjab Curriculum and Textbook Board / Punjab Examination Commission',
        },
        create: {
            name: 'Punjab Textbook Board / PECTAA',
            code: 'PUNJAB',
            description: 'Punjab Curriculum and Textbook Board / Punjab Examination Commission',
        },
    });
    console.log(`✓ Board ready: "${board.name}" (ID: ${board.id})`);

    // 2. Subjects cache
    const subjectCache = {};
    const chapterCache = {};

    let subjectsCreated = 0;
    let chaptersCreated = 0;
    let questionsUpserted = 0;

    for (const item of rawData) {
        const classGrade = String(item.class);
        const subjectName = item.subject;
        const subKey = `${classGrade}_${subjectName}`;

        if (!subjectCache[subKey]) {
            const code = (subjectName === 'Physics' ? 'PHY' : 'CHM') + classGrade;
            const bookName = `${subjectName} ${classGrade}`;

            const subject = await prisma.curriculumSubject.upsert({
                where: {
                    boardId_classGrade_subjectName: {
                        boardId: board.id,
                        classGrade,
                        subjectName,
                    },
                },
                update: {
                    bookName,
                    code,
                    description: `Punjab Textbook Board official textbook for Class ${classGrade} ${subjectName}`,
                },
                create: {
                    boardId: board.id,
                    classGrade,
                    subjectName,
                    bookName,
                    code,
                    description: `Punjab Textbook Board official textbook for Class ${classGrade} ${subjectName}`,
                },
            });

            subjectCache[subKey] = subject;
            subjectsCreated++;
        }

        const currentSubject = subjectCache[subKey];
        const chapKey = `${currentSubject.id}_${item.chapterNumber}`;

        if (!chapterCache[chapKey]) {
            const chapter = await prisma.curriculumChapter.upsert({
                where: {
                    subjectId_chapterNumber: {
                        subjectId: currentSubject.id,
                        chapterNumber: item.chapterNumber,
                    },
                },
                update: {
                    chapterName: item.chapter,
                },
                create: {
                    subjectId: currentSubject.id,
                    chapterNumber: item.chapterNumber,
                    chapterName: item.chapter,
                },
            });

            chapterCache[chapKey] = chapter;
            chaptersCreated++;
        }

        const currentChapter = chapterCache[chapKey];
        const normalizedText = normalizeText(item.questionText);

        // Find if question already exists in this chapter
        const existing = await prisma.questionBankItem.findFirst({
            where: {
                chapterId: currentChapter.id,
                normalizedText,
            },
        });

        if (existing) {
            await prisma.questionBankItem.update({
                where: { id: existing.id },
                data: {
                    questionText: item.questionText,
                    optionA: item.optionA,
                    optionB: item.optionB,
                    optionC: item.optionC,
                    optionD: item.optionD,
                    correctAnswer: item.correctAnswer,
                    explanation: item.explanation,
                    difficulty: item.difficulty,
                    status: 'APPROVED',
                    sourceType: 'IMPORTED',
                    sourceReference: item.sourceReference,
                },
            });
        } else {
            await prisma.questionBankItem.create({
                data: {
                    boardId: board.id,
                    classGrade,
                    subjectId: currentSubject.id,
                    chapterId: currentChapter.id,
                    questionText: item.questionText,
                    normalizedText,
                    optionA: item.optionA,
                    optionB: item.optionB,
                    optionC: item.optionC,
                    optionD: item.optionD,
                    correctAnswer: item.correctAnswer,
                    explanation: item.explanation,
                    difficulty: item.difficulty,
                    status: 'APPROVED',
                    questionType: 'MCQ',
                    sourceType: 'IMPORTED',
                    sourceReference: item.sourceReference,
                },
            });
        }

        questionsUpserted++;
    }

    console.log(`✓ Synchronized ${Object.keys(subjectCache).length} subjects:`);
    for (const [k, s] of Object.entries(subjectCache)) {
        console.log(`  - Class ${s.classGrade} ${s.subjectName} (${s.bookName})`);
    }

    console.log(`✓ Synchronized ${Object.keys(chapterCache).length} chapters.`);
    console.log(`✓ Ingested and approved ${questionsUpserted} MCQs into Neon PostgreSQL!`);

    // Verify total count in DB
    const totalApproved = await prisma.questionBankItem.count({
        where: { status: 'APPROVED' },
    });
    console.log(`\nTotal APPROVED questions currently in Neon PostgreSQL: ${totalApproved}`);
}

seedPtbToNeon()
    .catch((err) => {
        console.error('❌ Ingestion failed:', err);
        process.exit(1);
    })
    .finally(async() => {
        await prisma.$disconnect();
    });