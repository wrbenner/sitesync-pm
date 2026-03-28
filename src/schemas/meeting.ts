import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  meetingType: z.enum(['oac', 'safety', 'coordination', 'general']),
  meetingDate: z.string().min(1, 'Date is required'),
  meetingTime: z.string().min(1, 'Time is required'),
  location: z.string().max(200).optional(),
});

export const actionItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
});

export type CreateMeetingFormData = z.infer<typeof createMeetingSchema>;
export type ActionItemFormData = z.infer<typeof actionItemSchema>;
