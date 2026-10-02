import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const normalizeText = (text) => {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
};

// Known official PTB Chapter names dictionary (especially for items where chapter was scraped as 'Array')
const KNOWN_CHAPTER_NAMES = {
  '10_Chemistry_10': 'Acids, Bases and Salts',
};

// Populate known chapter names from other items
function buildChapterDictionary(data) {
  data.forEach((d) => {
    if (d.chapter && d.chapter !== 'Array') {
      const m = d.chapter.match(/chapter\s*(\d+)\s*(.*)/i);
      if (m) {
        const num = parseInt(m[1]);
        const name = m[2].trim() || d.chapter;
        const key = `${d.class}_${d.subject}_${num}`;
        if (!KNOWN_CHAPTER_NAMES[key]) KNOWN_CHAPTER_NAMES[key] = name;
      }
    }
  });
}

function resolveChapterInfo(d) {
  let chNum = 1;
  let chName = d.chapter;

  if (d.chapter === 'Array') {
    const m = d.source_url ? d.source_url.match(/chapter-(\d+)/i) : null;
    if (m) {
      chNum = parseInt(m[1]);
      chName = KNOWN_CHAPTER_NAMES[`${d.class}_${d.subject}_${chNum}`] || `Chapter ${chNum}`;
    }
  } else {
    const m = d.chapter ? d.chapter.match(/chapter\s*(\d+)\s*(.*)/i) : null;
    if (m) {
      chNum = parseInt(m[1]);
      chName = m[2].trim() || d.chapter;
    }
  }

  // Clean chapter name
  chName = chName.replace(/^[-:_\s]+/, '').trim() || `Chapter ${chNum}`;
  return { chapterNumber: chNum, chapterName: chName };
}

export async function seedMasterQuestionBank() {
  console.log('🚀 Starting Master Question Bank Seed (9,000+ MCQs)...');
  const startTime = Date.now();

  const jsonPath = path.resolve('src/master_ptb_entry_mcqs_4opts_solved.json');
  const altJsonPath = path.resolve('server/src/master_ptb_entry_mcqs_4opts_solved.json');
  const resolvedPath = fs.existsSync(jsonPath) ? jsonPath : altJsonPath;

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Master JSON file not found at ${jsonPath} or ${altJsonPath}`);
  }

  console.log(`📖 Loading master JSON from: ${resolvedPath}`);
  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const questionsData = JSON.parse(rawContent);
  console.log(`✅ Loaded ${questionsData.length} questions from JSON.`);

  buildChapterDictionary(questionsData);

  // 1. Ensure Boards
  console.log('📌 Ensuring Boards in database...');
  const punjabBoard = await prisma.board.upsert({
    where: { code: 'PUNJAB' },
    update: { name: 'Punjab Textbook Board / PECTAA', description: 'Official Punjab Curriculum & Textbook Board (Matric & Intermediate)' },
    create: { name: 'Punjab Textbook Board / PECTAA', code: 'PUNJAB', description: 'Official Punjab Curriculum & Textbook Board (Matric & Intermediate)' },
  });

  const pmdcBoard = await prisma.board.upsert({
    where: { code: 'PMDC' },
    update: { name: 'Pakistan Medical & Dental Council (PMDC)', description: 'Official PMDC National Curriculum for MDCAT Medical College Admission' },
    create: { name: 'Pakistan Medical & Dental Council (PMDC)', code: 'PMDC', description: 'Official PMDC National Curriculum for MDCAT Medical College Admission' },
  });

  const uetBoard = await prisma.board.upsert({
    where: { code: 'UET' },
    update: { name: 'University of Engineering & Technology (UET)', description: 'Official UET Combined Entry Test for Engineering & Computing Programs' },
    create: { name: 'University of Engineering & Technology (UET)', code: 'UET', description: 'Official UET Combined Entry Test for Engineering & Computing Programs' },
  });

  // In-memory caches for IDs to avoid repeated roundtrips
  const subjectCache = new Map(); // key: `${boardId}_${classGrade}_${subjectName}` -> subjectId
  const chapterCache = new Map(); // key: `${subjectId}_${chapterNumber}` -> chapterId

  async function getOrCreateSubject(boardId, classGrade, subjectName, bookName, code) {
    const key = `${boardId}_${classGrade}_${subjectName}`;
    if (subjectCache.has(key)) return subjectCache.get(key);

    const s = await prisma.curriculumSubject.upsert({
      where: {
        boardId_classGrade_subjectName: {
          boardId,
          classGrade: String(classGrade),
          subjectName,
        },
      },
      update: {
        bookName: bookName || `${subjectName} ${classGrade}`,
        code: code || `${classGrade}-${subjectName.slice(0, 3).toUpperCase()}`,
      },
      create: {
        boardId,
        classGrade: String(classGrade),
        subjectName,
        bookName: bookName || `${subjectName} ${classGrade}`,
        code: code || `${classGrade}-${subjectName.slice(0, 3).toUpperCase()}`,
      },
    });

    subjectCache.set(key, s.id);
    return s.id;
  }

  async function getOrCreateChapter(subjectId, chapterNumber, chapterName) {
    const key = `${subjectId}_${chapterNumber}`;
    if (chapterCache.has(key)) return chapterCache.get(key);

    const ch = await prisma.curriculumChapter.upsert({
      where: {
        subjectId_chapterNumber: {
          subjectId,
          chapterNumber,
        },
      },
      update: {
        chapterName,
      },
      create: {
        subjectId,
        chapterNumber,
        chapterName,
      },
    });

    chapterCache.set(key, ch.id);
    return ch.id;
  }

  // Pre-seed known subjects
  console.log('📚 Setting up curriculum subjects...');
  const baseSubjects = [
    { grade: '9', subject: 'Chemistry', book: 'Chemistry 9 (PTB)' },
    { grade: '9', subject: 'Biology', book: 'Biology 9 (PTB)' },
    { grade: '9', subject: 'English', book: 'English 9 (PTB)' },
    { grade: '10', subject: 'Chemistry', book: 'Chemistry 10 (PTB)' },
    { grade: '10', subject: 'Biology', book: 'Biology 10 (PTB)' },
    { grade: '10', subject: 'English', book: 'English 10 (PTB)' },
    { grade: '11', subject: 'Biology', book: 'Biology 11 (FSc Pre-Medical PTB)' },
    { grade: '11', subject: 'Chemistry', book: 'Chemistry 11 (FSc PTB)' },
    { grade: '11', subject: 'Physics', book: 'Physics 11 (FSc PTB)' },
    { grade: '11', subject: 'Computer Science', book: 'Computer Science 11 (ICS PTB)' },
    { grade: '12', subject: 'Biology', book: 'Biology 12 (FSc Pre-Medical PTB)' },
    { grade: '12', subject: 'Chemistry', book: 'Chemistry 12 (FSc PTB)' },
    { grade: '12', subject: 'Physics', book: 'Physics 12 (FSc PTB)' },
    { grade: '12', subject: 'Computer Science', book: 'Computer Science 12 (ICS PTB)' },
    { grade: '12', subject: 'English', book: 'English 12 (Intermediate PTB)' },
  ];

  for (const item of baseSubjects) {
    await getOrCreateSubject(punjabBoard.id, item.grade, item.subject, item.book);
  }

  // MDCAT Subjects
  const mdcatSubjects = [
    { subject: 'Biology', book: 'MDCAT Biology (PMDC)' },
    { subject: 'Chemistry', book: 'MDCAT Chemistry (PMDC)' },
    { subject: 'Physics', book: 'MDCAT Physics (PMDC)' },
    { subject: 'English', book: 'MDCAT English (PMDC)' },
  ];
  for (const item of mdcatSubjects) {
    await getOrCreateSubject(pmdcBoard.id, 'MDCAT', item.subject, item.book);
  }

  // ECAT Subjects
  const ecatSubjects = [
    { subject: 'Chemistry', book: 'ECAT Chemistry (UET)' },
    { subject: 'Physics', book: 'ECAT Physics (UET)' },
    { subject: 'Computer Science', book: 'ECAT Computer Science (UET)' },
    { subject: 'English', book: 'ECAT English (UET)' },
  ];
  for (const item of ecatSubjects) {
    await getOrCreateSubject(uetBoard.id, 'ECAT', item.subject, item.book);
  }

  console.log('🧩 Preparing questions for batch insertion...');

  // Fetch all existing normalized questions in database to avoid duplicates
  const existingQuestions = await prisma.questionBankItem.findMany({
    select: { chapterId: true, normalizedText: true },
  });
  const existingSet = new Set(existingQuestions.map((q) => `${q.chapterId}_${q.normalizedText}`));
  console.log(`ℹ️ Found ${existingQuestions.length} existing items in DB.`);

  const itemsToInsert = [];

  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];
    const { chapterNumber, chapterName } = resolveChapterInfo(q);

    const normQ = normalizeText(q.question);
    const opts = q.options || {};
    const optA = String(opts.A || opts.a || opts['1'] || opts.B || 'None of the above').trim();
    const optB = String(opts.B || opts.b || opts['2'] || 'None of the above').trim();
    const optC = String(opts.C || opts.c || opts['3'] || 'None of the above').trim();
    const optD = String(opts.D || opts.d || opts['4'] || 'None of the above').trim();

    let ans = String(q.correct_answer || q.answer || 'A').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(ans)) ans = 'A';

    // 1. Primary Board Question (Punjab Board Classes 9, 10, 11, 12)
    const classGrade = String(q.class);
    const subjectId = await getOrCreateSubject(punjabBoard.id, classGrade, q.subject);
    const chapterId = await getOrCreateChapter(subjectId, chapterNumber, chapterName);

    const punjabKey = `${chapterId}_${normQ}`;
    if (!existingSet.has(punjabKey)) {
      existingSet.add(punjabKey);
      itemsToInsert.push({
        boardId: punjabBoard.id,
        classGrade,
        subjectId,
        chapterId,
        questionText: q.question.trim(),
        normalizedText: normQ,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctAnswer: ans,
        explanation: q.explanation || null,
        difficulty: 'MEDIUM',
        status: 'APPROVED',
        questionType: 'MCQ',
        sourceType: 'ORIGINAL',
        sourceReference: q.source_url || 'PTB Question Bank',
      });
    }

    // 2. MDCAT Inclusion (PMDC)
    const cat = String(q.category || '').toUpperCase();
    const isMdcat = cat.includes('MDCAT') && ['Biology', 'Chemistry', 'Physics', 'English'].includes(q.subject);

    if (isMdcat) {
      // In MDCAT, if subject is Chemistry or Computer Science where Class 12 restarts from 1, offset Class 12 by 11
      const mdcatChNum = q.class === 12 && q.subject === 'Chemistry' ? chapterNumber + 11 : chapterNumber;
      const mdcatSubId = await getOrCreateSubject(pmdcBoard.id, 'MDCAT', q.subject);
      const mdcatChId = await getOrCreateChapter(mdcatSubId, mdcatChNum, chapterName);

      const mdcatKey = `${mdcatChId}_${normQ}`;
      if (!existingSet.has(mdcatKey)) {
        existingSet.add(mdcatKey);
        itemsToInsert.push({
          boardId: pmdcBoard.id,
          classGrade: 'MDCAT',
          subjectId: mdcatSubId,
          chapterId: mdcatChId,
          questionText: q.question.trim(),
          normalizedText: normQ,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctAnswer: ans,
          explanation: q.explanation || null,
          difficulty: 'MEDIUM',
          status: 'APPROVED',
          questionType: 'MCQ',
          sourceType: 'ORIGINAL',
          sourceReference: q.source_url || 'MDCAT Question Bank',
        });
      }
    }

    // 3. ECAT Inclusion (UET)
    const isEcat = cat.includes('ECAT') && ['Physics', 'Chemistry', 'Computer Science', 'English'].includes(q.subject);

    if (isEcat) {
      const ecatChNum =
        q.class === 12 && (q.subject === 'Chemistry' || q.subject === 'Computer Science')
          ? chapterNumber + 11
          : chapterNumber;
      const ecatSubId = await getOrCreateSubject(uetBoard.id, 'ECAT', q.subject);
      const ecatChId = await getOrCreateChapter(ecatSubId, ecatChNum, chapterName);

      const ecatKey = `${ecatChId}_${normQ}`;
      if (!existingSet.has(ecatKey)) {
        existingSet.add(ecatKey);
        itemsToInsert.push({
          boardId: uetBoard.id,
          classGrade: 'ECAT',
          subjectId: ecatSubId,
          chapterId: ecatChId,
          questionText: q.question.trim(),
          normalizedText: normQ,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctAnswer: ans,
          explanation: q.explanation || null,
          difficulty: 'MEDIUM',
          status: 'APPROVED',
          questionType: 'MCQ',
          sourceType: 'ORIGINAL',
          sourceReference: q.source_url || 'ECAT Question Bank',
        });
      }
    }

    if ((i + 1) % 2000 === 0) {
      console.log(`⏳ Processed ${i + 1} / ${questionsData.length} records...`);
    }
  }

  console.log(`📦 Total new QuestionBankItems prepared to insert: ${itemsToInsert.length}`);

  // Batch insert in chunks of 500
  const BATCH_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
    const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
    await prisma.questionBankItem.createMany({
      data: batch,
      skipDuplicates: true,
    });
    insertedCount += batch.length;
    console.log(`💾 Inserted ${insertedCount} / ${itemsToInsert.length} items (${Math.round((insertedCount / itemsToInsert.length) * 100)}%)...`);
  }

  const durationSecs = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalInDb = await prisma.questionBankItem.count();
  console.log(`\n🎉 SEED COMPLETED in ${durationSecs}s!`);
  console.log(`📊 Total QuestionBankItems now in database: ${totalInDb}`);

  // Summary breakdown
  const summary = await prisma.questionBankItem.groupBy({
    by: ['classGrade'],
    _count: true,
  });
  console.log('📈 Questions by Class / Track:');
  console.table(summary);
}

if (process.argv[1] && process.argv[1].endsWith('seedMasterBank.js')) {
  seedMasterQuestionBank()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('❌ Seeder failed:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
