import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../../lib/supabase'

type SearchRow = { id: string; project_id: string; created_at: string; [key: string]: unknown }

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
        const { data } = await fromTable('documents')
          .select('id, name, description, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'document' as const,
              title: d.name as string,
              description: d.description as string | null,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      if (searchTypes.includes('file')) {
        const { data } = await fromTable('files')
          .select('id, name, description, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'file' as const,
              title: d.name as string,
              description: d.description as string | null,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      if (searchTypes.includes('drawing')) {
        const { data } = await fromTable('drawings')
          .select('id, title, discipline, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'drawing' as const,
              title: d.title as string,
              description: d.discipline as string | null,
              project_id: d.project_id,
              relevance: 1,
              created_at: d.created_at,
            }))
          )
        }
      }

      if (searchTypes.includes('wiki')) {
        const { data } = await fromTable('wiki_pages')
          .select('id, title, project_id, created_at')
          .eq('project_id', projectId!)
          .textSearch('search_vector', tsQuery)
          .limit(limit)
        if (data) {
          results.push(
            ...(data as SearchRow[]).map((d) => ({
              id: d.id,
              type: 'wiki' as const,
              title: d.title as string,
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
