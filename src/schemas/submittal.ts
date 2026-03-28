import { z } from 'zod';

const priorityEnum = z.enum(['critical', 'high', 'medium', 'low']);

export const createSubmittalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  specSection: z.string().max(20).optional(),
  priority: priorityEnum,
  dueDate: z.string().optional(),
});

export type CreateSubmittalFormData = z.infer<typeof createSubmittalSchema>;
