// Phase 3 — submittal_saved_views service.
//
// CRUD against the migration's table. Result<> shape per project errors.ts.
// view_state shape is intentionally permissive (Record<string, unknown>) —
// the UI owns the schema; service is just the persistence boundary.

import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import { type Result, ok, fail, dbError } from './errors'

export type SavedViewScope = 'my' | 'project' | 'company' | 'iris'

export interface SavedViewState {
  filters?: Record<string, unknown>
  columns?: Array<{ id: string; hidden?: boolean; pin?: 'left' | 'right' | null; width?: number }>
  sort?: { columnId: string; direction: 'asc' | 'desc' } | null
  viewType?:
    | 'items' | 'packages' | 'spec_sections' | 'ball_in_court'
    | 'kanban' | 'timeline' | 'schedule' | 'recycle_bin'
  grouping?: 'none' | 'csi_section' | 'sub' | 'reviewer'
}

export interface SavedView {
  id: string
  project_id: string
  scope: SavedViewScope
  owner_user_id: string | null
  name: string
  description: string | null
  view_state: SavedViewState
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateSavedViewInput {
  project_id: string
  scope: SavedViewScope
  name: string
  description?: string
  view_state: SavedViewState
  is_default?: boolean
}

export const submittalsSavedViewsService = {
  async list(projectId: string): Promise<Result<SavedView[]>> {
    const { data, error } = await fromTable('submittal_saved_views' as never)
      .select('*')
      .eq('project_id' as never, projectId)
      .order('scope', { ascending: true })
      .order('name', { ascending: true })
    if (error) return fail(dbError(error.message, { projectId }))
    return ok(((data as unknown) as SavedView[]) ?? [])
  },

  async create(input: CreateSavedViewInput): Promise<Result<SavedView>> {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id ?? null

    const row = {
      project_id: input.project_id,
      scope: input.scope,
      owner_user_id: input.scope === 'my' ? userId : null,
      name: input.name,
      description: input.description ?? null,
      view_state: input.view_state,
      is_default: input.is_default ?? false,
      created_by: userId,
    }

    const { data, error } = await fromTable('submittal_saved_views' as never)
      .insert(row as never)
      .select()
      .single()
    if (error) return fail(dbError(error.message, { projectId: input.project_id }))
    return ok((data as unknown) as SavedView)
  },

  async update(id: string, patch: Partial<Pick<SavedView, 'name' | 'description' | 'view_state' | 'is_default'>>): Promise<Result> {
    const { error } = await fromTable('submittal_saved_views' as never)
      .update(patch as never)
      .eq('id' as never, id)
    if (error) return fail(dbError(error.message, { id }))
    return { data: null, error: null }
  },

  async remove(id: string): Promise<Result> {
    const { error } = await fromTable('submittal_saved_views' as never)
      .delete()
      .eq('id' as never, id)
    if (error) return fail(dbError(error.message, { id }))
    return { data: null, error: null }
  },

  /**
   * Calls the seed RPC for the project. Idempotent — no-ops if iris views
   * already exist for the project. Returns the count seeded.
   */
  async seedIrisSuggested(projectId: string): Promise<Result<number>> {
    const { data, error } = await supabase.rpc(
      'seed_iris_suggested_submittal_views' as never,
      { p_project_id: projectId } as never,
    )
    if (error) return fail(dbError(error.message, { projectId }))
    return ok((data as unknown as number) ?? 0)
  },
}
