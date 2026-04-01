import { ValidationError } from '../errors'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

type TableName = keyof Database['public']['Tables']

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateProjectId(projectId: string): void {
  if (!projectId || !UUID_V4_RE.test(projectId)) {
    throw new ValidationError('Invalid project ID', { projectId: 'Must be a valid UUID v4' })
  }
}

export function createProjectScopedQuery(table: TableName, projectId: string) {
  validateProjectId(projectId)
  return supabase.from(table as any).eq('project_id', projectId)
}
