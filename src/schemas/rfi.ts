import { z } from 'zod'

export const rfiPriorityEnum = z.enum(['critical', 'high', 'medium', 'low'])

export const createRFISchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().min(1, 'Description is required'),
  priority: rfiPriorityEnum.default('medium'),
  due_date: z.string().optional().or(z.literal('')),
  assigned_to: z.string().optional().or(z.literal('')),
  spec_section: z.string().optional().or(z.literal('')),
  drawing_reference: z.string().optional().or(z.literal('')),
})
export type CreateRFIInput = z.infer<typeof createRFISchema>
