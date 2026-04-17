import { z } from 'zod'

export const meetingTypeEnum = z.enum(['oac', 'safety', 'coordination', 'progress', 'subcontractor'])

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  date: z.string().min(1, 'Date is required'),
  type: meetingTypeEnum,
  attendees: z.array(z.string().min(1, 'Attendee name required').max(200)).default([]),
  time: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  duration_minutes: z.number().int().positive('Duration must be positive').optional(),
  agenda: z.string().optional().or(z.literal('')),
})
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>
