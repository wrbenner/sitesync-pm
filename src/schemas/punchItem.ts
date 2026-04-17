import { z } from 'zod'

export const punchPriorityEnum = z.enum(['critical', 'high', 'medium', 'low'])

export const createPunchItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  location: z.string().min(1, 'Location is required').max(200),
  assignee: z.string().min(1, 'Assignee is required').max(200),
  priority: punchPriorityEnum.default('medium'),
  floor: z.string().optional().or(z.literal('')),
  trade: z.string().optional().or(z.literal('')),
  due_date: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
})
export type CreatePunchItemInput = z.infer<typeof createPunchItemSchema>
