import { z } from 'zod'

// ── RFI Schema ──────────────────────────────────────────

export const rfiSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigned_to: z.string().default(''),
  spec_section: z.string().default(''),
  drawing_reference: z.string().default(''),
  due_date: z.string().default(''),
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
