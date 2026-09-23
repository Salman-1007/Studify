import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeText = (text) => {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const ACHIEVEMENTS = [
    { code: 'FIRST_QUIZ', title: 'First Quiz', description: 'Completed your first quiz' },
    { code: 'TEN_QUIZZES', title: '10 Quizzes', description: 'Completed 10 quizzes' },
    { code: 'SEVEN_DAY_STREAK', title: '7 Day Streak', description: 'Studied 7 days in a row' },
    { code: 'PERFECT_SCORE', title: 'Perfect Score', description: 'Scored 100% on a quiz' },
    { code: 'GROUP_CHALLENGER', title: 'Group Challenger', description: 'Participated in a group quiz competition' },
];

export async function seedCoreCurriculum() {
    console.log('Seeding core achievements...');
    for (const a of ACHIEVEMENTS) {
        await prisma.achievement.upsert({
            where: { code: a.code },
            update: a,
            create: a,
        });
    }

    console.log('Seeding Punjab Textbook Board / PECTAA Class 9 Curriculum...');
    const board = await prisma.board.upsert({
        where: { code: 'PUNJAB' },
        update: {
            name: 'Punjab Textbook Board / PECTAA',
            description: 'Punjab Curriculum and Textbook Board / Punjab Examination Commission, Class 9',
        },
        create: {
            name: 'Punjab Textbook Board / PECTAA',
            code: 'PUNJAB',
            description: 'Punjab Curriculum and Textbook Board / Punjab Examination Commission, Class 9',
        },
    });

    const subject = await prisma.curriculumSubject.upsert({
        where: {
            boardId_classGrade_subjectName: {
                boardId: board.id,
                classGrade: '9',
                subjectName: 'Physics',
            },
        },
        update: {
            bookName: 'Physics 9',
            code: 'PHY9',
            description: 'Official Physics textbook for Matric Part 1 (Class 9)',
        },
        create: {
            boardId: board.id,
            classGrade: '9',
            subjectName: 'Physics',
            bookName: 'Physics 9',
            code: 'PHY9',
            description: 'Official Physics textbook for Matric Part 1 (Class 9)',
        },
    });

    // Chapter 1: Physical Quantities and Measurement
    const ch1 = await prisma.curriculumChapter.upsert({
        where: {
            subjectId_chapterNumber: {
                subjectId: subject.id,
                chapterNumber: 1,
            },
        },
        update: {
            chapterName: 'Physical Quantities and Measurement',
            description: 'Physical quantities, SI base & derived units, prefixes, scientific notation, measuring instruments, significant figures.',
        },
        create: {
            subjectId: subject.id,
            chapterNumber: 1,
            chapterName: 'Physical Quantities and Measurement',
            description: 'Physical quantities, SI base & derived units, prefixes, scientific notation, measuring instruments, significant figures.',
        },
    });

    const ch1Topics = [
        'Physical Quantities (Base and Derived)',
        'International System of Units',
        'Prefixes and Scientific Notation',
        'Measuring Instruments',
        'Significant Figures',
    ];
    const ch1TopicRecords = {};
    for (const tName of ch1Topics) {
        const top = await prisma.curriculumTopic.upsert({
            where: {
                chapterId_topicName: {
                    chapterId: ch1.id,
                    topicName: tName,
                },
            },
            update: {},
            create: {
                chapterId: ch1.id,
                topicName: tName,
            },
        });
        ch1TopicRecords[tName] = top.id;
    }

    // Chapter 2: Kinematics
    const ch2 = await prisma.curriculumChapter.upsert({
        where: {
            subjectId_chapterNumber: {
                subjectId: subject.id,
                chapterNumber: 2,
            },
        },
        update: {
            chapterName: 'Kinematics',
            description: 'Rest and motion, types of motion, scalars and vectors, speed, velocity, acceleration, equations of motion, freely falling bodies.',
        },
        create: {
            subjectId: subject.id,
            chapterNumber: 2,
            chapterName: 'Kinematics',
            description: 'Rest and motion, types of motion, scalars and vectors, speed, velocity, acceleration, equations of motion, freely falling bodies.',
        },
    });

    const ch2Topics = [
        'Rest and Motion',
        'Scalars and Vectors',
        'Speed, Velocity and Acceleration',
        'Equations of Motion',
        'Motion of Freely Falling Bodies',
    ];
    const ch2TopicRecords = {};
    for (const tName of ch2Topics) {
        const top = await prisma.curriculumTopic.upsert({
            where: {
                chapterId_topicName: {
                    chapterId: ch2.id,
                    topicName: tName,
                },
            },
            update: {},
            create: {
                chapterId: ch2.id,
                topicName: tName,
            },
        });
        ch2TopicRecords[tName] = top.id;
    }

    // -------------------------------------------------------------
    // 20 Development / Test Fixture Questions (Original, Curriculum-Aligned)
    // -------------------------------------------------------------
    const devQuestions = [
        // CHAPTER 1 (10 Questions)
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Physical Quantities (Base and Derived)'],
            questionText: 'Which of the following physical quantities is an SI base quantity?',
            optionA: 'Speed',
            optionB: 'Mass',
            optionC: 'Force',
            optionD: 'Work',
            correctAnswer: 'B',
            explanation: 'Mass is one of the seven fundamental SI base quantities, measured in kilograms (kg).',
            difficulty: 'EASY',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Physical Quantities (Base and Derived)'],
            questionText: 'Which of the following is a derived quantity in physics?',
            optionA: 'Length',
            optionB: 'Time',
            optionC: 'Electric current',
            optionD: 'Density',
            correctAnswer: 'D',
            explanation: 'Density is defined as mass per unit volume (kg/m^3), making it a derived quantity.',
            difficulty: 'EASY',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['International System of Units'],
            questionText: 'What is the SI unit of thermodynamic temperature?',
            optionA: 'Celsius',
            optionB: 'Fahrenheit',
            optionC: 'Kelvin',
            optionD: 'Rankine',
            correctAnswer: 'C',
            explanation: 'Kelvin (K) is the official SI base unit of thermodynamic temperature.',
            difficulty: 'EASY',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Prefixes and Scientific Notation'],
            questionText: 'Which prefix corresponds to a multiplying factor of 10^-6?',
            optionA: 'Milli',
            optionB: 'Micro',
            optionC: 'Nano',
            optionD: 'Pico',
            correctAnswer: 'B',
            explanation: 'Micro corresponds to 10^-6, denoted by the Greek letter mu (µ).',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Prefixes and Scientific Notation'],
            questionText: 'How is the value 0.00045 expressed in standard scientific notation?',
            optionA: '4.5 x 10^-3',
            optionB: '4.5 x 10^-4',
            optionC: '45 x 10^-5',
            optionD: '0.45 x 10^-3',
            correctAnswer: 'B',
            explanation: 'Moving the decimal point 4 places to the right gives 4.5 x 10^-4.',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Measuring Instruments'],
            questionText: 'What is the least count of a standard mechanical vernier calipers with 10 vernier divisions?',
            optionA: '0.1 cm',
            optionB: '0.01 cm',
            optionC: '0.001 cm',
            optionD: '1 cm',
            correctAnswer: 'B',
            explanation: 'The least count of standard vernier calipers is 0.1 mm, which is equal to 0.01 cm.',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Measuring Instruments'],
            questionText: 'What is the pitch of a screw gauge if one complete rotation moves the spindle by 1 mm?',
            optionA: '0.1 mm',
            optionB: '0.5 mm',
            optionC: '1.0 mm',
            optionD: '0.01 mm',
            correctAnswer: 'C',
            explanation: 'Pitch is the linear distance advanced by the spindle in one complete rotation of the thimble (1 mm).',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Measuring Instruments'],
            questionText: 'If the zero mark of the vernier scale is behind (to the left of) the main scale zero, the zero error is:',
            optionA: 'Positive',
            optionB: 'Negative',
            optionC: 'Zero',
            optionD: 'Neutral',
            correctAnswer: 'B',
            explanation: 'When the vernier zero lies to the left of the main scale zero, the zero error is negative and its correction is positive.',
            difficulty: 'HARD',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Significant Figures'],
            questionText: 'How many significant figures are in the measurement 0.005020 kg?',
            optionA: '3',
            optionB: '4',
            optionC: '6',
            optionD: '7',
            correctAnswer: 'B',
            explanation: 'Leading zeros are not significant. 5, 0, 2, and the trailing 0 are significant, giving 4 significant figures.',
            difficulty: 'HARD',
        },
        {
            chapterId: ch1.id,
            topicId: ch1TopicRecords['Significant Figures'],
            questionText: 'According to rounding rules, rounding 3.75 to two significant figures yields:',
            optionA: '3.7',
            optionB: '3.8',
            optionC: '4.0',
            optionD: '3.70',
            correctAnswer: 'B',
            explanation: 'When the dropped digit is 5 and the preceding digit is odd (7), it is rounded up to the nearest even number (3.8).',
            difficulty: 'HARD',
        },

        // CHAPTER 2 (10 Questions)
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Rest and Motion'],
            questionText: 'A body is said to be in motion if it changes its position with respect to its:',
            optionA: 'Mass',
            optionB: 'Surroundings',
            optionC: 'Density',
            optionD: 'Temperature',
            correctAnswer: 'B',
            explanation: 'Motion and rest are relative states observed with respect to observers or surroundings.',
            difficulty: 'EASY',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Rest and Motion'],
            questionText: 'The motion of a spinning top is an example of which type of motion?',
            optionA: 'Linear motion',
            optionB: 'Rotatory motion',
            optionC: 'Random motion',
            optionD: 'Vibratory motion',
            correctAnswer: 'B',
            explanation: 'Rotatory motion is the spinning of a body about an axis passing through it.',
            difficulty: 'EASY',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Scalars and Vectors'],
            questionText: 'Which of the following is a vector quantity?',
            optionA: 'Distance',
            optionB: 'Speed',
            optionC: 'Displacement',
            optionD: 'Time',
            correctAnswer: 'C',
            explanation: 'Displacement has both magnitude and a specific direction, making it a vector.',
            difficulty: 'EASY',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Scalars and Vectors'],
            questionText: 'Which of the following quantities can be completely specified by magnitude alone with proper units?',
            optionA: 'Force',
            optionB: 'Torque',
            optionC: 'Scalar',
            optionD: 'Acceleration',
            correctAnswer: 'C',
            explanation: 'A scalar quantity is completely described by its magnitude and unit without needing a direction.',
            difficulty: 'EASY',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Speed, Velocity and Acceleration'],
            questionText: 'What is the rate of change of displacement called?',
            optionA: 'Speed',
            optionB: 'Velocity',
            optionC: 'Acceleration',
            optionD: 'Momentum',
            correctAnswer: 'B',
            explanation: 'Velocity is defined as the rate of displacement with respect to time (v = d/t).',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Speed, Velocity and Acceleration'],
            questionText: 'If a car decelerates uniformly, the direction of its acceleration is:',
            optionA: 'In the direction of motion',
            optionB: 'Opposite to the direction of motion',
            optionC: 'Perpendicular to motion',
            optionD: 'Zero',
            correctAnswer: 'B',
            explanation: 'Deceleration (negative acceleration) acts in the direction opposite to velocity.',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Speed, Velocity and Acceleration'],
            questionText: 'What does the slope of a distance-time graph represent?',
            optionA: 'Acceleration',
            optionB: 'Speed',
            optionC: 'Force',
            optionD: 'Momentum',
            correctAnswer: 'B',
            explanation: 'The slope of distance vs time (change in distance / change in time) equals speed.',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Equations of Motion'],
            questionText: 'Which equation correctly expresses the first equation of uniformly accelerated motion?',
            optionA: 'Vf = Vi + at',
            optionB: 'S = Vit + 1/2 at^2',
            optionC: '2aS = Vf^2 - Vi^2',
            optionD: 'Vf = Vi - at',
            correctAnswer: 'A',
            explanation: 'The first equation of motion relates final velocity, initial velocity, acceleration, and time: Vf = Vi + at.',
            difficulty: 'MEDIUM',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Equations of Motion'],
            questionText: 'A car starts from rest (Vi = 0) and accelerates at 2 m/s^2 for 5 seconds. How far does it travel?',
            optionA: '10 m',
            optionB: '20 m',
            optionC: '25 m',
            optionD: '50 m',
            correctAnswer: 'C',
            explanation: 'Using S = Vit + 1/2 at^2: S = 0 + 1/2 * 2 * (5^2) = 25 meters.',
            difficulty: 'HARD',
        },
        {
            chapterId: ch2.id,
            topicId: ch2TopicRecords['Motion of Freely Falling Bodies'],
            questionText: 'When a stone is thrown vertically upward, at its highest point of flight:',
            optionA: 'Velocity is 0 and acceleration is 0',
            optionB: 'Velocity is 0 and acceleration is ~9.8 m/s^2 downward',
            optionC: 'Velocity is maximum and acceleration is 0',
            optionD: 'Both velocity and acceleration are maximum',
            correctAnswer: 'B',
            explanation: 'At maximum height, vertical velocity momentarily becomes zero, while gravitational acceleration continues to act downward at g ≈ 9.8 m/s^2.',
            difficulty: 'HARD',
        },
    ];

    console.log(`Seeding ${devQuestions.length} development test fixture MCQs...`);
    for (const q of devQuestions) {
        const normalizedText = normalizeText(q.questionText);
        const existing = await prisma.questionBankItem.findFirst({
            where: {
                chapterId: q.chapterId,
                normalizedText,
            },
        });

        if (!existing) {
            await prisma.questionBankItem.create({
                data: {
                    boardId: board.id,
                    classGrade: '9',
                    subjectId: subject.id,
                    chapterId: q.chapterId,
                    topicId: q.topicId,
                    questionText: q.questionText,
                    normalizedText,
                    optionA: q.optionA,
                    optionB: q.optionB,
                    optionC: q.optionC,
                    optionD: q.optionD,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                    difficulty: q.difficulty,
                    status: 'APPROVED',
                    questionType: 'MCQ',
                    sourceType: 'ORIGINAL',
                    sourceReference: 'Dev Fixture - PTB Class 9 Physics Curriculum',
                },
            });
        }
    }

    // Seed default admin account if not existing
    const adminPassword = await bcrypt.hash('AdminPass123!', 10);
    await prisma.user.upsert({
        where: { email: 'admin@studify.local' },
        update: { role: 'ADMIN' },
        create: {
            name: 'Studify Administrator',
            username: 'admin_studify',
            email: 'admin@studify.local',
            passwordHash: adminPassword,
            role: 'ADMIN',
            educationLevel: 'OTHER',
            grade: '9',
            board: 'Punjab Textbook Board / PECTAA',
        },
    });

    console.log('Seeded admin user: admin@studify.local (Password: AdminPass123!)');
    console.log('Curriculum and question bank seeding complete.');
}

async function main() {
    await seedCoreCurriculum();
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());