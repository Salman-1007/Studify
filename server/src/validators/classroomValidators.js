import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(600).optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  classGrade: z.string().trim().max(40).optional().nullable(),
  board: z.string().trim().max(80).optional().nullable(),
});

export const updateClassroomSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  subject: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(600).optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  classGrade: z.string().trim().max(40).optional().nullable(),
  board: z.string().trim().max(80).optional().nullable(),
  isArchived: z.boolean().optional(),
});

export const joinByCodeSchema = z.object({
  joinCode: z.string().trim().min(4).max(24),
});

export const createInvitationSchema = z.object({
  email: z.string().email().optional().or(z.literal('')).nullable(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
  maxUses: z.coerce.number().int().min(1).max(500).optional().nullable(),
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().max(150).optional().nullable(),
  content: z.string().trim().min(2).max(4000),
  isPinned: z.boolean().optional(),
  postToChat: z.boolean().optional(),
});

export const quizQuestionItemSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(3),
  type: z.enum(['MCQ', 'TRUE_FALSE', 'FILL_BLANK']).default('MCQ'),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().trim().min(1),
  explanation: z.string().optional().nullable(),
});

export const updateTeacherQuizSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  topic: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().max(80).optional().nullable(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  status: z.enum(['DRAFT', 'REVIEWED', 'PUBLISHED', 'ACTIVE', 'CLOSED']).optional(),
  questions: z.array(quizQuestionItemSchema).min(1).optional(),
});

export const assignQuizSchema = z.object({
  classroomIds: z.array(z.string().min(1)).min(1),
  title: z.string().trim().max(180).optional().nullable(),
  instructions: z.string().trim().max(1000).optional().nullable(),
  startsAt: z.string().datetime().optional().or(z.literal('')).nullable(),
  deadline: z.string().datetime().optional().or(z.literal('')).nullable(),
  durationSecs: z.coerce.number().int().min(60).max(14400).optional().nullable(),
  maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
  randomizeQuestions: z.boolean().optional(),
  publishNow: z.boolean().optional(),
});

export const submitAssignmentAttemptSchema = z.object({
  submissionId: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string().optional().default(''),
    })
  ),
  timeTakenSecs: z.coerce.number().int().min(0).default(0),
});
