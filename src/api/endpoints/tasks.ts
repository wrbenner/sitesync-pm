import { transformSupabaseError } from '../client'
import { fromTable } from '../../lib/db/queries'
import { validateProjectId } from '../middleware/projectScope'
import type { TaskRow } from '../../types/api'

export interface MappedTask {
  id: number
  uuid: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee: { name: string; initials: string; company: string }
  dueDate: string
  tags: string[]
  commentsCount: number
  attachmentsCount: number
  createdDate: string
  subtasks: { total: number; completed: number }
  linkedItems: Array<{ type: string; id: string }>
  is_critical_path: boolean
  assigned_to: string | null
  due_date: string | null
  start_date: string | null
  end_date: string | null
  sort_order: number | null
  project_id: string
  parent_task_id: string | null
  predecessor_ids: string[]
  successor_ids: string[]
  estimated_hours: number | null
  percent_complete: number
  phase: string | null
  dependency_type: string | null
  lag_days: number
  created_at: string | null
  updated_at: string | null
}

function mapTask(t: TaskRow): MappedTask {
  const name = t.assigned_to || 'Unassigned'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'NA'
  const predecessorIds = t.predecessor_ids || []
  const tags: string[] = []
  if (t.is_critical_path) tags.push('critical path')

  return {
    id: parseInt(t.id.replace(/\D/g, '').slice(0, 8) || '0', 10),
    uuid: t.id,
    title: t.title || '',
    description: t.description || '',
    status: (t.status as MappedTask['status']) || 'todo',
    priority: (t.priority as MappedTask['priority']) || 'medium',
    assignee: { name, initials, company: '' },
    dueDate: t.due_date || t.end_date || '',
    tags,
    commentsCount: 0,
    attachmentsCount: 0,
    createdDate: (t.created_at || '').slice(0, 10),
    subtasks: { total: 0, completed: 0 },
    linkedItems: [],
    is_critical_path: t.is_critical_path || false,
    assigned_to: t.assigned_to || null,
    due_date: t.due_date || null,
    start_date: t.start_date || null,
    end_date: t.end_date || null,
    sort_order: t.sort_order || null,
    project_id: t.project_id || '',
    parent_task_id: t.parent_task_id || null,
    predecessor_ids: predecessorIds,
    successor_ids: t.successor_ids || [],
    estimated_hours: t.estimated_hours || null,
    percent_complete: t.percent_complete || 0,
    phase: null,
    dependency_type: t.dependency_type || null,
    lag_days: t.lag_days || 0,
    created_at: t.created_at || null,
    updated_at: t.updated_at || null,
  }
}

export const getTasks = async (projectId: string): Promise<MappedTask[]> => {
  validateProjectId(projectId)
  const { data, error } = await fromTable('tasks').select('*').eq('project_id' as never, projectId).order('sort_order', { ascending: true })
  if (error) throw transformSupabaseError(error)
  return (data || []).map(mapTask)
}

export const getTaskById = async (projectId: string, id: string): Promise<MappedTask> => {
  validateProjectId(projectId)
  const { data, error } = await fromTable('tasks').select('*').eq('project_id' as never, projectId).eq('id' as never, id).single()
  if (error) throw transformSupabaseError(error)
  return mapTask(data)
}
