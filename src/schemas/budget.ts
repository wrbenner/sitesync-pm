import { z } from 'zod'

export const budgetCSVRowSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().int('Amount must be an integer (cents)'),
  division: z.string().min(1, 'Division is required').max(50),
  cost_code: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
})
export type BudgetCSVRow = z.infer<typeof budgetCSVRowSchema>

export const budgetCSVSchema = z.array(budgetCSVRowSchema)
export type BudgetCSV = z.infer<typeof budgetCSVSchema>
