import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  subject: z.string().optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  memberIds: z.array(z.string()).optional(),
});

export const joinGroupSchema = z.object({
  joinCode: z.string().optional(),
});
