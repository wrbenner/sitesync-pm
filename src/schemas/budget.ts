import { z } from 'zod';

export const createChangeOrderSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  amount: z.number().min(0, 'Amount must be positive'),
});

export const budgetLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  costCode: z.string().min(1, 'Cost code is required').max(20),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  unitCost: z.number().min(0),
});

export type CreateChangeOrderFormData = z.infer<typeof createChangeOrderSchema>;
export type BudgetLineItemFormData = z.infer<typeof budgetLineItemSchema>;
