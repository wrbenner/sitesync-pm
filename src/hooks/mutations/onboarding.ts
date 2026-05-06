import { useMutation } from '@tanstack/react-query'
import { projectService, type CreateProjectInput } from '../../services/projectService'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export type OnboardingProjectInput = {
  name: string
  project_type?: string
  total_value?: number
  address?: string
  start_date?: string
  scheduled_end_date?: string
  organization_id?: string
}

export function useCreateOnboardingProject() {
  return useMutation({
    mutationFn: async (input: OnboardingProjectInput) => {
      const payload: CreateProjectInput = {
        name: input.name.trim(),
        organization_id: input.organization_id,
        address: input.address?.trim() || undefined,
        project_type: input.project_type?.trim() || undefined,
        total_value: input.total_value,
        start_date: input.start_date || undefined,
        scheduled_end_date: input.scheduled_end_date || undefined,
      }
      const { data, error } = await projectService.createProject(payload)
      if (error) throw new Error(error.userMessage || 'Failed to create project')
      if (!data) throw new Error('Project creation returned no data')
      return data
    },
  })
}

export type InviteTeamInput = {
  emails: string[]
  organization_id: string
  project_id: string
  organization_name?: string
  role?: 'owner' | 'admin' | 'pm' | 'editor' | 'viewer'
}

export type MarkOnboardingInput = {
  user_id: string
  dashboard_widgets?: string[]
}

export function useMarkOnboardingComplete() {
  return useMutation({
    mutationFn: async (input: MarkOnboardingInput) => {
      const now = new Date().toISOString()
      const prefs = input.dashboard_widgets
        ? { widgets: input.dashboard_widgets }
        : {}

      const { data, error } = await fromTable('profiles')
        .update({
          onboarded_at: now,
          dashboard_preferences: prefs,
          updated_at: now,
        } as never)
        .eq('user_id' as never, input.user_id)
        .select('id, onboarded_at, dashboard_preferences')
        .single()

      if (error) throw error
      return data
    },
  })
}

export function useInviteOnboardingTeam() {
  return useMutation({
    mutationFn: async (input: InviteTeamInput) => {
      const cleanEmails = input.emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes('@'))

      if (cleanEmails.length === 0) {
        return { results: [], skipped: true as const }
      }

      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: {
          action: 'invite',
          emails: cleanEmails,
          role: input.role ?? 'editor',
          organization_id: input.organization_id,
          organization_name: input.organization_name,
          project_ids: [input.project_id],
        },
      })
      if (error) throw error

      const results = (data?.results ?? []) as Array<{
        email: string
        status: string
        invite_id?: string
        error?: string
      }>
      return { results, skipped: false as const }
    },
  })
}
