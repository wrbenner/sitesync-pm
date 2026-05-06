import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Specifications ─────────────────────────────────────

export interface Specification {
  id: string
  project_id: string
  section_number: string
  title: string
  division: string | null
  revision: string | null
  status: string
  description: string | null
  file_url: string | null
  responsible_party: string | null
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useSpecifications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['specifications', projectId],
    queryFn: async (): Promise<Specification[]> => {
      const { data, error } = await from('specifications')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('section_number')
      if (error) throw error
      return data as unknown as Specification[]
    },
    enabled: !!projectId,
  })
}

export interface CreateSpecificationInput {
  project_id: string
  section_number: string
  title: string
  division?: string | null
  revision?: string | null
  status?: string
  description?: string | null
  file_url?: string | null
  responsible_party?: string | null
  notes?: string | null
  created_by?: string | null
}

export function useCreateSpecification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSpecificationInput) => {
      const { data, error } = await from('specifications')
        .insert(input as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Specification
    },
    onSuccess: (_data: unknown, variables: CreateSpecificationInput) => {
      queryClient.invalidateQueries({ queryKey: ['specifications', variables.project_id] })
    },
  })
}

export interface UpdateSpecificationInput {
  id: string
  projectId: string
  updates: Partial<Omit<Specification, 'id' | 'project_id' | 'created_at' | 'created_by'>>
}

export function useUpdateSpecification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: UpdateSpecificationInput) => {
      const { data, error } = await from('specifications')
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq('id' as never, id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Specification
    },
    onSuccess: (_data: unknown, variables: UpdateSpecificationInput) => {
      queryClient.invalidateQueries({ queryKey: ['specifications', variables.projectId] })
    },
  })
}

export function useDeleteSpecification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('specifications').delete().eq('id' as never, id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['specifications', variables.projectId] })
    },
  })
}
