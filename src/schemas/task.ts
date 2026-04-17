import { z } from 'zod'

export const taskPriorityEnum = z.enum(['critical', 'high', 'medium', 'low'])
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'in_review', 'done'])

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().optional().or(z.literal('')),
  assignee: z.string().optional().or(z.literal('')),
  due_date: z.string().min(1, 'Due date is required'),
  priority: taskPriorityEnum.default('medium'),
  status: taskStatusEnum.default('todo'),
})
export type CreateTaskInput = z.infer<typeof createTaskSchema>
