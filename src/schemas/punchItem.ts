import { z } from 'zod';

const priorityEnum = z.enum(['critical', 'high', 'medium', 'low']);

export const createPunchItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  area: z.string().min(1, 'Area is required').max(100),
  assignedTo: z.string().optional(),
  priority: priorityEnum,
  dueDate: z.string().optional(),
});

export type CreatePunchItemFormData = z.infer<typeof createPunchItemSchema>;
