import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  username: z.string().min(3, 'Username is too short').regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).default('OTHER'),
  grade: z.string().optional(),
  institution: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});
