// Phase 4 — Submittal Package CRUD service.
//
// Backed by the RPCs in 20260509000000_submittal_phase4_packages_specs.sql.
// Each RPC is SECURITY DEFINER + project-membership-gated, so the service is
// a thin wrapper that surfaces typed errors via the shared Result helpers.
//
// The list/get readers go through `submittal_packages` directly (RLS allows
// project members to read). Mutations always go through RPCs so the
// business-rule guards live in one place.

import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import { type Result, ok, fail, dbError } from './errors'

export interface SubmittalPackage {
  id: string
  project_id: string
  number: number
  title: string
  description: string | null
  responsible_sub_id: string | null
  csi_section: string | null
  status: string
  distribution_list: unknown
  created_at: string
  created_by: string | null
}

export const submittalPackagesService = {
  async list(projectId: string): Promise<Result<SubmittalPackage[]>> {
    const { data, error } = await fromTable('submittal_packages' as never)
      .select('*')
      .eq('project_id' as never, projectId)
      .order('number', { ascending: true })

    if (error) return fail(dbError(error.message, { projectId }))
    return ok(((data as unknown) as SubmittalPackage[]) ?? [])
  },

  async get(packageId: string): Promise<Result<SubmittalPackage | null>> {
    const { data, error } = await fromTable('submittal_packages' as never)
      .select('*')
      .eq('id' as never, packageId)
      .maybeSingle()

    if (error) return fail(dbError(error.message, { packageId }))
    return ok((data as unknown) as SubmittalPackage | null)
  },

  async create(input: {
    projectId: string
    title: string
    description?: string | null
    responsibleSubId?: string | null
    csiSection?: string | null
    submittalIds?: string[]
  }): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('submittal_create_package' as never, {
      p_project_id: input.projectId,
      p_title: input.title,
      p_description: input.description ?? null,
      p_responsible_sub_id: input.responsibleSubId ?? null,
      p_csi_section: input.csiSection ?? null,
      p_submittal_ids: input.submittalIds ?? [],
    } as never)

    if (error) return fail(dbError(error.message, { projectId: input.projectId }))
    return ok((data as unknown as string) ?? '')
  },

  async update(input: {
    id: string
    title: string
    description?: string | null
    responsibleSubId?: string | null
    csiSection?: string | null
  }): Promise<Result<void>> {
    const { error } = await supabase.rpc('submittal_update_package' as never, {
      p_id: input.id,
      p_title: input.title,
      p_description: input.description ?? null,
      p_responsible_sub_id: input.responsibleSubId ?? null,
      p_csi_section: input.csiSection ?? null,
    } as never)

    if (error) return fail(dbError(error.message, { id: input.id }))
    return ok(undefined)
  },

  async setMembers(packageId: string, submittalIds: string[]): Promise<Result<void>> {
    const { error } = await supabase.rpc('submittal_set_package_members' as never, {
      p_package_id: packageId,
      p_submittal_ids: submittalIds,
    } as never)

    if (error) return fail(dbError(error.message, { packageId }))
    return ok(undefined)
  },

  async remove(packageId: string): Promise<Result<void>> {
    const { error } = await supabase.rpc('submittal_delete_package' as never, {
      p_id: packageId,
    } as never)

    if (error) return fail(dbError(error.message, { packageId }))
    return ok(undefined)
  },
}
