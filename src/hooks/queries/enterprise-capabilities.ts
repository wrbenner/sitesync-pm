import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Cost Codes ────────────────────────────────────────────
export type CostCode = {
  id: string
  project_id: string
  code: string
  description: string
  budgeted_amount: number
  committed_amount: number
  actual_amount: number
  forecast_amount: number
  created_at: string
}

export function useCostCodes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['cost_codes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('project_id', projectId!)
        .order('code', { ascending: true })
      if (error) throw error
      return data as CostCode[]
    },
    enabled: !!projectId,
  })
}

export function useCreateCostCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<CostCode>) => {
      const { data, error } = await supabase.from('cost_codes').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cost_codes', (vars as { project_id?: string }).project_id] })
    },
  })
}

export type CostTransaction = {
  id: string
  project_id: string
  cost_code_id: string
  type: 'committed' | 'actual' | 'forecast'
  amount: number
  vendor: string | null
  description: string | null
  date: string
  reference: string | null
  created_by: string | null
  created_at: string
}

export function useCostTransactions(projectId: string | undefined, costCodeId?: string) {
  return useQuery({
    queryKey: ['cost_transactions', projectId, costCodeId ?? null],
    queryFn: async () => {
      let q = supabase.from('cost_transactions').select('*').eq('project_id', projectId!)
      if (costCodeId) q = q.eq('cost_code_id', costCodeId)
      const { data, error } = await q.order('date', { ascending: false })
      if (error) throw error
      return data as CostTransaction[]
    },
    enabled: !!projectId,
  })
}

export function useCreateCostTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<CostTransaction>) => {
      const { data, error } = await supabase.from('cost_transactions').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      const v = vars as { project_id?: string; cost_code_id?: string }
      qc.invalidateQueries({ queryKey: ['cost_transactions', v.project_id] })
      qc.invalidateQueries({ queryKey: ['cost_codes', v.project_id] })
    },
  })
}

// ── Time Entries ──────────────────────────────────────────
export type TimeEntry = {
  id: string
  workforce_member_id: string
  project_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  regular_hours: number
  overtime_hours: number
  double_time_hours: number
  break_minutes: number
  cost_code: string | null
  task_description: string | null
  approved: boolean
  approved_by: string | null
  geolocation_in: string | null
  geolocation_out: string | null
  created_at: string
  updated_at: string
}

export function useTimeEntries(projectId: string | undefined, weekStart?: string, weekEnd?: string) {
  return useQuery({
    queryKey: ['time_entries', projectId, weekStart ?? null, weekEnd ?? null],
    queryFn: async () => {
      let q = supabase.from('time_entries').select('*').eq('project_id', projectId!)
      if (weekStart) q = q.gte('date', weekStart)
      if (weekEnd) q = q.lte('date', weekEnd)
      const { data, error } = await q.order('date', { ascending: false })
      if (error) throw error
      return data as TimeEntry[]
    },
    enabled: !!projectId,
  })
}

export function useCreateTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<TimeEntry>) => {
      const { data, error } = await supabase.from('time_entries').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['time_entries', (vars as { project_id?: string }).project_id] })
    },
  })
}

export function useApproveTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approved_by, project_id: _project_id }: { id: string; approved_by: string; project_id: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update({ approved: true, approved_by })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['time_entries', vars.project_id] })
    },
  })
}

// ── Deliveries ────────────────────────────────────────────
export type Delivery = {
  id: string
  project_id: string
  vendor: string
  description: string | null
  expected_date: string
  actual_date: string | null
  status: 'scheduled' | 'in_transit' | 'delivered' | 'delayed' | 'cancelled'
  location: string | null
  po_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useDeliveries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['deliveries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('project_id', projectId!)
        .order('expected_date', { ascending: true })
      if (error) throw error
      return data as Delivery[]
    },
    enabled: !!projectId,
  })
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Delivery>) => {
      const { data, error } = await supabase.from('deliveries').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['deliveries', (vars as { project_id?: string }).project_id] })
    },
  })
}

export function useUpdateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Delivery> }) => {
      const { data, error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['deliveries', (data as { project_id?: string })?.project_id] })
    },
  })
}

// ── Wiki Pages ────────────────────────────────────────────
export type WikiPage = {
  id: string
  project_id: string
  title: string
  content: string
  parent_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export function useWikiPages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['wiki_pages', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wiki_pages')
        .select('*')
        .eq('project_id', projectId!)
        .order('title', { ascending: true })
      if (error) throw error
      return data as WikiPage[]
    },
    enabled: !!projectId,
  })
}

export function useCreateWikiPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<WikiPage>) => {
      const { data, error } = await supabase.from('wiki_pages').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['wiki_pages', (vars as { project_id?: string }).project_id] })
    },
  })
}

export function useUpdateWikiPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WikiPage> }) => {
      const { data, error } = await supabase
        .from('wiki_pages')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['wiki_pages', (data as { project_id?: string })?.project_id] })
    },
  })
}

export function useDeleteWikiPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, project_id: _project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('wiki_pages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['wiki_pages', vars.project_id] })
    },
  })
}
