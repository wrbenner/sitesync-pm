import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  DirectoryContact,
} from '../../types/database'

// ── Directory Contacts ────────────────────────────────────

export function useDirectoryContacts(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['directory_contacts', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<DirectoryContact>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await fromTable('directory_contacts')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId!)
        .order('name', { ascending: true })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as unknown as DirectoryContact[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

// ── Companies ─────────────────────────────────────────────

export interface CompanyRow {
  id: string
  project_id: string
  name: string
  trade: string | null
  insurance_status: 'current' | 'expiring' | 'expired' | 'missing' | null
  insurance_expiry: string | null
}

export function useCompanies(projectId: string | undefined) {
  return useQuery({
    queryKey: ['companies', projectId],
    queryFn: async (): Promise<CompanyRow[]> => {
      const { data, error } = await fromTable('companies').select('id, project_id, name, trade, insurance_status, insurance_expiry')
        .eq('project_id' as never, projectId!)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as CompanyRow[]
    },
    enabled: !!projectId,
  })
}
