import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

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

function mapTask(t: Record<string, unknown>): MappedTask {
  const name = (t.assigned_to as string) || 'Unassigned'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'NA'
  const predecessorIds = (t.predecessor_ids as string[]) || []
  const tags: string[] = []
  if (t.is_critical_path) tags.push('critical path')
  if (t.phase) tags.push(t.phase as string)

  return {
    id: typeof t.id === 'number' ? t.id : parseInt(String(t.id).replace(/\D/g, '').slice(0, 8) || '0', 10),
    uuid: String(t.id || ''),
    title: (t.title as string) || '',
    description: (t.description as string) || '',
    status: (t.status as MappedTask['status']) || 'todo',
    priority: (t.priority as MappedTask['priority']) || 'medium',
    assignee: { name, initials, company: '' },
    dueDate: (t.due_date as string) || (t.end_date as string) || '',
    tags,
    commentsCount: 0,
    attachmentsCount: 0,
    createdDate: ((t.created_at as string) || '').slice(0, 10),
    subtasks: { total: 0, completed: 0 },
    linkedItems: [],
    is_critical_path: (t.is_critical_path as boolean) || false,
    assigned_to: (t.assigned_to as string) || null,
    due_date: (t.due_date as string) || null,
    start_date: (t.start_date as string) || null,
    end_date: (t.end_date as string) || null,
    sort_order: (t.sort_order as number) || null,
    project_id: (t.project_id as string) || PID,
    parent_task_id: (t.parent_task_id as string) || null,
    predecessor_ids: predecessorIds,
    successor_ids: (t.successor_ids as string[]) || [],
    estimated_hours: (t.estimated_hours as number) || null,
    percent_complete: (t.percent_complete as number) || 0,
    phase: (t.phase as string) || null,
    dependency_type: (t.dependency_type as string) || null,
    lag_days: (t.lag_days as number) || 0,
    created_at: (t.created_at as string) || null,
    updated_at: (t.updated_at as string) || null,
  }
}

export const getTasks = async (): Promise<MappedTask[]> => {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', PID).order('sort_order', { ascending: true })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((t) => mapTask(t as Record<string, unknown>))
}

export const getTaskById = async (id: string): Promise<MappedTask> => {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return mapTask(data as Record<string, unknown>)
}
