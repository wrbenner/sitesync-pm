import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess, assertProjectBelongsToOrg } from '../middleware/projectScope'
import { ApiError } from '../errors'
import { useOrganizationStore } from '../../stores/organizationStore'
import type { DrawingRow, FileRow, DrawingRevision, MappedDrawing, MappedFile } from '../../types/api'

const DISCIPLINE_COLORS: Record<string, string> = {
  Architectural: '#3B82F6',
  Structural: '#E74C3C',
  Mechanical: '#F47820',
  Electrical: '#F5A623',
  Plumbing: '#4EC896',
  Civil: '#8B5CF6',
  Landscape: '#10B981',
}

const DISCIPLINE_ICONS: Record<string, string> = {
  Architectural: 'Building2',
  Structural: 'Triangle',
  Mechanical: 'Wind',
  Electrical: 'Zap',
  Plumbing: 'Droplets',
  Civil: 'Map',
  Landscape: 'Leaf',
}

export function getDisciplineColor(discipline: string): string {
  return DISCIPLINE_COLORS[discipline] ?? '#6B7280'
}

function getDisciplineIcon(discipline: string): string {
  return DISCIPLINE_ICONS[discipline] ?? 'FileText'
}

export const getDrawings = async (projectId: string): Promise<MappedDrawing[]> => {
  await assertProjectAccess(projectId)
  const orgId = useOrganizationStore.getState().currentOrg?.id
  if (!orgId) {
    throw new ApiError('No active organization context', 403, 'FORBIDDEN')
  }
  await assertProjectBelongsToOrg(projectId, orgId)

  const { data: drawingData, error: drawingError } = await supabase
    .from('drawings')
    .select('*')
    .eq('project_id', projectId)
    .order('sheet_number')
  if (drawingError) throw transformSupabaseError(drawingError)

  const drawings = drawingData || []
  if (drawings.length === 0) return []

  const drawingIds = drawings.map((d: DrawingRow) => d.id)
  const { data: revisionData, error: revisionError } = await supabase
    .from('drawing_revisions')
    .select('id, drawing_id, revision_number, issued_date, issued_by, change_description, file_url, superseded_at')
    .in('drawing_id', drawingIds)
    .order('revision_number', { ascending: false })
  if (revisionError) throw transformSupabaseError(revisionError)

  // Group revisions by drawing_id (already sorted descending by revision_number)
  const revisionsByDrawing = new Map<string, DrawingRevision[]>()
  for (const rev of (revisionData || []) as DrawingRevision[]) {
    const list = revisionsByDrawing.get(rev.drawing_id) ?? []
    list.push(rev)
    revisionsByDrawing.set(rev.drawing_id, list)
  }

  return drawings.map((d: DrawingRow): MappedDrawing => {
    const revisions = revisionsByDrawing.get(d.id) ?? []
    // Latest non-superseded entry is current; list is already sorted desc
    const currentRevision = revisions.find((r) => !r.superseded_at) ?? null
    const mapped: MappedDrawing = {
      ...d,
      setNumber: d.sheet_number ?? d.id.slice(0, 6),
      disciplineColor: getDisciplineColor(d.discipline ?? ''),
      disciplineLabel: d.discipline ?? '',
      disciplineIcon: getDisciplineIcon(d.discipline ?? ''),
      date: d.created_at?.slice(0, 10) ?? '',
      sheetCount: 1,
      revisions,
      currentRevision,
    }
    return mapped
  })
}

export const getDrawingRevisionHistory = async (drawingId: string): Promise<DrawingRevision[]> => {
  const { data, error } = await supabase
    .from('drawing_revisions')
    .select('id, drawing_id, revision_number, issued_date, issued_by, change_description, file_url, superseded_at')
    .eq('drawing_id', drawingId)
    .order('revision_number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []) as DrawingRevision[]
}

export const getFiles = async (projectId: string): Promise<MappedFile[]> => {
  await assertProjectAccess(projectId)
  const orgId = useOrganizationStore.getState().currentOrg?.id
  if (!orgId) {
    throw new ApiError('No active organization context', 403, 'FORBIDDEN')
  }
  await assertProjectBelongsToOrg(projectId, orgId)
  const { data, error } = await supabase.from('files').select('*').eq('project_id', projectId).order('name')
  if (error) throw transformSupabaseError(error)
  const rows = (data || []) as FileRow[]

  const isFolderRow = (f: FileRow): boolean => !!(f.content_type?.includes('folder') ?? false) || !!f.folder

  // O(n): build children lookup keyed by parent_folder_id
  const childrenByFolder = new Map<string, FileRow[]>()
  for (const f of rows) {
    if (f.parent_folder_id) {
      const list = childrenByFolder.get(f.parent_folder_id) ?? []
      list.push(f)
      childrenByFolder.set(f.parent_folder_id, list)
    }
  }

  // O(n): direct-child count map keyed by folder id
  const itemCountMap = new Map<string, number>()
  for (const [folderId, children] of childrenByFolder) {
    itemCountMap.set(folderId, children.length)
  }

  // Memoized recursive total size of all descendants (O(n) total with cache)
  const totalSizeCache = new Map<string, number>()
  const computeTotalSize = (folderId: string): number => {
    if (totalSizeCache.has(folderId)) return totalSizeCache.get(folderId)!
    const size = (childrenByFolder.get(folderId) ?? []).reduce(
      (sum, child) => sum + (isFolderRow(child) ? computeTotalSize(child.id) : (child.file_size ?? 0)),
      0,
    )
    totalSizeCache.set(folderId, size)
    return size
  }

  // Memoized recursive most recent child created_at (O(n) total with cache)
  const lastModifiedCache = new Map<string, string>()
  const computeLastModified = (folderId: string): string => {
    if (lastModifiedCache.has(folderId)) return lastModifiedCache.get(folderId)!
    const latest = (childrenByFolder.get(folderId) ?? []).reduce((max, child) => {
      const date = isFolderRow(child) ? computeLastModified(child.id) : (child.created_at ?? '')
      return date > max ? date : max
    }, '')
    lastModifiedCache.set(folderId, latest)
    return latest
  }

  return rows.map((f: FileRow): MappedFile => {
    const folder = isFolderRow(f)
    const mapped: MappedFile = {
      ...f,
      type: folder ? 'folder' : 'file',
      size: f.file_size != null ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : '',
      modifiedDate: f.created_at?.slice(0, 10) ?? '',
      itemCount: folder ? (itemCountMap.get(f.id) ?? 0) : 0,
      totalSize: folder ? computeTotalSize(f.id) : 0,
      lastModified: folder ? (computeLastModified(f.id) || undefined) : undefined,
    }
    return mapped
  })
}
