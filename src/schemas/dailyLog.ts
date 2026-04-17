import { z } from 'zod'

export const createDailyLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  weather_summary: z.string().optional().or(z.literal('')),
  work_summary: z.string().optional().or(z.literal('')),
  issues_delays: z.string().optional().or(z.literal('')),
})
export type CreateDailyLogInput = z.infer<typeof createDailyLogSchema>

export const crewHoursEntrySchema = z.object({
  crew_name: z.string().min(1, 'Crew name is required').max(120),
  trade: z.string().optional().or(z.literal('')),
  workers: z
    .number()
    .int('Workers must be a whole number')
    .nonnegative('Workers must be non-negative'),
  hours: z
    .number()
    .nonnegative('Hours must be non-negative')
    .max(24, 'Hours cannot exceed 24'),
})
export type CrewHoursEntryInput = z.infer<typeof crewHoursEntrySchema>
