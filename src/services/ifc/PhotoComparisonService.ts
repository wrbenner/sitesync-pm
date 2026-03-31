// Photo Comparison Service: Creates before/after comparisons from photo pins
// and calculates days elapsed for progress tracking.

import { supabase } from '../../lib/supabase'

export async function createPhotoComparison(
  projectId: string,
  beforePhotoId: string,
  afterPhotoId: string,
): Promise<string> {
  // Fetch both photos
  const { data: photos, error } = await supabase
    .from('photo_pins' as string)
    .select('id, photo_url, taken_at')
    .in('id', [beforePhotoId, afterPhotoId])

  if (error || !photos || photos.length !== 2) {
    throw new Error('Failed to fetch photo pair')
  }

  const before = photos.find((p: Record<string, unknown>) => p.id === beforePhotoId) as Record<string, unknown>
  const after = photos.find((p: Record<string, unknown>) => p.id === afterPhotoId) as Record<string, unknown>

  if (!before || !after) throw new Error('Photo not found')

  const daysElapsed = Math.max(0, Math.floor(
    (new Date(after.taken_at as string).getTime() - new Date(before.taken_at as string).getTime()) / (86400 * 1000)
  ))

  const { data: comparison, error: insertError } = await supabase
    .from('photo_comparisons' as string)
    .insert({
      project_id: projectId,
      before_photo_id: beforePhotoId,
      after_photo_id: afterPhotoId,
      days_elapsed: daysElapsed,
      progress_detected: false,
    })
    .select('id')
    .single()

  if (insertError) throw new Error(`Failed to create comparison: ${insertError.message}`)
  return (comparison as Record<string, string>).id
}

export async function getPhotoComparisons(projectId: string) {
  const { data, error } = await supabase
    .from('photo_comparisons' as string)
    .select('*, before:before_photo_id(id, photo_url, taken_at, caption), after:after_photo_id(id, photo_url, taken_at, caption)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

export async function getPhotoPins(projectId: string) {
  const { data, error } = await supabase
    .from('photo_pins' as string)
    .select('*, associations:photo_pin_associations(ifc_element_id, is_primary)')
    .eq('project_id', projectId)
    .order('taken_at', { ascending: false })

  if (error) return []
  return data || []
}

export async function getProgressDetections(photoId: string) {
  const { data, error } = await supabase
    .from('progress_detection_results' as string)
    .select('*')
    .eq('photo_pin_id', photoId)

  if (error) return []
  return data || []
}
