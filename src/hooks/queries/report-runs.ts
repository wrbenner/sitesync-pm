import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Report Runs ──────────────────────────────────────────

export function useReportRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: ['report_runs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_runs')
        .select('*')
        .eq('project_id', projectId!)
        .order('generated_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useReportTemplates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['report_templates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('project_id', projectId!)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useReportSchedules(projectId: string | undefined) {
  return useQuery({
    queryKey: ['report_schedules', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*, template:template_id(name, report_type, format)')
        .eq('project_id', projectId!)
        .order('next_run_at')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
