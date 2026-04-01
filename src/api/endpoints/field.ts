import { supabase, transformSupabaseError, supabaseMutation, buildPaginatedQuery } from '../client'
import { assertProjectAccess, validateProjectId } from '../middleware/projectScope'
import type { DailyLogRow, DailyLogEntryRow, FieldCaptureRow, PunchItemRow, DailyLogPayload, PaginationParams, PaginatedResult } from '../../types/api'
import type { Json } from '../../types/database'

// Sub-entry shapes produced from daily_log_entries rows

export interface CrewEntry {
  company: string
  trade: string
  headcount: number
  hours: number
}

export interface EquipmentEntry {
  type: string
  count: number
  hours_operated: number
}

export interface MaterialDelivery {
  description: string
  quantity: number
  po_reference: string
  delivery_ticket: string
}

export interface Visitor {
  name: string
  company: string
  purpose: string
  time_in: string
  time_out: string
}

export interface IncidentDetail {
  description: string
  type: string
  corrective_action: string
}

// Full return shape of getDailyLogs — mirrors daily_logs DB schema plus computed fields

export interface DailyLogEntry {
  // DB columns (daily_logs.Row)
  id: string
  project_id: string
  log_date: string
  ai_summary: string | null
  approved: boolean | null
  approved_at: string | null
  approved_by: string | null
  created_at: string | null
  created_by: string | null
  incidents: number | null
  manager_signature_url: string | null
  precipitation: string | null
  rejection_comments: string | null
  status: string | null
  superintendent_signature_url: string | null
  summary: string | null
  temperature_high: number | null
  temperature_low: number | null
  total_hours: number | null
  updated_at: string | null
  weather: string | null
  weather_am: string | null
  weather_pm: string | null
  weather_source: string | null
  wind_speed: string | null
  workers_onsite: number | null
  is_submitted: boolean | null
  submitted_at: string | null
  version: number | null
  // Computed / display fields
  date: string
  workers: number
  manHours: number
  weather_display: string
  summary_display: string
  crew_entries: CrewEntry[]
  equipment_entries: EquipmentEntry[]
  material_deliveries: MaterialDelivery[]
  visitors: Visitor[]
  incident_details: IncidentDetail[]
  safety_observations: string
  toolbox_talk_topic: string
}

// Full return shape of getFieldCaptures

export interface FieldCapture {
  id: string
  project_id: string
  ai_category: string | null
  ai_tags: Json | null
  content: string | null
  created_at: string | null
  created_by: string | null
  file_url: string | null
  linked_drawing_id: string | null
  location: string | null
  type: string | null
}

// Full return shape of getPunchList

export interface PunchListItem {
  // DB columns (punch_items.Row)
  id: string
  project_id: string
  number: number
  title: string
  description: string | null
  status: string | null
  priority: string | null
  area: string | null
  floor: string | null
  location: string | null
  trade: string | null
  assigned_to: string | null
  reported_by: string | null
  due_date: string | null
  resolved_date: string | null
  verified_date: string | null
  photos: Json | null
  created_at: string | null
  updated_at: string | null
  // Extended DB columns (present in DB but not yet in generated schema)
  verification_status: string
  verified_by: string | null
  verified_at: string | null
  sub_completed_at: string | null
  before_photo_url: string | null
  after_photo_url: string | null
  rejection_reason: string | null
  // Computed / display fields
  itemNumber: string
  assigned: string
  hasPhoto: boolean
  dueDate: string
}

export const createDailyLog = async (projectId: string, payload: DailyLogPayload): Promise<DailyLogRow> => {
  const { photos: _photos, ...dbPayload } = payload
  return supabaseMutation<DailyLogRow>(client =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('daily_logs') as any).insert({ ...dbPayload, project_id: projectId }).select().single()
  )
}

export const updateDailyLog = async (id: string, payload: Partial<DailyLogPayload>): Promise<DailyLogRow> => {
  const { photos: _photos, ...dbPayload } = payload
  return supabaseMutation<DailyLogRow>(client =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('daily_logs') as any).update(dbPayload).eq('id', id).select().single()
  )
}

export const submitDailyLog = async (
  projectId: string,
  id: string,
  signatureUrl?: string
): Promise<DailyLogRow> => {
  validateProjectId(projectId)
  const updates: Record<string, unknown> = {
    status: 'submitted',
    is_submitted: true,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (signatureUrl) updates.superintendent_signature_url = signatureUrl
  return supabaseMutation<DailyLogRow>(client =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.from('daily_logs') as any)
      .update(updates)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single()
  )
}

export const getDailyLogs = async (
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<DailyLogEntry>> => {
  await assertProjectAccess(projectId)
  const { page = 1, pageSize = 50 } = pagination ?? {}
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await supabase
    .from('daily_logs')
    .select('*, daily_log_entries(*)', { count: 'exact' })
    .eq('project_id', projectId)
    .order('log_date', { ascending: false })
    .range(from, to)
  if (error) throw transformSupabaseError(error)

  const rows = (data || []).map((l: DailyLogRow & { daily_log_entries?: DailyLogEntryRow[] }): DailyLogEntry => {
    const entries: DailyLogEntryRow[] = l.daily_log_entries ?? []

    const crew_entries: CrewEntry[] = entries
      .filter(e => e.type === 'crew')
      .map(e => ({
        company: e.company ?? '',
        trade: e.trade ?? '',
        headcount: e.headcount ?? 0,
        hours: e.hours ?? 0,
      }))

    const equipment_entries: EquipmentEntry[] = entries
      .filter(e => e.type === 'equipment')
      .map(e => ({
        type: e.equipment_name ?? e.description ?? '',
        count: e.headcount ?? 1,
        hours_operated: e.equipment_hours ?? 0,
      }))

    const material_deliveries: MaterialDelivery[] = entries
      .filter(e => e.type === 'delivery')
      .map(e => ({
        description: e.description ?? '',
        quantity: e.quantity ?? 0,
        po_reference: e.po_number ?? '',
        delivery_ticket: e.condition ?? '',
      }))

    const visitors: Visitor[] = entries
      .filter(e => e.type === 'visitor')
      .map(e => ({
        name: e.inspector_name ?? '',
        company: e.company ?? '',
        purpose: e.description ?? '',
        time_in: e.time_in ?? '',
        time_out: e.time_out ?? '',
      }))

    const incident_details: IncidentDetail[] = entries
      .filter(e => e.type === 'incident')
      .map(e => ({
        description: e.description ?? '',
        type: e.condition ?? '',
        corrective_action: e.delay_cause ?? '',
      }))

    const safetyEntry = entries.find(e => e.type === 'safety')
    const toolboxEntry = entries.find(e => e.type === 'toolbox_talk')

    return {
      id: l.id,
      project_id: l.project_id,
      log_date: l.log_date,
      ai_summary: l.ai_summary,
      approved: l.approved,
      approved_at: l.approved_at,
      approved_by: l.approved_by,
      created_at: l.created_at,
      created_by: l.created_by,
      incidents: l.incidents,
      manager_signature_url: l.manager_signature_url,
      precipitation: l.precipitation,
      rejection_comments: l.rejection_comments,
      status: l.status,
      superintendent_signature_url: l.superintendent_signature_url,
      summary: l.summary,
      temperature_high: l.temperature_high,
      temperature_low: l.temperature_low,
      total_hours: l.total_hours,
      updated_at: l.updated_at,
      weather: l.weather,
      weather_am: l.weather_am,
      weather_pm: l.weather_pm,
      weather_source: l.weather_source,
      wind_speed: l.wind_speed,
      workers_onsite: l.workers_onsite,
      is_submitted: l.is_submitted,
      submitted_at: l.submitted_at,
      version: l.version,
      // Computed fields
      date: l.log_date,
      workers: l.workers_onsite ?? 0,
      manHours: l.total_hours ?? 0,
      weather_display: l.weather ?? 'N/A',
      summary_display: l.summary ?? '',
      crew_entries,
      equipment_entries,
      material_deliveries,
      visitors,
      incident_details,
      safety_observations: safetyEntry?.description ?? '',
      toolbox_talk_topic: toolboxEntry?.description ?? '',
    }
  })
  return { data: rows, total: count ?? 0, page, pageSize }
}

export const getFieldCaptures = async (projectId: string): Promise<FieldCapture[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('field_captures')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []).map((c: FieldCaptureRow): FieldCapture => ({
    id: c.id,
    project_id: c.project_id,
    ai_category: c.ai_category,
    ai_tags: c.ai_tags,
    content: c.content,
    created_at: c.created_at,
    created_by: c.created_by,
    file_url: c.file_url,
    linked_drawing_id: c.linked_drawing_id,
    location: c.location,
    type: c.type,
  }))
}

export const getPunchList = async (
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<PunchListItem>> => {
  await assertProjectAccess(projectId)
  const { page = 1, pageSize = 50 } = pagination ?? {}
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await supabase
    .from('punch_items')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('number', { ascending: false })
    .range(from, to)
  if (error) throw transformSupabaseError(error)
  const rows = (data || []).map((p: PunchItemRow): PunchListItem => ({
    id: p.id,
    project_id: p.project_id,
    number: p.number,
    title: p.title,
    description: p.description,
    status: p.status,
    priority: p.priority,
    area: p.area,
    floor: p.floor,
    location: p.location,
    trade: p.trade,
    assigned_to: p.assigned_to,
    reported_by: p.reported_by,
    due_date: p.due_date,
    resolved_date: p.resolved_date,
    verified_date: p.verified_date,
    photos: p.photos,
    created_at: p.created_at,
    updated_at: p.updated_at,
    verification_status: p.verification_status ?? 'open',
    verified_by: p.verified_by ?? null,
    verified_at: p.verified_at ?? null,
    sub_completed_at: p.sub_completed_at ?? null,
    before_photo_url: p.before_photo_url ?? null,
    after_photo_url: p.after_photo_url ?? null,
    rejection_reason: p.rejection_reason ?? null,
    itemNumber: p.number ? `PL-${String(p.number).padStart(3, '0')}` : p.id?.slice(0, 8),
    assigned: p.assigned_to ?? 'Unassigned',
    hasPhoto: Array.isArray(p.photos) && p.photos.length > 0,
    dueDate: p.due_date ?? '',
  }))
  return { data: rows, total: count ?? 0, page, pageSize }
}
