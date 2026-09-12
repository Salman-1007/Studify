import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACHIEVEMENTS = [
  { code: 'FIRST_QUIZ', title: 'First Quiz', description: 'Completed your first quiz' },
  { code: 'TEN_QUIZZES', title: '10 Quizzes', description: 'Completed 10 quizzes' },
  { code: 'SEVEN_DAY_STREAK', title: '7 Day Streak', description: 'Studied 7 days in a row' },
  { code: 'PERFECT_SCORE', title: 'Perfect Score', description: 'Scored 100% on a quiz' },
  { code: 'GROUP_CHALLENGER', title: 'Group Challenger', description: 'Participated in a group quiz competition' },
];

async function main() {
  console.log('Seeding demo data...');

  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { code: a.code }, update: a, create: a });
  }

  const passwordHash = await bcrypt.hash('Demo1234', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'demo@studify.app' },
    update: {},
    create: {
      name: 'Alice Demo', username: 'alice_demo', email: 'demo@studify.app', passwordHash,
      educationLevel: 'UNIVERSITY', institution: 'CUI Lahore', points: 45, streakCount: 3,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@studify.app' },
    update: {},
    create: {
      name: 'Bob Demo', username: 'bob_demo', email: 'bob@studify.app', passwordHash,
      educationLevel: 'UNIVERSITY', institution: 'CUI Lahore', points: 30, streakCount: 1,
    },
  });

  const material = await prisma.material.create({
    data: {
      userId: alice.id, title: "Newton's Laws of Motion", category: 'Physics',
      extractedText: "Newton's First Law: An object stays at rest or in uniform motion unless acted on by a net force. Newton's Second Law: F = ma. Newton's Third Law: every action has an equal and opposite reaction.",
    },
  });
  await prisma.materialChunk.create({ data: { materialId: material.id, chunkIndex: 0, content: material.extractedText } });

  const quiz = await prisma.quiz.create({
    data: {
      title: "Newton's Laws Quiz", topic: "Newton's Laws", subject: 'Physics', difficulty: 'MEDIUM',
      creatorId: alice.id, materialId: material.id, source: 'seed',
      questions: {
        create: [
          { question: 'What is F = ma an expression of?', type: 'MCQ', options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", 'Law of Gravitation'], correctAnswer: "Newton's Second Law", explanation: 'F=ma is Newton\'s Second Law.', order: 0 },
          { question: 'An object in motion stays in motion unless acted upon by a net force.', type: 'TRUE_FALSE', options: ['True', 'False'], correctAnswer: 'True', explanation: "This is Newton's First Law (inertia).", order: 1 },
          { question: 'Every action has an equal and opposite ____.', type: 'FILL_BLANK', options: null, correctAnswer: 'reaction', explanation: "Newton's Third Law.", order: 2 },
        ],
      },
    },
    include: { questions: true },
  });

  await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id, userId: alice.id, score: 2, totalQuestions: 3, percentage: 66.7, timeTakenSecs: 120,
    },
  });
  await prisma.userTopicPerformance.upsert({
    where: { userId_topic: { userId: alice.id, topic: "Newton's Laws" } },
    update: {},
    create: { userId: alice.id, topic: "Newton's Laws", subject: 'Physics', correctCount: 2, totalCount: 3, isWeak: false },
  });

  const group = await prisma.studyGroup.upsert({
    where: { joinCode: 'DEMO1234' },
    update: {},
    create: {
      name: 'Physics Study Circle', description: 'Group for mechanics revision', subject: 'Physics',
      privacy: 'PUBLIC', joinCode: 'DEMO1234', ownerId: alice.id,
      members: { create: [{ userId: alice.id, role: 'OWNER' }, { userId: bob.id, role: 'MEMBER' }] },
    },
  });

  await prisma.groupMessage.create({ data: { groupId: group.id, senderId: alice.id, content: 'Welcome to the group! Quiz competition this weekend.' } });

  const conversation = await prisma.conversation.create({
    data: { userId: alice.id, title: "Newton's Laws help", materialId: material.id },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, role: 'user', content: 'Can you explain the second law simply?' },
      { conversationId: conversation.id, role: 'assistant', content: 'Sure! F=ma means the force on an object equals its mass times acceleration — heavier objects need more force to accelerate at the same rate.' },
    ],
  });

  console.log('Seed complete.');
  console.log('Demo login: demo@studify.app / Demo1234 (username: alice_demo)');
  console.log('Second demo user: bob@studify.app / Demo1234 (username: bob_demo)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
