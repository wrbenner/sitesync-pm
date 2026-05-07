// ── useSpecBook ─────────────────────────────────────────────────────────
// Read + bulk-import for project_spec_book (Phase 2.2).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'
import type { SpecBookRow } from '../../lib/rfi/specBookCsv'

const from = (table: string) => fromTable(table as never)

export interface SpecBookEntry {
  id: string
  project_id: string
  section_code: string
  section_title: string
  division: string | null
  responsible_party: string | null
  responsible_user_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const QK = (projectId: string | undefined) => ['spec_book', projectId ?? '__none__']

export function useSpecBook(projectId: string | undefined) {
  return useQuery({
    queryKey: QK(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async (): Promise<SpecBookEntry[]> => {
      if (!projectId) return []
      const { data } = await from('project_spec_book')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('section_code' as never, { ascending: true })
      return (data ?? []) as unknown as SpecBookEntry[]
    },
  })
}

export function useImportSpecBookRows() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; rows: SpecBookRow[] }) => {
      if (params.rows.length === 0) return { inserted: 0, skipped: 0 }
      const { data: { user } } = await supabase.auth.getUser()
      // Upsert by (project_id, section_code) — reruns are safe.
      const payload = params.rows.map((r) => ({
        project_id: params.projectId,
        section_code: r.section_code,
        section_title: r.section_title,
        division: r.division,
        responsible_party: r.responsible_party,
        notes: r.notes,
        created_by: user?.id ?? null,
      }))
      const { error } = await from('project_spec_book').upsert(payload as never, { onConflict: 'project_id,section_code' })
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'project',
        entityId: params.projectId,
        action: 'update',
        afterState: { spec_book_imported: params.rows.length },
        metadata: { kind: 'rfi_spec_book_import' },
      })
      return { inserted: params.rows.length, skipped: 0 }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.projectId) })
      qc.invalidateQueries({ queryKey: ['rfi_spec_book_options', vars.projectId] })
    },
  })
}
