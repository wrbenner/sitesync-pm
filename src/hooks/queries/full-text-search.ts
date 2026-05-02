import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

type SearchRow = { id: string; name?: string | null; title?: string | null; description?: string | null; discipline?: string | null; project_id: string; created_at: string | null }

type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Full-Text Search ────────────────────────────────────────

export interface SearchResult {
  id: string
  type: 'document' | 'file' | 'drawing' | 'wiki'
  title: string
  description: string | null
  project_id: string
  relevance: number
  created_at: string
}

export function useFullTextSearch(
  projectId: string | undefined,
  query: string,
  options?: { types?: ('document' | 'file' | 'drawing' | 'wiki')[]; limit?: number }
) {
  const searchTypes = options?.types || ['document', 'file', 'drawing', 'wiki']
  const limit = options?.limit || 50

  return useQuery({
    queryKey: ['full_text_search', projectId, query, searchTypes],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query.trim()) return []
      const tsQuery = query.trim().split(/\s+/).join(' & ')
      const results: SearchResult[] = []

      if (searchTypes.includes('document')) {
        const { data } = await from('documents')
          .select('id, name, description, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'document' as const,
              title: d.name,
              description: d.description,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      if (searchTypes.includes('file')) {
        const { data } = await from('files')
          .select('id, name, description, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'file' as const,
              title: d.name,
              description: d.description,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      if (searchTypes.includes('drawing')) {
        const { data } = await from('drawings')
          .select('id, title, discipline, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'drawing' as const,
              title: d.title,
              description: d.discipline,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      if (searchTypes.includes('wiki')) {
        const { data } = await from('wiki_pages')
          .select('id, title, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'wiki' as const,
              title: d.title,
              description: null,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      return results.slice(0, limit)
    },
    enabled: !!projectId && query.trim().length >= 2,
    staleTime: 30_000,
  })
}
