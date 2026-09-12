import { z } from 'zod';

export const generateQuizSchema = z.object({
  topic: z.string().min(2),
  subject: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  numQuestions: z.number().int().min(1).max(20).default(5),
  materialId: z.string().optional(),
});

export const submitAttemptSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
  })),
  timeTakenSecs: z.number().int().min(0).default(0),
});
