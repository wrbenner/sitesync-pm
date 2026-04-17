import { z } from 'zod'

export const submittalTypeEnum = z.enum([
  'shop_drawing',
  'product_data',
  'sample',
  'design_data',
  'test_report',
  'certificate',
  'closeout',
])

export const createSubmittalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  spec_section: z.string().min(1, 'Spec section is required').max(50),
  due_date: z.string().min(1, 'Due date is required'),
  type: submittalTypeEnum.default('shop_drawing'),
  subcontractor: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
})
export type CreateSubmittalInput = z.infer<typeof createSubmittalSchema>
