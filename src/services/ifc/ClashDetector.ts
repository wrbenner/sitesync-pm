// Clash Detection: Finds intersecting BIM elements using bounding box overlap.
// For production, this should be enhanced with OBB trees or GJK algorithm.

import * as THREE from 'three'
import { supabase } from '../../lib/supabase'

// ── Types ────────────────────────────────────────────────

export interface ClashResult {
  element_a_id: number
  element_b_id: number
  clash_location: { x: number; y: number; z: number }
  clash_volume_cm3: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ── Detection ────────────────────────────────────────────

export function detectClashes(
  meshes: THREE.Mesh[],
  onProgress?: (checked: number, total: number) => void,
): ClashResult[] {
  const clashes: ClashResult[] = []
  const total = (meshes.length * (meshes.length - 1)) / 2
  let checked = 0

  // Pre-compute bounding boxes
  const boxes = meshes.map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh)
    return { mesh, box }
  })

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      checked++
      if (checked % 1000 === 0) onProgress?.(checked, total)

      const a = boxes[i]
      const b = boxes[j]

      // Skip elements in the same category (e.g., two walls touching is normal)
      if (a.mesh.userData.category === b.mesh.userData.category) continue

      if (!a.box.intersectsBox(b.box)) continue

      // Compute intersection volume
      const intersection = new THREE.Box3().copy(a.box).intersect(b.box)
      const size = intersection.getSize(new THREE.Vector3())
      const volumeM3 = size.x * size.y * size.z
      const volumeCm3 = volumeM3 * 1_000_000

      // Filter out tiny overlaps (tolerance)
      if (volumeCm3 < 1) continue

      const center = intersection.getCenter(new THREE.Vector3())

      clashes.push({
        element_a_id: a.mesh.userData.expressId ?? 0,
        element_b_id: b.mesh.userData.expressId ?? 0,
        clash_location: { x: center.x, y: center.y, z: center.z },
        clash_volume_cm3: Math.round(volumeCm3 * 100) / 100,
        severity: volumeCm3 > 10000 ? 'critical' : volumeCm3 > 1000 ? 'high' : volumeCm3 > 100 ? 'medium' : 'low',
      })
    }
  }

  return clashes
}

// ── Persistence ──────────────────────────────────────────

export async function saveClashReport(
  projectId: string,
  clash: ClashResult,
  title: string,
  description?: string,
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { data, error } = await supabase
    .from('bim_clash_reports' as string)
    .insert({
      project_id: projectId,
      created_by: userId,
      title,
      description: description ?? null,
      element_a_id: clash.element_a_id,
      element_b_id: clash.element_b_id,
      clash_location: clash.clash_location,
      clash_volume_cm3: clash.clash_volume_cm3,
      severity: clash.severity,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save clash: ${error.message}`)
  return (data as Record<string, string>).id
}

export async function getClashReports(projectId: string) {
  const { data, error } = await supabase
    .from('bim_clash_reports' as string)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

export async function resolveClash(clashId: string, resolution: string): Promise<void> {
  const { error } = await supabase
    .from('bim_clash_reports' as string)
    .update({
      status: 'resolved',
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', clashId)

  if (error) throw new Error(`Failed to resolve clash: ${error.message}`)
}
