import { z } from 'zod'

// Re-export canonical schemas from src/schemas/ (single source of truth).
// The EntityFormModal-specific schemas below use more permissive defaults
// because the modal binds to uncontrolled inputs that start as ''.
export { createRFISchema } from '../../schemas/rfi'
export { createSubmittalSchema } from '../../schemas/submittal'
export { createTaskSchema } from '../../schemas/task'
export { createChangeOrderSchema } from '../../schemas/changeOrder'
export { createMeetingSchema } from '../../schemas/meeting'
export { createPunchItemSchema } from '../../schemas/punchItem'
export { createIncidentSchema } from '../../schemas/incident'
export { createDailyLogSchema } from '../../schemas/dailyLog'

// ── RFI Schema ──────────────────────────────────────────

export const rfiSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigned_to: z.string().default(''),
  spec_section: z.string().default(''),
  drawing_reference: z.string().default(''),
  due_date: z.string().default(''),
  related_submittal_id: z.string().default(''),
})

export type RFIFormValues = z.infer<typeof rfiSchema>

// ── Submittal Schema ────────────────────────────────────

export const submittalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  spec_section: z.string().default(''),
  type: z.enum(['shop_drawing', 'product_data', 'sample', 'design_data', 'test_report', 'certificate', 'closeout']).default('shop_drawing'),
  subcontractor: z.string().default(''),
  due_date: z.string().default(''),
  description: z.string().default(''),
  related_rfi_id: z.string().default(''),
})

export type SubmittalFormValues = z.infer<typeof submittalSchema>

// ── Punch Item Schema ───────────────────────────────────

export const punchItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  location: z.string().default(''),
  floor: z.string().default(''),
  trade: z.string().default(''),
  assigned_to: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  due_date: z.string().default(''),
  description: z.string().default(''),
  drawing_id: z.string().default(''),
})

export type PunchItemFormValues = z.infer<typeof punchItemSchema>

// ── Daily Log Schema ────────────────────────────────────

export const dailyLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  weather_condition: z.enum(['clear', 'partly_cloudy', 'cloudy', 'rain', 'snow', 'fog', 'windy']).default('clear'),
  temperature_high: z.string().default(''),
  temperature_low: z.string().default(''),
  crew_count: z.string().default(''),
  activities: z.string().default(''),
  safety_notes: z.string().default(''),
  delays: z.string().default(''),
})

export type DailyLogFormValues = z.infer<typeof dailyLogSchema>

// ── Change Order Schema ─────────────────────────────────

export const changeOrderSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  type: z.enum(['pco', 'cor', 'co']).default('pco'),
  description: z.string().min(1, 'Description is required'),
  amount: z.string().default(''),
  cost_codes: z.string().default(''),
  justification: z.string().default(''),
  requested_by: z.string().default(''),
  requested_date: z.string().default(''),
})

export type ChangeOrderFormValues = z.infer<typeof changeOrderSchema>

// ── Meeting Schema ──────────────────────────────────────

export const meetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  type: z.enum(['oac', 'safety', 'coordination', 'progress', 'subcontractor']).default('oac'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().default(''),
  location: z.string().default(''),
  duration_minutes: z.string().default('60'),
  agenda: z.string().default(''),
})

export type MeetingFormValues = z.infer<typeof meetingSchema>

// ── Task Schema ─────────────────────────────────────────

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().default(''),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigned_to: z.string().default(''),
  start_date: z.string().default(''),
  end_date: z.string().default(''),
  is_critical_path: z.boolean().default(false),
})

export type TaskFormValues = z.infer<typeof taskSchema>

// ── File Upload Schema ─────────────────────────────────

export const fileSchema = z.object({
  name: z.string().min(1, 'File name is required').max(255, 'File name must be under 255 characters'),
  folder: z.string().default(''),
  description: z.string().default(''),
  tags: z.string().default(''),
})

export type FileFormValues = z.infer<typeof fileSchema>

// ── Crew Schema ────────────────────────────────────────

export const crewSchema = z.object({
  name: z.string().min(1, 'Crew name is required').max(100, 'Crew name must be under 100 characters'),
  trade: z.string().default(''),
  foreman: z.string().default(''),
  size: z.string().default(''),
  shift: z.enum(['day', 'night', 'swing']).default('day'),
})

export type CrewFormValues = z.infer<typeof crewSchema>

// ── Directory Contact Schema ───────────────────────────

export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150, 'Name must be under 150 characters'),
  company: z.string().default(''),
  role: z.string().default(''),
  email: z.string().email('Invalid email address').or(z.literal('')).default(''),
  phone: z.string().default(''),
  trade: z.string().default(''),
})

export type ContactFormValues = z.infer<typeof contactSchema>

// ── Safety Inspection Schema ───────────────────────────

export const safetyInspectionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  type: z.enum(['daily', 'weekly', 'toolbox_talk', 'incident_investigation', 'compliance']).default('daily'),
  location: z.string().default(''),
  inspector: z.string().default(''),
  date: z.string().min(1, 'Date is required'),
  findings: z.string().default(''),
  corrective_actions: z.string().default(''),
})

export type SafetyInspectionFormValues = z.infer<typeof safetyInspectionSchema>

// ── Field Capture Schema ───────────────────────────────

export const fieldCaptureSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  location: z.string().default(''),
  notes: z.string().default(''),
  capture_type: z.enum(['photo', 'video', 'voice', 'document']).default('photo'),
})

export type FieldCaptureFormValues = z.infer<typeof fieldCaptureSchema>

// ── Permit Schema ──────────────────────────────────────

export const permitSchema = z.object({
  type: z.string().min(1, 'Permit type is required'),
  permit_number: z.string().default(''),
  jurisdiction: z.string().default(''),
  status: z.enum([
    'not_applied',
    'application_submitted',
    'under_review',
    'approved',
    'denied',
    'expired',
  ]).default('not_applied'),
  applied_date: z.string().default(''),
  expiration_date: z.string().default(''),
  fee: z.coerce.number().optional(),
  notes: z.string().default(''),
})

export type PermitFormValues = z.infer<typeof permitSchema>

// ── Contract Schema ────────────────────────────────────

export const contractSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  contract_type: z.enum(['prime', 'subcontract', 'psa', 'purchase_order']).default('subcontract'),
  counterparty_name: z.string().min(1, 'Counterparty is required'),
  contract_amount: z.coerce.number().default(0),
  start_date: z.string().default(''),
  end_date: z.string().default(''),
  retention_percentage: z.coerce.number().min(0).max(100).default(10),
  scope_of_work: z.string().default(''),
  insurance_required: z.boolean().default(true),
  bonding_required: z.boolean().default(false),
  status: z.enum([
    'draft',
    'pending_signature',
    'active',
    'completed',
    'terminated',
  ]).default('draft'),
})

export type ContractFormValues = z.infer<typeof contractSchema>

// ── Vendor Schema ──────────────────────────────────────

export const vendorSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200, 'Company name must be under 200 characters'),
  contact_name: z.string().default(''),
  email: z.string().email('Invalid email address').or(z.literal('')).default(''),
  phone: z.string().default(''),
  trade: z.string().default(''),
  license_number: z.string().default(''),
  insurance_expiry: z.string().default(''),
  bonding_capacity: z.coerce.number().optional(),
  status: z.enum(['active', 'probation', 'suspended', 'blacklisted']).default('active'),
  notes: z.string().default(''),
})

export type VendorFormValues = z.infer<typeof vendorSchema>

// ── Pay Application Schema ─────────────────────────────

export const payApplicationSchema = z.object({
  contract_id: z.string().min(1, 'Contract is required'),
  application_number: z.coerce.number().int().positive().optional(),
  period_from: z.string().default(''),
  period_to: z.string().min(1, 'Period end date is required'),
  original_contract_sum: z.coerce.number().optional(),
  net_change_orders: z.coerce.number().optional(),
  total_completed_and_stored: z.coerce.number().optional(),
  retainage: z.coerce.number().optional(),
  total_earned_less_retainage: z.coerce.number().optional(),
  less_previous_certificates: z.coerce.number().optional(),
  current_payment_due: z.coerce.number().optional(),
  balance_to_finish: z.coerce.number().optional(),
})

export type PayApplicationFormValues = z.infer<typeof payApplicationSchema>

// ── Project Schema (for Update) ───────────────────────

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name must be under 200 characters'),
  address: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  project_type: z.string().default(''),
  contract_value: z.coerce.number().optional(),
  start_date: z.string().default(''),
  target_completion: z.string().default(''),
  description: z.string().default(''),
  status: z.enum(['active', 'on_hold', 'complete', 'archived']).default('active'),
})

export type ProjectFormValues = z.infer<typeof projectSchema>

// ── Budget Line Item Schema ────────────────────────────

export const budgetLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  csi_code: z.string().default(''),
  original_amount: z.coerce.number().default(0),
  revised_budget: z.coerce.number().optional(),
})

export type BudgetLineItemFormValues = z.infer<typeof budgetLineItemSchema>
