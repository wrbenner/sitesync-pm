import { transformSupabaseError } from '../client'
import { fromTable } from '../../lib/db/queries'
import { assertProjectAccess } from '../middleware/projectScope'
import type { DrawingRow, FileRow, DrawingRevision, MappedDrawing, MappedFile } from '../../types/api'

// Kept in sync with src/pages/drawings/constants.ts — canonical palette lives there.
// This lookup accepts either canonical snake_case (stored in DB) or human-readable
// PascalCase (legacy data) so we don't lose rows inserted before normalization.
const DISCIPLINE_COLORS: Record<string, string> = {
  cover: '#8B5CF6',
  hazmat: '#CA8A04',
  demolition: '#78350F',
  survey: '#78716C',
  geotechnical: '#92400E',
  civil: '#10B981',
  landscape: '#166534',
  structural: '#E74C3C',
  architectural: '#3B82F6',
  interior: '#DB2777',
  fire_protection: '#E05252',
  plumbing: '#4EC896',
  mechanical: '#F47820',
  electrical: '#F5A623',
  telecommunications: '#06B6D4',
  // Legacy PascalCase keys (pre-normalization data)
  Architectural: '#3B82F6',
  Structural: '#E74C3C',
  Mechanical: '#F47820',
  Electrical: '#F5A623',
  Plumbing: '#4EC896',
  Civil: '#10B981',
  Landscape: '#166534',
}

const DISCIPLINE_ICONS: Record<string, string> = {
  cover: 'BookOpen',
  hazmat: 'AlertTriangle',
  demolition: 'Hammer',
  survey: 'Compass',
  geotechnical: 'Mountain',
  civil: 'Map',
  landscape: 'Leaf',
  structural: 'Triangle',
  architectural: 'Building2',
  interior: 'Sofa',
  fire_protection: 'Flame',
  plumbing: 'Droplets',
  mechanical: 'Wind',
  electrical: 'Zap',
  telecommunications: 'Wifi',
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

  const { data: drawingData, error: drawingError } = await fromTable('drawings')
    .select('*')
    .eq('project_id' as never, projectId)
    .order('sheet_number')
  if (drawingError) throw transformSupabaseError(drawingError)

  const drawings = drawingData || []
  if (drawings.length === 0) return []

  const drawingIds = drawings.map((d: DrawingRow) => d.id)

  // Fetch revisions — gracefully handle missing table so the page never crashes.
  let revisionData: DrawingRevision[] | null = null
  const { data: revData, error: revisionError } = await fromTable('drawing_revisions')
    .select('*')
    .in('drawing_id' as never, drawingIds)
    .order('revision_number', { ascending: false })
  if (revisionError) {
    // Log but don't crash — table may not exist yet (migration pending).
    console.warn('[getDrawings] drawing_revisions query failed:', revisionError.message)
  } else {
    revisionData = revData as unknown as DrawingRevision[] | null
  }

  // Group revisions by drawing_id (already sorted descending by revision_number)
  const revisionsByDrawing = new Map<string, DrawingRevision[]>()
  for (const rev of (revisionData || []) as unknown as DrawingRevision[]) {
    const list = revisionsByDrawing.get(rev.drawing_id) ?? []
    list.push(rev)
    revisionsByDrawing.set(rev.drawing_id, list)
  }

  // TODO: linked RFI counts require a migration to add drawing_id FK to rfis table.
  // Once added: SELECT drawing_id, count(*) FROM rfis WHERE drawing_id = ANY($1) GROUP BY drawing_id
  const rfiCountByDrawing = new Map<string, number>()

  // TODO: linked submittal counts require a migration to add drawing_id FK to submittals table.
  // Once added: SELECT drawing_id, count(*) FROM submittals WHERE drawing_id = ANY($1) GROUP BY drawing_id
  const submittalCountByDrawing = new Map<string, number>()

  // TODO: linked punch counts require a migration to add location_drawing_id FK to punch_items table.
  // Once added: SELECT location_drawing_id, count(*) FROM punch_items WHERE location_drawing_id = ANY($1) GROUP BY location_drawing_id
  const punchCountByDrawing = new Map<string, number>()

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
      sheetCount: (d as unknown as Record<string, unknown>).total_pages as number ?? 1,
      thumbnail_url: (d as unknown as Record<string, unknown>).thumbnail_url as string | null ?? null,
      file_url: d.file_url ?? null,
      processing_status: (d as unknown as Record<string, unknown>).processing_status as string ?? null,
      source_filename: (d as unknown as Record<string, unknown>).source_filename as string ?? null,
      total_pages: (d as unknown as Record<string, unknown>).total_pages as number ?? 1,
      revisions,
      currentRevision,
      linkedRfiCount: rfiCountByDrawing.get(d.id) ?? 0,
      linkedSubmittalCount: submittalCountByDrawing.get(d.id) ?? 0,
      linkedPunchCount: punchCountByDrawing.get(d.id) ?? 0,
    }
    return mapped
  })
}

export const getDrawingRevisionHistory = async (drawingId: string): Promise<DrawingRevision[]> => {
  const { data, error } = await fromTable('drawing_revisions')
    .select('*')
    .eq('drawing_id' as never, drawingId)
    .order('revision_number', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []) as unknown as DrawingRevision[]
}

export const getFiles = async (projectId: string): Promise<MappedFile[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('files').select('*').eq('project_id' as never, projectId).order('name')
  if (error) throw transformSupabaseError(error)
  const rows = (data || []) as unknown as FileRow[]

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
