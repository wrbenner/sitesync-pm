import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { getCrews } from '../api/endpoints/people'
import { getCostData } from '../api/endpoints/budget'

type Tables = Database['public']['Tables']
type RFI = Tables['rfis']['Row']
type Submittal = Tables['submittals']['Row']
type ChangeOrder = Tables['change_orders']['Row']
type DailyLog = Tables['daily_logs']['Row']
type PunchItem = Tables['punch_items']['Row']
type SchedulePhase = Tables['schedule_phases']['Row']
type BudgetItem = Tables['budget_items']['Row']
type Crew = Tables['crews']['Row']
type Notification = Tables['notifications']['Row']
type ActivityFeed = Tables['activity_feed']['Row']
type AIConversation = Tables['ai_conversations']['Row']
type AIMessage = Tables['ai_messages']['Row']

const STALE_TIME = 30_000

// ── RFIs ──────────────────────────────────────────────────

export function useRFIs(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`rfis:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfis', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['rfis', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
      if (error) throw error
      return (data ?? []) as RFI[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Submittals ────────────────────────────────────────────

export function useSubmittals(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`submittals:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submittals', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['submittals', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['submittals', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submittals')
        .select('*')
        .eq('project_id', projectId)
      if (error) throw error
      return (data ?? []) as Submittal[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Punch List (punch_items) ───────────────────────────────

export function usePunchList(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`punch_items:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'punch_items', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['punch_items', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['punch_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punch_items')
        .select('*')
        .eq('project_id', projectId)
      if (error) throw error
      return (data ?? []) as PunchItem[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Daily Logs ────────────────────────────────────────────

export function useDailyLogs(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`daily_logs:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['daily_logs', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['daily_logs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as DailyLog[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Budget Items ──────────────────────────────────────────

export function useBudgetItems(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`budget_items:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_items', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['budget_items', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['budget_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
      if (error) throw error
      return (data ?? []) as BudgetItem[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Schedule Phases ───────────────────────────────────────

export function useSchedulePhases(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`schedule_phases:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_phases', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['schedule_phases', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['schedule_phases', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as SchedulePhase[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Change Orders ─────────────────────────────────────────

export function useChangeOrders(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`change_orders:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'change_orders', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['change_orders', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['change_orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*')
        .eq('project_id', projectId)
      if (error) throw error
      return (data ?? []) as ChangeOrder[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Crews ─────────────────────────────────────────────────

export function useCrews(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`crews:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crews', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['crews', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['crews', projectId],
    queryFn: () => getCrews(projectId),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── Notifications ─────────────────────────────────────────

export function useNotifications(userId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, queryClient])

  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  })
}

// ── useCreateMutation — generic optimistic insert + rollback ──

type KnownTable = keyof Tables

export function useCreateMutation<T extends KnownTable>(
  tableName: T,
  projectId: string
) {
  const queryClient = useQueryClient()
  const queryKey = [tableName, projectId] as const

  return useMutation({
    mutationFn: async (record: Tables[T]['Insert']) => {
      const { data, error } = await supabase
        .from(tableName as string)
        .insert([record])
        .select()
        .single()
      if (error) throw error
      return data as Tables[T]['Row']
    },
    onMutate: async (record) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: Tables[T]['Row'][] | undefined) => [
        ...(old ?? []),
        { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...record } as Tables[T]['Row'],
      ])
      return { previous }
    },
    onError: (_err, _record, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

// ── AI Copilot ────────────────────────────────────────────

export function useAICopilot(projectId: string) {
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error: err } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })

      if (err) throw err
      setConversations(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true)
      const { data, error: err } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (err) throw err
      setMessages(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createConversation = useCallback(
    async (title: string) => {
      try {
        setIsLoading(true)
        const { data, error: err } = await supabase
          .from('ai_conversations')
          .insert([{ project_id: projectId, title }])
          .select()
          .single()

        if (err) throw err
        setCurrentConversation(data)
        await loadConversations()
        return data
      } catch (err) {
        const newErr = err instanceof Error ? err : new Error(String(err))
        setError(newErr)
        throw newErr
      } finally {
        setIsLoading(false)
      }
    },
    [projectId, loadConversations],
  )

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      try {
        setIsLoading(true)
        const { data, error: err } = await supabase
          .from('ai_messages')
          .insert([{ conversation_id: conversationId, role: 'user', content }])
          .select()
          .single()

        if (err) throw err
        await loadMessages(conversationId)
        return data
      } catch (err) {
        const newErr = err instanceof Error ? err : new Error(String(err))
        setError(newErr)
        throw newErr
      } finally {
        setIsLoading(false)
      }
    },
    [loadMessages],
  )

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    messages,
    isLoading,
    error,
    loadConversations,
    loadMessages,
    createConversation,
    sendMessage,
  }
}

// ── Activity Feed ─────────────────────────────────────────

export function useActivityFeed(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`activity_feed:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_feed', filter: `project_id=eq.${projectId}` },
        () => queryClient.invalidateQueries({ queryKey: ['activity_feed', projectId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['activity_feed', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as ActivityFeed[]
    },
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

// ── getCostData wrapper ───────────────────────────────────

export function useCostData(projectId: string) {
  return useQuery({
    queryKey: ['cost_data', projectId],
    queryFn: () => getCostData(projectId),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}
