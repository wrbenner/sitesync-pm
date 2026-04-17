import { z } from 'zod'

export const changeOrderTypeEnum = z.enum(['pco', 'cor', 'co'])

export const createChangeOrderSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  amount: z.number().int('Amount must be an integer (cents)'),
  reason: z.string().min(1, 'Reason is required').max(5000),
  type: changeOrderTypeEnum.default('pco'),
  cost_codes: z.string().optional().or(z.literal('')),
  requested_by: z.string().optional().or(z.literal('')),
  requested_date: z.string().optional().or(z.literal('')),
})
export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>
