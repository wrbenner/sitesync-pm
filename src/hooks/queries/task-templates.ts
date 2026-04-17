import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import { getAiInsights } from '../../api/endpoints/ai'
import { getActivityFeed } from '../../api/endpoints/activity'
import type { ActivityFeedItem as EnrichedActivityFeedItem } from '../../types/entities'
import { getPortfolioMetrics } from '../../api/endpoints/organizations'
import { getPayApplication } from '../../api/endpoints/budget'
import { getPayApplications } from '../../api/endpoints/payApplications'
import { getLienWaivers } from '../../api/endpoints/lienWaivers'
import { getFiles as getFilesEnriched } from '../../api/endpoints/documents'
import type {
  Project,
  RFI,
  RFIResponse,
  Submittal,
  PunchItem,
  Task,
  Drawing,
  DailyLog,
  Crew,
  BudgetItem,
  ChangeOrder,
  Meeting,
  DirectoryContact,
  FieldCapture,
  SchedulePhase,
  Notification,
  AIInsight,
  ProjectSnapshot,
} from '../../types/database'

// ── Task Templates ───────────────────────────────────────

export function useTaskTemplates() {
  return useQuery({
    queryKey: ['task_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .order('phase', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useTaskCriticalPath(projectId: string | undefined) {
  return useQuery({
    queryKey: ['task_critical_path', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, end_date, predecessor_ids, estimated_hours')
        .eq('project_id', projectId!)
        .not('status', 'eq', 'done')
      if (error) throw error

      const { tasksToCPM, calculateCriticalPath } = await import('../../lib/criticalPath')
      const cpmTasks = tasksToCPM((data || []).map((t) => ({
        id: t.id,
        title: t.title,
        start_date: t.start_date,
        end_date: t.end_date,
        predecessor_ids: t.predecessor_ids,
        estimated_hours: t.estimated_hours,
      })))
      return calculateCriticalPath(cpmTasks)
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // CPM results are stable for 5 minutes
  })
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task_dependencies', taskId],
    queryFn: async () => {
      // Get the task's predecessor_ids
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('predecessor_ids, successor_ids')
        .eq('id', taskId!)
        .single()
      if (taskError) throw taskError

      const taskRecord = task as Record<string, unknown>
      const predecessorIds = (taskRecord.predecessor_ids as string[] | null) || []
      const successorIds = (taskRecord.successor_ids as string[] | null) || []

      let predecessors: Array<{ id: string; title: string; status: string; due_date: string | null }> = []
      let successors: Array<{ id: string; title: string; status: string; due_date: string | null }> = []

      if (predecessorIds.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, due_date')
          .in('id', predecessorIds)
        predecessors = data || []
      }

      if (successorIds.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, due_date')
          .in('id', successorIds)
        successors = data || []
      }

      return { predecessors, successors }
    },
    enabled: !!taskId,
  })
}
