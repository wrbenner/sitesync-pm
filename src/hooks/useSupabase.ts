import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { UserRole } from '../types/database'

type Tables = Database['public']['Tables']
type RFI = Tables['rfis']['Row']
type RFIInsert = Tables['rfis']['Insert']
type RFIUpdate = Tables['rfis']['Update']
type Submittal = Tables['submittals']['Row']
type SubmittalInsert = Tables['submittals']['Insert']
type SubmittalUpdate = Tables['submittals']['Update']
type ChangeOrder = Tables['change_orders']['Row']
type ChangeOrderInsert = Tables['change_orders']['Insert']
type ChangeOrderUpdate = Tables['change_orders']['Update']
type DailyLog = Tables['daily_logs']['Row']
type DailyLogInsert = Tables['daily_logs']['Insert']
type DailyLogUpdate = Tables['daily_logs']['Update']
type PunchListItem = Tables['punch_list_items']['Row']
type PunchListItemInsert = Tables['punch_list_items']['Insert']
type PunchListItemUpdate = Tables['punch_list_items']['Update']
type ScheduleActivity = Tables['schedule_activities']['Row']
type ScheduleActivityInsert = Tables['schedule_activities']['Insert']
type ScheduleActivityUpdate = Tables['schedule_activities']['Update']
type BudgetLineItem = Tables['budget_line_items']['Row']
type BudgetLineItemInsert = Tables['budget_line_items']['Insert']
type BudgetLineItemUpdate = Tables['budget_line_items']['Update']
type Crew = Tables['crews']['Row']
type CrewInsert = Tables['crews']['Insert']
type CrewUpdate = Tables['crews']['Update']
type Notification = Tables['notifications']['Row']
type ActivityFeed = Tables['activity_feed']['Row']
type AIConversation = Tables['ai_conversations']['Row']
type AIMessage = Tables['ai_messages']['Row']

// Generic state type
interface UseDataState<T> {
  data: T[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

interface UseDataOptions {
  limit?: number
  orderBy?: { column: string; ascending?: boolean }
  filters?: Record<string, unknown>
}

/**
 * Hook for fetching and managing RFIs for a project
 */
export function useRFIs(projectId: string, options?: UseDataOptions) {
  const [state, setState] = useState<UseDataState<RFI>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      let query = supabase.from('rfis').select('*').eq('project_id', projectId)

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending !== false,
        })
      }

      const { data, error } = await query

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId, options])

  useEffect(() => {
    refetch()

    // Set up real-time subscription
    const subscription = supabase
      .from('rfis')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (rfi: RFIInsert) => {
      const { data, error } = await supabase.from('rfis').insert([rfi]).select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: RFIUpdate) => {
    const { data, error } = await supabase
      .from('rfis')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('rfis').delete().eq('id', id)
    if (error) throw error
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
    remove,
  }
}

/**
 * Hook for fetching and managing Submittals for a project
 */
export function useSubmittals(projectId: string, options?: UseDataOptions) {
  const [state, setState] = useState<UseDataState<Submittal>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      let query = supabase.from('submittals').select('*').eq('project_id', projectId)

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending !== false,
        })
      }

      const { data, error } = await query

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId, options])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('submittals')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (submittal: SubmittalInsert) => {
      const { data, error } = await supabase
        .from('submittals')
        .insert([submittal])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: SubmittalUpdate) => {
    const { data, error } = await supabase
      .from('submittals')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('submittals').delete().eq('id', id)
    if (error) throw error
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
    remove,
  }
}

/**
 * Hook for fetching and managing Change Orders for a project
 */
export function useChangeOrders(projectId: string, options?: UseDataOptions) {
  const [state, setState] = useState<UseDataState<ChangeOrder>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      let query = supabase
        .from('change_orders')
        .select('*')
        .eq('project_id', projectId)

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending !== false,
        })
      }

      const { data, error } = await query

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId, options])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('change_orders')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (co: ChangeOrderInsert) => {
      const { data, error } = await supabase
        .from('change_orders')
        .insert([co])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: ChangeOrderUpdate) => {
    const { data, error } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('change_orders').delete().eq('id', id)
    if (error) throw error
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
    remove,
  }
}

/**
 * Hook for fetching and managing Daily Logs for a project
 */
export function useDailyLogs(projectId: string, options?: UseDataOptions) {
  const [state, setState] = useState<UseDataState<DailyLog>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      let query = supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending !== false,
        })
      }

      const { data, error } = await query

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId, options])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('daily_logs')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (log: DailyLogInsert) => {
      const { data, error } = await supabase
        .from('daily_logs')
        .insert([log])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: DailyLogUpdate) => {
    const { data, error } = await supabase
      .from('daily_logs')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('daily_logs').delete().eq('id', id)
    if (error) throw error
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
    remove,
  }
}

/**
 * Hook for fetching and managing Punch List Items for a project
 */
export function usePunchList(projectId: string, options?: UseDataOptions) {
  const [state, setState] = useState<UseDataState<PunchListItem>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      let query = supabase
        .from('punch_list_items')
        .select('*')
        .eq('project_id', projectId)

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending !== false,
        })
      }

      const { data, error } = await query

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId, options])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('punch_list_items')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (item: PunchListItemInsert) => {
      const { data, error } = await supabase
        .from('punch_list_items')
        .insert([item])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: PunchListItemUpdate) => {
    const { data, error } = await supabase
      .from('punch_list_items')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('punch_list_items')
      .delete()
      .eq('id', id)
    if (error) throw error
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
    remove,
  }
}

/**
 * Hook for fetching and managing Schedule Activities for a project
 */
export function useSchedule(projectId: string) {
  const [state, setState] = useState<UseDataState<ScheduleActivity>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      const { data, error } = await supabase
        .from('schedule_activities')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('schedule_activities')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (activity: ScheduleActivityInsert) => {
      const { data, error } = await supabase
        .from('schedule_activities')
        .insert([activity])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: ScheduleActivityUpdate) => {
    const { data, error } = await supabase
      .from('schedule_activities')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('schedule_activities')
      .delete()
      .eq('id', id)
    if (error) throw error
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
    remove,
  }
}

/**
 * Hook for fetching and managing Budget Line Items for a project
 */
export function useBudget(projectId: string) {
  const [state, setState] = useState<UseDataState<BudgetLineItem>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      const { data, error } = await supabase
        .from('budget_line_items')
        .select('*')
        .eq('project_id', projectId)
        .order('cost_code', { ascending: true })

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('budget_line_items')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (item: BudgetLineItemInsert) => {
      const { data, error } = await supabase
        .from('budget_line_items')
        .insert([item])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: BudgetLineItemUpdate) => {
    const { data, error } = await supabase
      .from('budget_line_items')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
  }
}

/**
 * Hook for fetching and managing Crews for a project
 */
export function useCrews(projectId: string) {
  const [state, setState] = useState<UseDataState<Crew>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('project_id', projectId)
        .order('trade', { ascending: true })

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('crews')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  const create = useCallback(
    async (crew: CrewInsert) => {
      const { data, error } = await supabase
        .from('crews')
        .insert([crew])
        .select()
      if (error) throw error
      return data?.[0]
    },
    [],
  )

  const update = useCallback(async (id: string, updates: CrewUpdate) => {
    const { data, error } = await supabase
      .from('crews')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }, [])

  return {
    ...state,
    refetch,
    create,
    update,
  }
}

/**
 * Hook for fetching user notifications
 */
export function useNotifications() {
  const [state, setState] = useState<UseDataState<Notification>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const [unreadCount, setUnreadCount] = useState(0)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
      setUnreadCount((data || []).filter(n => !n.is_read).length)
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('notifications')
      .on('*', () => {
        refetch()
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [refetch])

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    await refetch()
  }, [refetch])

  const markAllAsRead = useCallback(async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false)

    if (error) throw error
    await refetch()
  }, [refetch])

  return {
    ...state,
    refetch,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }
}

/**
 * Hook for fetching project activity feed
 */
export function useActivityFeed(projectId: string) {
  const [state, setState] = useState<UseDataState<ActivityFeed>>({
    data: [],
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setState(prev => ({
        ...prev,
        data: data || [],
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error(String(err)),
        isLoading: false,
      }))
    }
  }, [projectId])

  useEffect(() => {
    refetch()

    const subscription = supabase
      .from('activity_feed')
      .on('*', payload => {
        if (payload.new.project_id === projectId) {
          refetch()
        }
      })
      .subscribe()

    unsubscribeRef.current = () => {
      subscription.unsubscribe()
    }

    return () => {
      unsubscribeRef.current?.()
    }
  }, [projectId, refetch])

  return {
    ...state,
    refetch,
  }
}

/**
 * Hook for AI Copilot conversations
 */
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
          .insert([
            {
              conversation_id: conversationId,
              role: 'user',
              content,
            },
          ])
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
