// BIM Data Service: CRUD operations for BIM digital twin data.
// Connects IFC model elements to project entities (RFIs, safety zones, progress).

import { supabase } from '../../lib/supabase'

// ── Element Progress ─────────────────────────────────────

export interface ElementProgressInput {
  project_id: string
  ifc_element_id: number
  global_id?: string
  element_name: string
  completion_percent: number
  notes?: string
}

export async function upsertElementProgress(input: ElementProgressInput): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('bim_element_progress' as string).upsert({
    ...input,
    completion_percent: Math.min(100, Math.max(0, input.completion_percent)),
    updated_by: userId,
    last_updated: new Date().toISOString(),
  }, { onConflict: 'project_id,ifc_element_id' } as Record<string, unknown>)

  if (error) throw new Error(`Failed to update progress: ${error.message}`)
}

export async function getElementProgress(projectId: string, elementId: number) {
  const { data, error } = await supabase
    .from('bim_element_progress' as string)
    .select('*')
    .eq('project_id', projectId)
    .eq('ifc_element_id', elementId)
    .single()

  if (error) return null
  return data
}

export async function getProjectProgress(projectId: string) {
  const { data, error } = await supabase
    .from('bim_element_progress' as string)
    .select('*')
    .eq('project_id', projectId)

  if (error) return []
  return data || []
}

// ── RFI → Element Associations ───────────────────────────

export interface RFIElementInput {
  rfi_id: string
  project_id: string
  ifc_element_id: number
  location_x: number
  location_y: number
  location_z: number
}

export async function addRFIToElement(input: RFIElementInput): Promise<void> {
  const { error } = await supabase.from('bim_rfi_elements' as string).insert(input)
  if (error) throw new Error(`Failed to associate RFI: ${error.message}`)
}

export async function getRFIElements(projectId: string) {
  const { data, error } = await supabase
    .from('bim_rfi_elements' as string)
    .select('*, rfi:rfi_id(id, number, title, status, priority)')
    .eq('project_id', projectId)

  if (error) return []
  return data || []
}

// ── Safety Zones ─────────────────────────────────────────

export interface SafetyZoneInput {
  project_id: string
  hazard_type: string
  zone_bounds: {
    minX: number; maxX: number
    minY: number; maxY: number
    minZ: number; maxZ: number
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  expires_at?: string
}

export async function createSafetyZone(input: SafetyZoneInput): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('bim_safety_zones' as string).insert({
    ...input,
    created_by: userId,
  })
  if (error) throw new Error(`Failed to create safety zone: ${error.message}`)
}

export async function getActiveSafetyZones(projectId: string) {
  const { data, error } = await supabase
    .from('bim_safety_zones' as string)
    .select('*')
    .eq('project_id', projectId)
    .eq('active', true)

  if (error) return []
  return data || []
}

// ── 4D Sequence ──────────────────────────────────────────

export async function get4DSequence(projectId: string) {
  const { data, error } = await supabase
    .from('bim_4d_sequence' as string)
    .select('*, task:task_id(id, title, status, start_date, end_date)')
    .eq('project_id', projectId)
    .order('sequence_order', { ascending: true })

  if (error) return []
  return data || []
}

// ── Crew GPS ─────────────────────────────────────────────

export async function getCrewLocations(projectId: string) {
  const { data, error } = await supabase
    .from('crew_gps_locations' as string)
    .select('*, crew:crew_id(id, name, trade, status)')
    .eq('project_id', projectId)
    .order('recorded_at', { ascending: false })
    .limit(50)

  if (error) return []
  return data || []
}

export async function reportCrewLocation(
  crewId: string,
  projectId: string,
  latitude: number,
  longitude: number,
  altitude?: number,
  accuracyMeters?: number,
): Promise<void> {
  const { error } = await supabase.from('crew_gps_locations' as string).insert({
    crew_id: crewId,
    project_id: projectId,
    latitude,
    longitude,
    altitude: altitude ?? null,
    accuracy_meters: accuracyMeters ?? null,
  })
  if (error) throw new Error(`Failed to report location: ${error.message}`)
}
