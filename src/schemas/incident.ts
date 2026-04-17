import { z } from 'zod'

export const incidentSeverityEnum = z.enum(['near_miss', 'minor', 'recordable', 'lost_time', 'critical'])

export const createIncidentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  severity: incidentSeverityEnum,
  description: z.string().min(1, 'Description is required').max(5000),
  location: z.string().min(1, 'Location is required').max(200),
  corrective_action: z.string().optional().or(z.literal('')),
})
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
