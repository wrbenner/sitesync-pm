import { z } from 'zod';

export const createDailyLogSchema = z.object({
  logDate: z.string().min(1, 'Date is required'),
  weatherCondition: z.string().optional(),
  temperature: z.number().optional(),
  wind: z.string().optional(),
});

export const dailyLogEntrySchema = z.object({
  entryType: z.enum(['manpower', 'equipment', 'incident', 'note', 'photo']),
  data: z.record(z.string(), z.unknown()),
});

export type CreateDailyLogFormData = z.infer<typeof createDailyLogSchema>;
export type DailyLogEntryFormData = z.infer<typeof dailyLogEntrySchema>;
