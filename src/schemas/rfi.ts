import { z } from 'zod';

const priorityEnum = z.enum(['critical', 'high', 'medium', 'low']);

export const createRfiSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: priorityEnum,
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const rfiResponseSchema = z.object({
  responseText: z.string().min(1, 'Response is required').max(5000),
  attachments: z.array(z.string()).optional(),
});

export type CreateRfiFormData = z.infer<typeof createRfiSchema>;
export type RfiResponseFormData = z.infer<typeof rfiResponseSchema>;
